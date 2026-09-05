import { z } from 'zod';

import { createChatRoom, listChatRooms } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../../_lib/handler';

export const dynamic = 'force-dynamic';

/**
 * Комнаты общего чата.
 *
 * `companyId` здесь нет и быть не может: он берётся из сессии (правило 5).
 * Схема строгая — лишнее поле роняет запрос, а не проглатывается молча.
 */
const createSchema = z
  .object({
    name: z.string().min(1).max(80),
    topic: z.string().max(280).nullable().optional(),
  })
  .strict();

export async function GET(request: Request) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    return listChatRooms(ctx);
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const body = await parseBody(request, createSchema);
    return createChatRoom(ctx, body);
  });
}
