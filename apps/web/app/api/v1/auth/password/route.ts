import { z } from 'zod';

import { MIN_PASSWORD_LENGTH, changePassword } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../../_lib/handler';
import { setSessionCookies } from '../../../_lib/session-cookies';

export const dynamic = 'force-dynamic';

const schema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(MIN_PASSWORD_LENGTH),
  })
  .strict();

/**
 * POST /api/v1/auth/password — сменить пароль.
 *
 * Возвращает новую пару токенов и кладёт её в cookie: смена пароля отзывает
 * все сессии, включая текущую (см. changePassword), поэтому без перевыпуска
 * человек тут же выпал бы из своей же вкладки.
 */
export async function POST(request: Request) {
  return handle(
    async () => {
      const ctx = await requireAuth(request);
      const body = await parseBody(request, schema);
      return changePassword(ctx, body);
    },
    { onResponse: (response, tokens) => setSessionCookies(response, tokens) },
  );
}
