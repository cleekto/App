import { PrismaClient } from '@prisma/client';

// Типы и перечисления схемы переэкспортируются отсюда, чтобы остальной код
// не зависел от того, куда Prisma генерирует клиент.
export {
  ListingLifecycle,
  MigrationBatchStatus,
  ObservationStateValue,
  Prisma,
  PrismaClient,
  PropertyOrigin,
  PropertyType,
  PublicationStatus,
  RoleCode,
  Source,
  TaskStatus,
  TransactionType,
} from '@prisma/client';
export type {
  ActivityLog,
  Company,
  ColumnMappingSchema,
  ListingObservation,
  MigrationBatch,
  ObservationState,
  OwnerContact,
  OwnerContactPhone,
  Property,
  PropertyLink,
  Publication,
  SourceListing,
  Task,
  Comment,
  PipelineStatus,
  RefreshToken,
  Role,
  Team,
  TeamMember,
  User,
} from '@prisma/client';

/**
 * Один клиент на процесс.
 *
 * В разработке Next.js перезагружает модули при каждом изменении, и без этого
 * кэша на каждой перезагрузке появлялся бы новый пул соединений — свободные
 * соединения в базе заканчиваются за десяток правок.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export interface DatabaseCheck {
  up: boolean;
  latencyMs: number;
  /** Имя класса ошибки. Только при `up: false`. Текст ошибки наружу не идёт. */
  errorKind?: string;
  /** Разобранная причина. Лечится каждая по-своему. */
  reason?: DatabaseFailureReason;
  /** Задана ли строка подключения. */
  urlConfigured: boolean;
}

export type DatabaseFailureReason =
  /** Переменной нет в этой сборке. */
  | 'env_missing'
  /** Строка не разбирается: лишние кавычки, перенос строки, обрезана. */
  | 'url_malformed'
  /** Хост не отвечает: неверный адрес либо база спит и не проснулась. */
  | 'unreachable'
  /** Логин или пароль отклонены. */
  | 'auth_failed'
  /** База с таким именем не найдена. */
  | 'database_missing'
  /** Движок Prisma не собран под платформу хостинга. */
  | 'engine_missing'
  | 'unknown';

/**
 * Разбирает ошибку Prisma в причину.
 *
 * ТЕКСТ ОШИБКИ НАРУЖУ НЕ ИДЁТ НИКОГДА: сообщение Prisma содержит строку
 * подключения вместе с паролем, а health открыт без аутентификации. Здесь
 * текст только читается, чтобы вернуть одно слово из списка выше.
 *
 * Разбор по подстрокам хрупок к смене формулировок Prisma — поэтому
 * `unknown` остаётся штатным исходом, а не считается сбоем разбора.
 */
function classifyDatabaseError(error: unknown): DatabaseFailureReason {
  const text = error instanceof Error ? error.message : '';

  if (/Environment variable not found/iu.test(text)) return 'env_missing';
  if (/must start with the protocol|invalid port|Error parsing connection string/iu.test(text)) {
    return 'url_malformed';
  }
  if (/Can't reach database server|connection refused|timed out/iu.test(text)) return 'unreachable';
  if (/Authentication failed|password authentication/iu.test(text)) return 'auth_failed';
  if (/database .* does not exist/iu.test(text)) return 'database_missing';
  if (/Query engine library|binaryTargets|could not locate the Query Engine/iu.test(text)) {
    return 'engine_missing';
  }
  return 'unknown';
}

/**
 * Настоящая проверка базы, а не «процесс жив».
 *
 * Health-эндпоинт, который всегда отвечает 200, не отвечает ни на один вопрос.
 * Здесь выполняется реальный запрос, и его время попадает в ответ.
 */
export async function checkDatabase(): Promise<DatabaseCheck> {
  const startedAt = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      up: true,
      latencyMs: Math.round(performance.now() - startedAt),
      urlConfigured: true,
    };
  } catch (error) {
    // Наружу уходит только тип ошибки. Текст ошибки Prisma может содержать
    // строку подключения вместе с паролем — секретам не место в логах
    // (правило 8), а причина по имени класса восстанавливается однозначно.
    console.error(
      '[health] проверка базы не прошла:',
      error instanceof Error ? error.name : 'unknown error',
    );
    return {
      up: false,
      latencyMs: Math.round(performance.now() - startedAt),
      errorKind: error instanceof Error ? error.name : 'unknown',
      reason: classifyDatabaseError(error),
      // Проверяется наличие, а не значение: значение — секрет.
      urlConfigured: (process.env['DATABASE_URL'] ?? '') !== '',
    };
  }
}
