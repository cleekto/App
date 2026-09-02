import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { currentUser, verifyAccessToken } from '@kleekto/core';
import type { AuthContext, CurrentUser } from '@kleekto/core';
import { isLocale, type Locale } from '@kleekto/i18n';

import { ACCESS_COOKIE } from '../api/_lib/handler';

/**
 * Контекст для серверных страниц.
 *
 * ЕДИНСТВЕННЫЙ источник `companyId` в вебе — так же, как `requireAuth`
 * в маршрутах (правило 5). Страница не принимает его параметром и не может:
 * взять его неоткуда, кроме подписанного токена.
 *
 * Страницы читают домен напрямую через `@kleekto/core`, а не ходят по HTTP
 * в собственный API. Это тот же слой прав и та же изоляция — просто без
 * лишнего круга через сеть. Изменения по-прежнему идут через API: они
 * приходят из браузера.
 */

export async function optionalContext(): Promise<AuthContext | null> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (token === undefined || token === '') return null;

  try {
    const verified = await verifyAccessToken(token);
    return {
      userId: verified.userId,
      companyId: verified.companyId,
      teamId: verified.teamId,
      role: verified.role,
      locale: verified.locale,
    };
  } catch {
    // Истёкший или подделанный токен — это «не вошёл», а не ошибка страницы.
    return null;
  }
}

/** Контекст или переход на вход. Для страниц, которых без сессии не бывает. */
export async function requireContext(): Promise<AuthContext> {
  const ctx = await optionalContext();
  if (ctx === null) redirect('/login');
  return ctx;
}

/**
 * Язык интерфейса.
 *
 * Язык ПОЛЬЗОВАТЕЛЯ, а не браузера и не окружения (ADR-0008): агент мог
 * поставить систему на русском, а работать на грузинском.
 */
export function contextLocale(ctx: AuthContext | null): Locale {
  if (ctx !== null && isLocale(ctx.locale)) return ctx.locale;

  const fallback = process.env.DEFAULT_LOCALE ?? 'en';
  return isLocale(fallback) ? fallback : 'en';
}

export async function me(ctx: AuthContext): Promise<CurrentUser> {
  return currentUser(ctx);
}
