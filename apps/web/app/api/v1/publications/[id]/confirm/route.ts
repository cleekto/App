import { z } from 'zod';

import { confirmPublication } from '@cleekto/core';

import { handle, parseBody, requireAuth } from '../../../../_lib/handler';

export const dynamic = 'force-dynamic';

const schema = z
  .object({
    externalId: z.string().min(1).nullable().optional(),
    externalUrl: z.string().url(),
  })
  .strict();

type Params = { params: Promise<{ id: string }> };

/**
 * Единственный способ перевести публикацию в статус published (инвариант 13).
 * Повторное подтверждение — конфликт, а не молчаливое обновление.
 */
export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    const body = await parseBody(request, schema);
    return confirmPublication(ctx, id, body);
  });
}
