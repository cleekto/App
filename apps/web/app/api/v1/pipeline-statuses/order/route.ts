import { z } from 'zod';

import { reorderPipelineStatuses } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../../_lib/handler';

export const dynamic = 'force-dynamic';

/**
 * Новый порядок стадий — весь список целиком.
 *
 * Отдельным маршрутом, а не полем `sortOrder` в PATCH каждой стадии:
 * перестановка одной колонки меняет порядок всех, и пятью запросами подряд
 * доска на секунду оказывалась бы в состоянии, которого никто не задавал.
 */
const schema = z.object({ order: z.array(z.string().uuid()).min(1).max(50) }).strict();

export async function POST(request: Request) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const body = await parseBody(request, schema);
    return reorderPipelineStatuses(ctx, body.order);
  });
}
