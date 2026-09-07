import { translate } from '@kleekto/i18n';
import type { Locale, MessageKey } from '@kleekto/i18n';

import type { ListingFacts } from './listing-text';

/**
 * Поля объекта в том порядке, в каком их спрашивает форма площадки.
 *
 * ЗАЧЕМ ПОРЯДОК. Агент переносит два десятка значений, глядя попеременно
 * в две вкладки. Если наш порядок свой, он каждый раз ищет глазами нужную
 * строку — а это и есть та беготня, ради которой всё затевалось. Порядок
 * взят из разбора формы myhome (`docs/analysis/publish-forms.md`,
 * 37 полей): место, адрес, кадастр, цена, площадь, этажи, балконы.
 * У ss.ge порядок тот же по существу.
 *
 * ЗНАЧЕНИЯ ГОТОВЫ К ВСТАВКЕ, И ЭТО ГЛАВНОЕ. Цена здесь `120000`, а не
 * «120 000 US$»: форма ждёт число, и разделитель разрядов вместе с валютой
 * она либо отвергнет, либо поймёт неправильно. Разделители тысяч в русской
 * и грузинской раскладке к тому же неразрывные пробелы — их не видно
 * глазом, а поле от них ломается молча.
 *
 * ПОДПИСИ ПЕРЕВОДЯТСЯ, ЗНАЧЕНИЯ — НЕТ. Подпись читает агент, значение
 * уходит в чужую форму как есть.
 */

export interface ListingField {
  /** Ключ подписи. Показывается на языке агента. */
  label: string;
  /** То, что уйдёт в поле формы. Без единиц, валют и разделителей. */
  value: string;
}

/** Число для вставки: без разделителей разрядов и без округления. */
function plain(value: number | null): string | null {
  if (value === null) return null;

  // `Number.toString` даёт «72» и «72.5» — ровно то, что примет форма.
  // Через `Intl` вышло бы «72,5» или «72 000» с неразрывным пробелом.
  return String(value);
}

export function listingFields(
  locale: Locale,
  facts: ListingFacts & { price: number | null; cadastralCode: string | null },
): ListingField[] {
  const t = (key: MessageKey): string => translate(locale, key);

  const rows: Array<[MessageKey, string | null]> = [
    ['property.districtLabel', facts.district],
    ['property.addressLabel', facts.addressRaw],
    ['property.cadastralCode', facts.cadastralCode],
    ['property.priceLabel', plain(facts.price)],
    ['property.areaLabel', plain(facts.areaTotal)],
    ['property.floorLabel', plain(facts.floor)],
    ['property.totalFloorsLabel', plain(facts.totalFloors)],
    ['property.roomsLabel', plain(facts.rooms)],
    ['property.bedrooms', plain(facts.bedrooms)],
    ['property.bathrooms', facts.bathrooms],
    ['property.balconies', plain(facts.balconies)],
    ['property.balconyArea', plain(facts.balconyArea)],
    ['property.houseArea', plain(facts.houseArea)],
    ['property.yardArea', plain(facts.yardArea)],
  ];

  /*
   * Пустое поле не показывается вовсе. Строка «Кадастровый код: —» ничего
   * не даёт: агент видит её, тянется скопировать и обнаруживает пустоту.
   * Правило 14 здесь работает и на интерфейс.
   */
  return rows.flatMap(([key, value]) =>
    value === null || value === '' ? [] : [{ label: t(key), value }],
  );
}
