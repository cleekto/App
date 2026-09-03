import { z } from 'zod';

import { createPropertyManually, listProperties } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../_lib/handler';

export const dynamic = 'force-dynamic';

/**
 * Фильтры приходят строкой запроса, поэтому числа разбираются явно:
 * `z.coerce` принял бы «abc» как NaN и молча отфильтровал бы весь список.
 */
const filtersSchema = z
  .object({
    query: z.string().min(1).optional(),
    pipelineStatusId: z.string().uuid().optional(),
    propertyType: z.enum(['APARTMENT', 'HOUSE', 'LAND', 'COMMERCIAL']).optional(),
    transactionType: z.enum(['SALE', 'RENT']).optional(),
    assignedUserId: z.string().uuid().optional(),
    origin: z.enum(['consent', 'manual', 'legacy_import']).optional(),
    priceMin: z.coerce.number().nonnegative().optional(),
    priceMax: z.coerce.number().nonnegative().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    offset: z.coerce.number().int().nonnegative().optional(),
  })
  .strict();

export async function GET(request: Request) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const raw = Object.fromEntries(new URL(request.url).searchParams);
    const filters = filtersSchema.parse(raw);

    return listProperties(ctx, filters);
  });
}

/**
 * Ручное заведение объекта — исключение из правила 0, названное самим
 * правилом. `origin` ставит сценарий, а не запрос: пометить объект
 * «пришёл по согласию» отсюда нельзя.
 *
 * Телефон собственника обязателен: он ключ дедупликации, и объект без него
 * не найдётся, когда тот же собственник придёт с площадки.
 */
const createSchema = z
  .object({
    owner: z
      .object({ name: z.string().max(200).nullable().optional(), phone: z.string().min(1) })
      .strict(),
    transactionType: z.enum(['SALE', 'RENT']),
    propertyType: z.enum(['APARTMENT', 'HOUSE', 'LAND', 'COMMERCIAL']),
    rooms: z.number().int().min(0).max(50).nullable().optional(),
    areaTotal: z.number().positive().max(100_000).nullable().optional(),
    floor: z.number().int().min(-5).max(200).nullable().optional(),
    totalFloors: z.number().int().min(0).max(200).nullable().optional(),
    district: z.string().max(200).nullable().optional(),
    addressRaw: z.string().max(500).nullable().optional(),
    price: z.number().nonnegative().max(1_000_000_000).nullable().optional(),
    currency: z.string().length(3).nullable().optional(),
    publicDescription: z.string().max(10_000).nullable().optional(),
    acknowledgedDuplicateOf: z.array(z.string().uuid()).max(20).optional(),
  })
  .strict();

export async function POST(request: Request) {
  return handle(
    async () => {
      const ctx = await requireAuth(request);
      const body = await parseBody(request, createSchema);
      return createPropertyManually(ctx, body);
    },
    { status: 201 },
  );
}
