import { z } from 'zod';

import { createUser, listUsers } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../_lib/handler';

export const dynamic = 'force-dynamic';

/**
 * Схема НЕ содержит companyId — и это не упущение.
 * Правило 5: компания берётся из сессии, из тела запроса — никогда.
 */
const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  fullName: z.string().min(1),
  role: z.enum(['ADMIN', 'MANAGER', 'AGENT']),
  teamId: z.string().uuid().nullable().optional(),
  locale: z.enum(['ka', 'en', 'ru']).optional(),
});

export async function GET(request: Request) {
  return handle(async () => listUsers(await requireAuth(request)));
}

export async function POST(request: Request) {
  return handle(
    async () => {
      const ctx = await requireAuth(request);
      const body = await parseBody(request, createSchema);
      return createUser(ctx, body);
    },
    { status: 201 },
  );
}
