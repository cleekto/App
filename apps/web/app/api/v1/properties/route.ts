import { z } from 'zod';

import { propertyFactsShape, propertyKindShape } from '@kleekto/contracts';

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
    propertyType: propertyKindShape.propertyType.optional(),
    transactionType: propertyKindShape.transactionType.optional(),
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
    ...propertyKindShape,
    // Тот же список, что и при правке, и тот же, что у разбора объявления:
    // объект, заведённый руками, обязан годиться для публикации без
    // дозаполнения (решение владельца 2026-09-06).
    ...propertyFactsShape,
    publicDescription: z.string().max(10_000).nullable().optional(),
    isExclusive: z.boolean().optional(),
    /** Ключи загруженных фотографий. Чужие отсеивает ядро. */
    photoKeys: z.array(z.string().min(1).max(400)).max(20).optional(),
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
