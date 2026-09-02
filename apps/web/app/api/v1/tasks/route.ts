import { z } from 'zod';

import { createTask, listTasks } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../_lib/handler';

export const dynamic = 'force-dynamic';

const filtersSchema = z
  .object({
    propertyId: z.string().uuid().optional(),
    mine: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    status: z.enum(['open', 'done', 'cancelled']).optional(),
    dueBefore: z.string().datetime().optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
  })
  .strict();

const createSchema = z
  .object({
    propertyId: z.string().uuid(),
    title: z.string().min(1).max(300),
    description: z.string().max(5000).nullable().optional(),
    assignedUserId: z.string().uuid().nullable().optional(),
    dueAt: z.string().datetime().nullable().optional(),
  })
  .strict();

export async function GET(request: Request) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const raw = Object.fromEntries(new URL(request.url).searchParams);
    return listTasks(ctx, filtersSchema.parse(raw));
  });
}

export async function POST(request: Request) {
  return handle(
    async () => {
      const ctx = await requireAuth(request);
      const body = await parseBody(request, createSchema);
      return createTask(ctx, body);
    },
    { status: 201 },
  );
}
