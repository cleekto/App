import { z } from 'zod';

import { deleteChatMessage, editChatMessage } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../../../_lib/handler';

export const dynamic = 'force-dynamic';

/**
 * Правка и удаление сообщения.
 *
 * Кто что может — решает ядро: править только автор, удалять автор либо
 * администратор, и то не в чужой личной переписке. Маршрут ничего
 * не проверяет сам, иначе правило жило бы в двух местах и разошлось бы.
 */
const patchSchema = z.object({ body: z.string().min(1).max(4000) }).strict();

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    const payload = await parseBody(request, patchSchema);
    return editChatMessage(ctx, id, payload.body);
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    return deleteChatMessage(ctx, id);
  });
}
