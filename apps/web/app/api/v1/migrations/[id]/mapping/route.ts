import { z } from 'zod';

import { setMigrationMapping } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../../../_lib/handler';

export const dynamic = 'force-dynamic';

const schema = z
  .object({
    /** Колонка файла → поле системы либо явный пропуск. */
    mapping: z.record(
      z.string(),
      z.enum([
        'address',
        'district',
        'price',
        'currency',
        'area',
        'rooms',
        'floor',
        'totalFloors',
        'propertyType',
        'transactionType',
        'ownerName',
        'ownerPhone',
        'description',
        'skip',
      ]),
    ),
    /** Сохранить сопоставление на компанию для следующих файлов (L4). */
    saveAsSchemaName: z.string().min(1).optional(),
  })
  .strict();

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    const body = await parseBody(request, schema);
    return setMigrationMapping(ctx, id, body);
  });
}
