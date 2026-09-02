import { z } from 'zod';

import { assignProperty } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../../../_lib/handler';

export const dynamic = 'force-dynamic';

const schema = z.object({ assignedUserId: z.string().uuid().nullable() }).strict();

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    const body = await parseBody(request, schema);
    return assignProperty(ctx, id, body.assignedUserId);
  });
}
