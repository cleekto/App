import { z } from 'zod';

import { refreshSession } from '@kleekto/core';

import { handle } from '../../../_lib/handler';
import { refreshTokenFromCookie, setSessionCookies } from '../../../_lib/session-cookies';

const schema = z.object({ refreshToken: z.string().min(1) });

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
      const refreshToken =
        fromCookie ?? schema.parse(await request.json().catch(() => ({}))).refreshToken;

      return refreshSession(refreshToken);
    },
    { onResponse: (response, result) => setSessionCookies(response, result) },
  );
}
