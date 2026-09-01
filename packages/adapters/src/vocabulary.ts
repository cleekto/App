/**
 * Словарь типов недвижимости и сделок.
 *
 * ТРИ ЯЗЫКА, потому что площадки отдают одну и ту же страницу на грузинском,
 * английском и русском, а какой язык увидит агент — зависит от его настроек
 * в браузере, а не от нас. На myhome.ge это видно прямо в разметке: там есть
 * `hreflang` на все три версии одного объявления.
 *
 * Все разобранные фикстуры — грузинские, поэтому грузинские слова проверены
 * на реальных страницах, а русские и английские взяты из адресов языковых
 * версий и на живых страницах ещё не проверялись. Это отмечено в
 * `docs/analysis/source-ss-ge.md` как незакрытое место.
 */

export type PropertyTypeCode = 'APARTMENT' | 'HOUSE' | 'LAND' | 'COMMERCIAL';
export type TransactionTypeCode = 'SALE' | 'RENT';

/**
 * Порядок важен: коммерция проверяется раньше квартиры, потому что
 * «საოფისე ფართი» (офисная площадь) не должно опознаться как жильё.
 */
const PROPERTY_TYPES: ReadonlyArray<readonly [RegExp, PropertyTypeCode]> = [
  [/კომერციული|საოფისე|სავაჭრო|commercial|office|коммерч|офис/iu, 'COMMERCIAL'],
  [/მიწის\s*ნაკვეთი|მიწა|land|plot|участок|земл/iu, 'LAND'],
  [/კერძო\s*სახლი|სახლი|house|villa|cottage|дом|коттедж/iu, 'HOUSE'],
  [/ბინა|apartment|flat|квартир/iu, 'APARTMENT'],
];

export function detectPropertyType(text: string | null): PropertyTypeCode | null {
  if (text === null) return null;
  for (const [pattern, code] of PROPERTY_TYPES) {
    if (pattern.test(text)) return code;
  }
  // Незнакомый тип остаётся пустым. «Ближайшее похожее» здесь было бы
  // враньём в карточке объекта.
  return null;
}

const TRANSACTION_TYPES: ReadonlyArray<readonly [RegExp, TransactionTypeCode]> = [
  [/ქირავდება|for\s*rent|rental|аренд|сдаётся|сдается/iu, 'RENT'],
  [/იყიდება|for\s*sale|продаётся|продается|продажа/iu, 'SALE'],
];

export function detectTransactionType(text: string | null): TransactionTypeCode | null {
  if (text === null) return null;
  for (const [pattern, code] of TRANSACTION_TYPES) {
    if (pattern.test(text)) return code;
  }
  return null;
}

/**
 * Комнатность из заголовка: «3 ოთახიანი», «3-room», «3-комнатная».
 *
 * Нужна myhome.ge, где число комнат стоит в заголовке, а не отдельным полем.
 */
export function roomsFromTitle(text: string | null): number | null {
  if (text === null) return null;

  const match = /(\d+)\s*(?:ოთახიან|-?\s*room|-?\s*комнат)/iu.exec(text);
  if (match === null) return null;

  const rooms = Number.parseInt(match[1] as string, 10);
  return Number.isFinite(rooms) ? rooms : null;
}
