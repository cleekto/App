import { z } from 'zod';

import { createChatTopic, listChatTopics } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../../../../_lib/handler';

export const dynamic = 'force-dynamic';

/**
 * Темы комнаты.
 *
 * Заводит тему любой сотрудник, в отличие от комнаты: начать разговор —
 * не то же самое, что завести новый круг людей.
 */
const createSchema = z.object({ name: z.string().min(1).max(80) }).strict();

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    return listChatTopics(ctx, id);
  });
}

export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    const body = await parseBody(request, createSchema);
    return createChatTopic(ctx, id, body.name);
  });
}
