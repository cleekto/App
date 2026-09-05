import { z } from 'zod';

import { listDirectConversations, openDirectConversation } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../../_lib/handler';

export const dynamic = 'force-dynamic';

/**
 * Личные переписки.
 *
 * Открытие переписки идёт через POST, а не GET, потому что оно её создаёт,
 * если её ещё нет. Собеседник ищется в границах компании — человек
 * из чужого агентства просто не находится.
 */
const openSchema = z.object({ partnerUserId: z.string().uuid() }).strict();

export async function GET(request: Request) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    return listDirectConversations(ctx);
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const body = await parseBody(request, openSchema);
    return openDirectConversation(ctx, body.partnerUserId);
  });
}
