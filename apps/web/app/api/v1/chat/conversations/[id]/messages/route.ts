import { z } from 'zod';

import { listChatMessages, postChatMessage } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../../../../_lib/handler';

export const dynamic = 'force-dynamic';

const postSchema = z.object({ body: z.string().min(1).max(4000) }).strict();

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    return listChatMessages(ctx, { conversationId: id });
  });
}

export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    const payload = await parseBody(request, postSchema);
    return postChatMessage(ctx, { conversationId: id }, payload.body);
  });
}
