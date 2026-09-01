import { z } from 'zod';

import { getProperty, updateProperty } from '@cleekto/core';

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
    price: z.number().positive().nullable().optional(),
    currency: z.string().length(3).nullable().optional(),
    district: z.string().max(200).nullable().optional(),
    addressRaw: z.string().max(500).nullable().optional(),
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
