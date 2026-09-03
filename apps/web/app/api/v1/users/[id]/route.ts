import { z } from 'zod';

import { deactivateUser, updateUser } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../../_lib/handler';

export const dynamic = 'force-dynamic';

/**
 * Схема изменения. Строгая, и все поля необязательны: форма шлёт только то,
 * что человек действительно правил.
 *
 * ПОЛЕЙ companyId ЗДЕСЬ НЕТ (правило 5): и своя компания, и область
 * («вся компания», «своя команда», «только себя») берутся из сессии.
 */
const updateSchema = z
  .object({
    fullName: z.string().min(1).optional(),
    role: z.enum(['ADMIN', 'MANAGER', 'AGENT']).optional(),
    teamId: z.string().uuid().nullable().optional(),
    locale: z.enum(['ka', 'en', 'ru']).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    const body = await parseBody(request, updateSchema);
    return updateUser(ctx, id, body);
  });
}

/**
 * DELETE отключает сотрудника, а не стирает его.
 *
 * Его имя стоит в журнале действий, в комментариях и в истории объектов —
 * настоящее удаление вырезало бы куски истории агентства. Отключённый
 * не входит в систему, а прежние записи остаются читаемыми.
 */
export async function DELETE(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    await deactivateUser(ctx, id);
    return { id, isActive: false };
  });
}
