import { cookies } from 'next/headers';

import { isLocale, type Locale } from '@cleekto/i18n';

/**
 * Язык страницы.
 *
 * Порядок источников, от сильного к слабому:
 *
 *   1. **выбор человека**, сохранённый в cookie `cleekto_locale`;
 *   2. `DEFAULT_LOCALE` из окружения — язык компании до входа;
 *   3. английский.
 *
 * Язык из профиля пользователя сюда не входит: он известен только после
 * входа и применяется в оболочке приложения. Здесь решается язык страницы
 * входа и разметки `<html lang>` — то есть того, что видно ДО того, как
 * стало известно, кто пришёл.
 *
 * ПОЧЕМУ COOKIE, А НЕ ТОЛЬКО ПРОФИЛЬ. Агент, которому дали ссылку на CRM,
 * должен прочитать страницу входа на своём языке, не входя в систему.
 * Язык интерфейса — не секрет и не настройка компании, а удобство читающего.
 */

export const LOCALE_COOKIE = 'cleekto_locale';

export async function serverLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (chosen !== undefined && isLocale(chosen)) return chosen;

  const configured = process.env.DEFAULT_LOCALE ?? 'en';
  return isLocale(configured) ? configured : 'en';
}
