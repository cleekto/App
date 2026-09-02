import { z } from 'zod';

import { createPublishProfile, listPublishProfiles } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../_lib/handler';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  displayName: z.string().min(1),
  phone: z.string().min(1),
  userId: z.string().uuid().nullable().optional(),
  isDefault: z.boolean().optional(),
});

/**
 * Профили публикации — область компании, не команды: их телефоны участвуют
 * в проверках уровня компании (I20, Q31, ADR-0006).
 */
export async function GET(request: Request) {
  return handle(async () => listPublishProfiles(await requireAuth(request)));
}

export async function POST(request: Request) {
  return handle(
    async () => {
      const ctx = await requireAuth(request);
      const body = await parseBody(request, createSchema);
      return createPublishProfile(ctx, body);
    },
    { status: 201 },
  );
}
