import { isLocale, type Locale } from '@cleekto/i18n';

/**
 * Язык страницы на фазе 2.
 *
 * Настоящий выбор языка живёт на пользователе (ADR-0008) и появится вместе
 * с аутентификацией в фазе 3. До тех пор берётся язык по умолчанию из
 * окружения — этого достаточно, чтобы весь путь от словаря до разметки был
 * рабочим, а не собранным в последний момент.
 */
export function serverLocale(): Locale {
  const configured = process.env.DEFAULT_LOCALE ?? 'en';
  return isLocale(configured) ? configured : 'en';
}
