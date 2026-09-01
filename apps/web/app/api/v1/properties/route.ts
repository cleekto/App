import { z } from 'zod';

import { listProperties } from '@cleekto/core';

import { handle, requireAuth } from '../../_lib/handler';

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
