import { PrismaClient } from '@prisma/client';

// Типы и перечисления схемы переэкспортируются отсюда, чтобы остальной код
// не зависел от того, куда Prisma генерирует клиент.
export { Prisma, PrismaClient, RoleCode } from '@prisma/client';
export type {
  ActivityLog,
  Company,
  PipelineStatus,
  PublishProfile,
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
    return { up: true, latencyMs: Math.round(performance.now() - startedAt) };
  } catch (error) {
    // Наружу уходит только тип ошибки. Текст ошибки Prisma может содержать
    // строку подключения вместе с паролем — секретам не место в логах
    // (правило 8), а причина по имени класса восстанавливается однозначно.
    console.error(
      '[health] проверка базы не прошла:',
      error instanceof Error ? error.name : 'unknown error',
    );
    return { up: false, latencyMs: Math.round(performance.now() - startedAt) };
  }
}
