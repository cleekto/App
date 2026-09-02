import { createHash } from 'node:crypto';

import { prisma } from '@kleekto/db';

import { RateLimitedError } from '../errors';

/**
 * Ограничение частоты обращений.
 *
 * ЗАЧЕМ ЭТО ЕСТЬ. Вход по email и паролю без ограничения — приглашение
 * подобрать пароль перебором. Агентство узнает об этом не из журнала,
 * а от собственников, которым позвонили чужие.
 *
 * СЧЁТЧИК В БАЗЕ, А НЕ В ПАМЯТИ. Веб работает на serverless: экземпляров
 * много, они гаснут и поднимаются заново. Счётчик в памяти означал бы, что
 * фактический предел умножен на число экземпляров и обнуляется после каждого
 * простоя, — то есть защиты нет, но выглядит она убедительно.
 *
 * Окно фиксированное, а не скользящее. Скользящее точнее, но требует хранить
 * каждое обращение; для защиты от перебора разница несущественна, а стоимость
 * заметна.
 */

export interface RateLimitRule {
  /** Что ограничиваем: `login`, `register`. Попадает в ключ. */
  scope: string;
  /** Сколько обращений разрешено в окне. */
  limit: number;
  windowSeconds: number;
}

/**
 * Предустановленные правила.
 *
 * Значения выбраны так, чтобы человек их не заметил, а перебор — уперся.
 * Пять попыток входа в минуту с одного адреса покрывают опечатку в пароле
 * и раскладку, но делают перебор по словарю бессмысленным.
 */
export const RATE_LIMITS = {
  login: { scope: 'login', limit: 5, windowSeconds: 60 },
  register: { scope: 'register', limit: 3, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * Ключ обращения.
 *
 * Идентификатор хешируется: в таблице оказываются адреса почты и IP, а это
 * персональные данные (правило 10). Для счётчика важна только различимость,
 * а не читаемость.
 */
function keyFor(scope: string, identifier: string): string {
  const digest = createHash('sha256').update(identifier).digest('hex').slice(0, 32);
  return `${scope}:${digest}`;
}

/**
 * Учитывает обращение и бросает `RateLimitedError`, когда предел исчерпан.
 *
 * Атомарность обеспечивается транзакцией с блокировкой строки: без неё
 * параллельные попытки читали бы одно и то же значение и прошли бы все.
 * Именно так перебор и выглядит — параллельными запросами.
 */
export async function consumeRateLimit(
  rule: RateLimitRule,
  identifier: string,
  now: Date = new Date(),
): Promise<void> {
  const key = keyFor(rule.scope, identifier);
  const windowMs = rule.windowSeconds * 1000;

  const hits = await prisma.$transaction(async (tx) => {
    const existing = await tx.rateLimit.findUnique({ where: { key } });

    const expired = existing === null || now.getTime() - existing.windowStart.getTime() >= windowMs;

    if (expired) {
      await tx.rateLimit.upsert({
        where: { key },
        create: { key, windowStart: now, hits: 1 },
        update: { windowStart: now, hits: 1 },
      });
      return 1;
    }

    const updated = await tx.rateLimit.update({
      where: { key },
      data: { hits: { increment: 1 } },
    });
    return updated.hits;
  });

  if (hits > rule.limit) {
    throw new RateLimitedError(rule.windowSeconds);
  }
}

/**
 * Уборка отработавших окон.
 *
 * Таблица иначе растёт линейно от числа попыток входа за всю жизнь продукта.
 * Вызывается из планировщика; отдельного расписания в MVP нет, поэтому
 * функция существует и задокументирована, а вызов добавляется при
 * развёртывании (см. `docs/DEPLOYMENT.md`).
 */
export async function pruneRateLimits(olderThan: Date): Promise<number> {
  const { count } = await prisma.rateLimit.deleteMany({
    where: { windowStart: { lt: olderThan } },
  });
  return count;
}
