import type { en } from './locales/en';

/** Три языка продукта. Равноправны — порядок здесь алфавитный, не по важности. */
export const LOCALES = ['en', 'ka', 'ru'] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * Теги для `Intl`. Отделены от кода локали намеренно: код языка — это
 * идентификатор в нашем словаре, а тег — региональные правила формата.
 *
 * `en-GB`, а не `en-US`: рынок продукта — Грузия, и порядок «день/месяц/год»
 * там ожидаем, а «месяц/день/год» читается неверно.
 */
export const INTL_TAG: Record<Locale, string> = {
  en: 'en-GB',
  ka: 'ka-GE',
  ru: 'ru-RU',
};

/** Форма словаря: задаётся английским как опорным (см. `locales/en.ts`). */
export type Dictionary = DeepStringShape<typeof en>;

export type DeepStringShape<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringShape<T[K]>;
};

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]>;
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
