import { z } from 'zod';

/**
 * Ответ health-эндпоинта.
 *
 * Намеренно проверяет базу, а не отвечает 200 безусловно: эндпоинт, который
 * всегда зелёный, не отвечает ни на один вопрос. `database: 'down'` даёт 503 —
 * приложение живо, но работать не может.
 */
export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  database: z.enum(['up', 'down']),
  /** Версия приложения из package.json — чтобы видеть, что развёрнуто. */
  version: z.string(),
  checkedAt: z.string().datetime(),
  /** Время ответа базы в миллисекундах. Отсутствует, если база недоступна. */
  databaseLatencyMs: z.number().nonnegative().optional(),
  /**
   * Почему база недоступна. Только при `database: 'down'`.
   *
   * ИМЯ КЛАССА ОШИБКИ И ФЛАГИ, НИКОГДА ТЕКСТ. Сообщение Prisma содержит строку
   * подключения вместе с паролем, а эндпоинт открыт без аутентификации.
   * Имени класса достаточно, чтобы различить три случая, которые лечатся
   * по-разному: переменная не задана, хост недостижим, доступ отклонён.
   */
  databaseError: z
    .object({
      kind: z.string(),
      /** Разобранная причина: `env_missing`, `url_malformed`, `unreachable` и так далее. */
      reason: z.string(),
      /** Задана ли `DATABASE_URL`. Отличает «не настроено» от «не достучались». */
      urlConfigured: z.boolean(),
    })
    .optional(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
