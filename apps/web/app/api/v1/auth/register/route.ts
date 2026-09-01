import { z } from 'zod';

import { RATE_LIMITS, consumeRateLimit, registerCompany } from '@cleekto/core';

import { clientAddress } from '../../../_lib/client-address';
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

      // Регистрация компании — дорогая операция: создаётся компания, роли,
      // пять статусов воронки и администратор. Без ограничения это готовый
      // способ засорить базу с одной машины.
      await consumeRateLimit(RATE_LIMITS.register, clientAddress(request));

      return registerCompany(body);
    },
    { status: 201 },
  );
}
