import { z } from 'zod';

import { registerCompany } from '@cleekto/core';

import { handle, parseBody } from '../../../_lib/handler';

const schema = z.object({
  companyName: z.string().min(1),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(12),
  adminFullName: z.string().min(1),
  locale: z.enum(['ka', 'en', 'ru']).optional(),
});

/**
 * POST /api/v1/auth/register — регистрация компании и первого администратора.
 *
 * Открытый эндпоинт: аутентификации ещё нет, компании тоже.
 */
export async function POST(request: Request) {
  return handle(
    async () => {
      const body = await parseBody(request, schema);
      return registerCompany(body);
    },
    { status: 201 },
  );
}
