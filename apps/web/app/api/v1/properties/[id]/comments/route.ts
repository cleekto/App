import { z } from 'zod';

import { addComment, listComments } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../../../_lib/handler';

export const dynamic = 'force-dynamic';

const schema = z.object({ body: z.string().min(1).max(5000) }).strict();

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    return listComments(ctx, id);
  });
}

export async function POST(request: Request, { params }: Params) {
  return handle(
    async () => {
      const ctx = await requireAuth(request);
      const { id } = await params;
      const payload = await parseBody(request, schema);
      return addComment(ctx, id, payload.body);
    },
    { status: 201 },
  );
}
