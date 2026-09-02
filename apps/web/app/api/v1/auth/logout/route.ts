import { logout } from '@kleekto/core';

import { handle } from '../../../_lib/handler';
import { clearSessionCookies, refreshTokenFromCookie } from '../../../_lib/session-cookies';

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
      const body = (await request.json().catch(() => ({}))) as { refreshToken?: string };
      const token = fromCookie ?? body.refreshToken ?? null;

      if (token !== null) await logout(token);
      return { ok: true };
    },
    { onResponse: (response) => clearSessionCookies(response) },
  );
}
