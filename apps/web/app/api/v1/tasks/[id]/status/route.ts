import { z } from 'zod';

import { setTaskStatus } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../../../_lib/handler';

export const dynamic = 'force-dynamic';

/** Отмена отличается от выполнения: по отменённой работу не сделали. */
const schema = z.object({ status: z.enum(['open', 'done', 'cancelled']) }).strict();

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    const body = await parseBody(request, schema);
    return setTaskStatus(ctx, id, body.status);
  });
}
