import { z } from 'zod';

import { logout } from '@kleekto/core';

import { handle, parseBody } from '../../../_lib/handler';
import { clearSessionCookies, refreshTokenFromCookie } from '../../../_lib/session-cookies';

const schema = z.object({ refreshToken: z.string().min(1).optional() }).strict();

/**
 * Выход.
 *
 * Cookie стираются в любом случае, даже если refresh-токен уже недействителен:
 * иначе человек, нажавший «Выйти», остался бы с виду в системе — худший
 * возможный исход для действия, которое он выполнил ради безопасности.
 */
export async function POST(request: Request) {
  return handle(
    async () => {
      const fromCookie = refreshTokenFromCookie(request);

      // Logout остаётся best-effort: даже битое тело не должно помешать
      // очистить cookie. parseBody при этом всё равно обрывает чтение на
      // лимите, поэтому прежнего unbounded request.json здесь больше нет.
      const body = await parseBody(request, schema, { allowEmpty: true }).catch(() => ({}));
      const token = fromCookie ?? body.refreshToken ?? null;

      if (token !== null) await logout(token);
      return { ok: true };
    },
    { onResponse: (response) => clearSessionCookies(response) },
  );
}
