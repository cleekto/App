import { z } from 'zod';

import { watchChatRoom } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../../../../_lib/handler';

export const dynamic = 'force-dynamic';

/**
 * Слежение за комнатой — личная настройка того, кто читает.
 *
 * `PUT`, а не `POST`: отправляется желаемое состояние целиком, и повторный
 * запрос с тем же значением ничего не меняет. Флажок нажимают быстро
 * и по два раза, и «включить ещё раз» не должно быть ошибкой.
 */
const schema = z.object({ watched: z.boolean() }).strict();

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    const body = await parseBody(request, schema);

    return watchChatRoom(ctx, id, body.watched);
  });
}
