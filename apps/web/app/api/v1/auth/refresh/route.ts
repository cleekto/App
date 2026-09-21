import { z } from 'zod';

import { refreshSession } from '@kleekto/core';

import { handle, parseBody } from '../../../_lib/handler';
import { refreshTokenFromCookie, setSessionCookies } from '../../../_lib/session-cookies';

const schema = z.object({ refreshToken: z.string().min(1).optional() }).strict();

/**
 * Обновление сессии.
 *
 * Токен берётся из тела (расширение) либо из cookie (веб). Веб тела
 * не формирует: его refresh-токен `httpOnly` и скриптам недоступен —
 * в этом и смысл.
 */
export async function POST(request: Request) {
  return handle(
    async () => {
      const fromCookie = refreshTokenFromCookie(request);
      const body = await parseBody(request, schema, { allowEmpty: true });
      const refreshToken = fromCookie ?? body.refreshToken;

      if (refreshToken === undefined) {
        throw new z.ZodError([
          { code: 'custom', path: ['refreshToken'], message: 'Refresh-токен обязателен' },
        ]);
      }

      return refreshSession(refreshToken);
    },
    { onResponse: (response, result) => setSessionCookies(response, result) },
  );
}
