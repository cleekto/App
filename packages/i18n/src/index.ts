import { en } from './locales/en';
import { ka } from './locales/ka';
import { ru } from './locales/ru';
import { INTL_TAG, LOCALES, isLocale } from './types';
import type { DeepPartial, Dictionary, Locale } from './types';

export { LOCALES, INTL_TAG, isLocale };
export type { Dictionary, Locale };

const DICTIONARIES: Record<Locale, DeepPartial<Dictionary>> = { en, ka, ru };

/**
 * Плоский путь к строке словаря: `common.retry`, `health.ok`.
 * Проверяется типом — опечатка в ключе не компилируется.
 */
export type MessageKey = FlatKeys<typeof en>;

type FlatKeys<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : FlatKeys<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/**
 * Перевод не найден. Возвращается видимая метка, а НЕ текст другого языка.
 *
 * Тихий откат на английский — самая частая ошибка в многоязычных проектах:
 * он выглядит прилично, поэтому никто не узнаёт, что не переведено (ADR-0008).
 */
export function missingMarker(key: string): string {
  return `⟦${key}⟧`;
}

function lookup(dictionary: DeepPartial<Dictionary>, key: string): string | undefined {
  let node: unknown = dictionary;
  for (const segment of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Достаёт строку из словаря языка. Отсутствующий перевод возвращается как
 * `⟦ключ⟧` — дыра, которую видно на экране и в скриншоте.
 */
export function translate(locale: Locale, key: MessageKey): string {
  return lookup(DICTIONARIES[locale], key) ?? missingMarker(key);
}

/** Переводчик, привязанный к языку. Удобно передавать в компонент. */
export function translator(locale: Locale): (key: MessageKey) => string {
  return (key) => translate(locale, key);
}

/** Все ключи опорного словаря, плоским списком. */
export function referenceKeys(): string[] {
  return collectKeys(en);
}

function collectKeys(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [];
  const keys: string[] = [];
  for (const [name, value] of Object.entries(node)) {
    const path = prefix === '' ? name : `${prefix}.${name}`;
    if (typeof value === 'string') keys.push(path);
    else keys.push(...collectKeys(value, path));
  }
  return keys;
}

export interface LocaleCoverage {
  locale: Locale;
  translated: string[];
  missing: string[];
  /** Ключи, которых нет в опорном словаре: опечатка или забытый после правки остаток. */
  unknown: string[];
  ratio: number;
}

/**
 * Покрытие языка. Используется тестом и отчётом о переводах.
 *
 * `missing` — ожидаемое состояние на ранних фазах и сборку не роняет.
 * `unknown` — всегда дефект: ключ существует в языке, но не в опорном словаре.
 */
export function coverage(locale: Locale): LocaleCoverage {
  const reference = referenceKeys();
  const present = collectKeys(DICTIONARIES[locale]);
  const referenceSet = new Set(reference);

  const translated = present.filter((key) => referenceSet.has(key));
  const missing = reference.filter((key) => !present.includes(key));
  const unknown = present.filter((key) => !referenceSet.has(key));

  return {
    locale,
    translated,
    missing,
    unknown,
    ratio: reference.length === 0 ? 1 : translated.length / reference.length,
  };
}

// ── Форматтеры ───────────────────────────────────────────────────────────────
// Даты, числа и деньги идут только через них. Склейка строк в компоненте
// ломается на первом же языке с другим порядком слов.

export function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(INTL_TAG[locale]).format(value);
}

/**
 * Деньги. Валюта передаётся явно и не выводится из языка: агентство в Тбилиси
 * ведёт объекты в долларах, а интерфейс при этом может быть грузинским (Q13).
 */
export function formatMoney(locale: Locale, amount: number, currency: string): string {
  return new Intl.NumberFormat(INTL_TAG[locale], {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Часовой пояс рынка. Продукт сделан для Грузии, и день у него грузинский.
 *
 * ЗАДАН ЯВНО, А НЕ ВЗЯТ У МАШИНЫ. Форматирование идёт на сервере — так
 * решено потому, что у браузера агента может не быть данных грузинской
 * локали, — а сервер в облаке живёт по UTC. Без этой строки объект,
 * заведённый в Тбилиси в два часа ночи, показывался бы вчерашним: разница
 * ровно четыре часа, и она приходится на начало суток.
 *
 * Замечено не глазами, а на фильтре по дате: «заведён с 6 сентября»
 * отбрасывал первые четыре часа шестого сентября.
 */
export const MARKET_TIME_ZONE = 'Asia/Tbilisi';

/**
 * Смещение того же пояса — для случаев, где нужен не показ, а ГРАНИЦА суток.
 *
 * Постоянное, потому что Грузия не переводит часы с 2005 года. Если это
 * когда-нибудь изменится, менять надо здесь и только здесь — и тогда
 * постоянного смещения станет мало, понадобится считать его на дату.
 */
export const MARKET_UTC_OFFSET = '+04:00';

export function formatDate(locale: Locale, value: Date): string {
  return new Intl.DateTimeFormat(INTL_TAG[locale], {
    dateStyle: 'medium',
    timeZone: MARKET_TIME_ZONE,
  }).format(value);
}

export function formatDateTime(locale: Locale, value: Date): string {
  return new Intl.DateTimeFormat(INTL_TAG[locale], {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: MARKET_TIME_ZONE,
  }).format(value);
}
