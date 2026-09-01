/**
 * Адаптеры площадок.
 *
 * ИНВАРИАНТ 6: всё, что знает про ss.ge и myhome.ge, живёт здесь и только
 * здесь. Ядро этот пакет не импортирует — попытка уронит линтер.
 *
 * Пакет отдельный, а не часть расширения, ради тестируемости: адаптеры
 * проверяются на сохранённых страницах в Node, без Chrome (требование G16).
 */

export * from './types';
export * from './shared';
export * from './vocabulary';
export * from './form-fill';
export * from './publish-types';
export { SsGeAdapter } from './ss-ge';
export { MyhomeAdapter } from './myhome-ge';

import { MyhomeAdapter } from './myhome-ge';
import { SsGeAdapter } from './ss-ge';
import type { ListingSourceAdapter } from './types';

/** Все адаптеры чтения. Порядок значения не имеет: выбор идёт по `canHandle`. */
export const READ_ADAPTERS: readonly ListingSourceAdapter[] = [
  new SsGeAdapter(),
  new MyhomeAdapter(),
];

/**
 * Адаптер для адреса страницы либо `null`.
 *
 * `null` — нормальный исход: агент открыл сайт, который мы не поддерживаем.
 * Это не ошибка, и падать здесь нечему.
 */
export function adapterFor(url: string): ListingSourceAdapter | null {
  return READ_ADAPTERS.find((adapter) => adapter.canHandle(url)) ?? null;
}
