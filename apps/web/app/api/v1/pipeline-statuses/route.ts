import { z } from 'zod';

import { createPipelineStatus, listPipelineStatuses } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../_lib/handler';

export const dynamic = 'force-dynamic';

/** Инвариант 4: статусы читаются из базы, а не из константы в коде. */
export async function GET(request: Request) {
  return handle(async () => listPipelineStatuses(await requireAuth(request)));
}

/**
 * Новая стадия воронки.
 *
 * `companyId` здесь нет и быть не может (правило 5): воронка, в которую
 * добавляют стадию, берётся из сессии.
 */
const createSchema = z
  .object({
    name: z.string().min(1).max(60),
    colorToken: z.string().max(40).optional(),
  })
  .strict();

export async function POST(request: Request) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const body = await parseBody(request, createSchema);
    return createPipelineStatus(ctx, body);
  });
}
