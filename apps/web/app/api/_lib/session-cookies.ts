import type { NextResponse } from 'next/server';

import { ACCESS_COOKIE, REFRESH_COOKIE } from './handler';

/**
 * Сессия веб-приложения в cookie.
 *
 * ПОЧЕМУ COOKIE, А НЕ ЗАГОЛОВОК. Расширение носит токен в `Authorization`:
 * cookie нашего домена ему на странице площадки недоступны. Вебу наоборот
 * нужен `httpOnly` — токен, доступный скриптам на странице, вынесет первая же
 * найденная XSS. Сервер принимает оба способа (`extractToken`), а выбирает
 * каждый клиент тот, который для него безопаснее.
 */

interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Срок жизни refresh-cookie. Совпадает со сроком токена в базе (фаза 3). */
const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function base(): { httpOnly: true; sameSite: 'lax'; secure: boolean; path: string } {
  return {
    httpOnly: true,
    // `lax`, а не `strict`: при `strict` переход по ссылке из письма или
    // из расширения приводил бы на страницу входа у уже вошедшего человека.
    sameSite: 'lax',
    // В разработке сервер работает по http, и `secure` сделал бы вход
    // невозможным. В production — обязателен.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

export function setSessionCookies(response: NextResponse, tokens: SessionTokens): NextResponse {
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...base(),
    maxAge: tokens.expiresIn,
  });
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...base(),
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
  return response;
}

export function clearSessionCookies(response: NextResponse): NextResponse {
  response.cookies.set(ACCESS_COOKIE, '', { ...base(), maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, '', { ...base(), maxAge: 0 });
  return response;
}

/** Refresh-токен из cookie — для веба, который тела запроса не формирует. */
export function refreshTokenFromCookie(request: Request): string | null {
  const cookie = request.headers.get('cookie');
  if (cookie === null) return null;

  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === REFRESH_COOKIE) {
      return decodeURIComponent(rest.join('=')) || null;
    }
  }
  return null;
}
