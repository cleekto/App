import { NextResponse } from 'next/server';

import { healthResponseSchema, type HealthResponse } from '@kleekto/contracts';
import { checkDatabase } from '@kleekto/db';

import { APP_VERSION } from '../../../version';

// Health обязан отражать состояние прямо сейчас, а не то, каким оно было
// на момент сборки.
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/health
 *
 * 200 — приложение и база работают.
 * 503 — приложение живо, база недоступна.
 *
 * Второй случай существует намеренно: эндпоинт, который всегда отвечает 200,
 * не отвечает ни на один вопрос и создаёт ложное спокойствие на дашборде.
 */
export async function GET(): Promise<NextResponse<HealthResponse>> {
  const database = await checkDatabase();

  const body: HealthResponse = {
    status: database.up ? 'ok' : 'degraded',
    database: database.up ? 'up' : 'down',
    version: APP_VERSION,
    checkedAt: new Date().toISOString(),
    ...(database.up
      ? { databaseLatencyMs: database.latencyMs }
      : {
          databaseError: {
            kind: database.errorKind ?? 'unknown',
            reason: database.reason ?? 'unknown',
            urlConfigured: database.urlConfigured,
          },
        }),
  };

  // Ответ проверяется собственной схемой: расхождение контракта и реализации
  // должно падать здесь, а не у потребителя API.
  return NextResponse.json(healthResponseSchema.parse(body), {
    status: database.up ? 200 : 503,
    headers: { 'cache-control': 'no-store' },
  });
}
