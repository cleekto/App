import { z } from 'zod';

import { ROOM_COLORS, updateChatRoom } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../../../_lib/handler';

export const dynamic = 'force-dynamic';

/**
 * Правка комнаты: имя, тема, архив.
 *
 * Удаления нет намеренно — вместе с комнатой исчезла бы переписка.
 * Вместо него архивирование.
 */
const patchSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    topic: z.string().max(280).nullable().optional(),
    colorToken: z.enum(ROOM_COLORS).nullable().optional(),
    isArchived: z.boolean().optional(),
  })
  .strict();

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    const body = await parseBody(request, patchSchema);
    return updateChatRoom(ctx, id, body);
  });
}
