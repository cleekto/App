import { z } from 'zod';

import { propertyFactsShape, propertyKindShape } from '@kleekto/contracts';

import { getProperty, updateProperty } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../../_lib/handler';

export const dynamic = 'force-dynamic';

/**
 * Редактируемые в карточке поля.
 *
 * `publicDescription` правится отдельно от `descriptionSource` (§7): описание
 * из объявления — чужой текст, и публиковать его от своего имени странно
 * и юридически, и стилистически.
 */
const patchSchema = z
  .object({
    publicDescription: z.string().max(10_000).nullable().optional(),
    // Те же факты, что и при заведении: агент узнаёт этаж и состояние
    // ремонта уже после того, как завёл объект.
    ...propertyFactsShape,
    transactionType: propertyKindShape.transactionType.optional(),
    propertyType: propertyKindShape.propertyType.optional(),
    // Полный список после правки: и состав, и порядок. Что из него уцелеет,
    // решает сервер — чужие ключи он отсеивает сам.
    photos: z.array(z.string().min(1).max(500)).max(20).optional(),
    isExclusive: z.boolean().optional(),
  })
  .strict();

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    return getProperty(ctx, id);
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    const body = await parseBody(request, patchSchema);
    return updateProperty(ctx, id, body);
  });
}
