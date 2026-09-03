import { z } from 'zod';

import { deleteTeam, updateTeam } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../../_lib/handler';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({ name: z.string().min(1).max(80) }).strict();

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    const body = await parseBody(request, updateSchema);
    return updateTeam(ctx, id, body);
  });
}

/**
 * Удаление команды.
 *
 * Настоящее удаление, а не отключение: у команды, в отличие от сотрудника,
 * нет своей истории — записи журнала ссылаются на людей и объекты. Но пустой
 * она обязана быть: команда это область видимости объектов, и объекты без
 * области пропали бы из всех списков, оставшись в базе. Сценарий это
 * проверяет и говорит, что именно мешает.
 */
export async function DELETE(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    await deleteTeam(ctx, id);
    return { id };
  });
}
