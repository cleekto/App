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
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
