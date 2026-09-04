import { at, flag, int, isRecord, nextData, num, text, fromDictionary } from './payload';
import type { PayloadFacts } from './ss-ge-payload';

/**
 * Разбор объявления myhome.ge из данных страницы.
 *
 * Данные лежат глубже, чем у ss.ge: страница отдаёт состояние react-query,
 * и объявление надо найти среди запросов по ключу. Форма другая, смысл тот же.
 *
 * ТЕЛЕФОН ОТСЮДА НЕ БЕРЁТСЯ. У myhome он и так замаскирован до раскрытия
 * (`######***`), но полагаться на это нельзя: маску снимут — и правило 11
 * нарушится молча. Номер читается только из раскрытой разметки.
 */

/**
 * Числовые коды площадки расшифровываются ЕЁ ЖЕ СЛОВАРЁМ.
 *
 * Тип проекта и санузел приходят числами, а таблица значений лежит в той же
 * странице, по языкам. Придумывать, что «8» — это «нестандартный», нельзя
 * (правило 2); показывать агенту цифру — бессмысленно.
 */
function dictionaries(root: Record<string, unknown> | null): Record<string, unknown> {
  const store = at(root, ['props', 'pageProps', '_nextI18Next', 'initialI18nStore']);
  if (!isRecord(store)) return {};

  // Язык словаря значения не имеет: коды одни и те же, а показываем мы то,
  // что отдала площадка. Берётся первый доступный.
  for (const bundle of Object.values(store)) {
    const params = at(bundle, ['filter-parameters']);
    if (isRecord(params)) return params;
  }

  return {};
}

function statement(root: Record<string, unknown> | null): Record<string, unknown> | null {
  const queries = at(root, ['props', 'pageProps', 'dehydratedState', 'queries']);
  if (!Array.isArray(queries)) return null;

  for (const query of queries) {
    if (!isRecord(query)) continue;
    if (!JSON.stringify(query['queryKey'] ?? null).includes('details')) continue;

    const found = at(query, ['state', 'data', 'data', 'statement']);
    if (isRecord(found)) return found;
  }

  return null;
}

export function myhomePayloadFacts(document: Document): PayloadFacts | null {
  const root = nextData(document);
  const listing = statement(root);
  if (listing === null) return null;

  const dict = dictionaries(root);

  return {
    externalId: text(listing['id']),
    title: text(listing['dynamic_title']),

    area: num(listing['area']),
    // `room_type_id` и `bedroom_type_id` — не коды справочника, а количество:
    // проверено на фикстурах, где «3 ოთახიანი» даёт ровно 3.
    rooms: int(listing['room_type_id']),
    bedrooms: int(listing['bedroom_type_id']),
    floor: int(listing['floor']),
    totalFloors: int(listing['total_floors']),

    district: text(listing['urban_name']) ?? text(listing['district_name']),
    address: text(listing['address']),
    description: text(listing['comment']),
    photos: photos(listing['images']),

    bathrooms: fromDictionary(dict['bathroom_types'], listing['bathroom_type_id']),
    balconies: int(listing['balconies']),
    balconyArea: num(listing['balcony_area']),
    // Площадь дома и статус дома myhome отдельно не отдаёт — в отличие от ss.ge.
    houseArea: null,
    buildingStatus: null,
    yardArea: num(listing['yard_area']),
    condition: text(listing['condition']),
    projectType: fromDictionary(dict['project_types'], listing['project_type_id']),
    cadastralCode: text(listing['rs_code']),
    sellerKind: sellerKind(listing),

    ownerName: text(listing['owner_name']),
  };
}

/**
 * Цена в валюте объявления.
 *
 * `price` содержит сумму сразу в трёх валютах, а `total_price` — ту, в которой
 * объявление подано. Валюту определяет заголовок, как и у ss.ge: там знак,
 * который видит человек. Соответствие кодов (1 — лари, 2 — доллар, 3 — евро)
 * выведено из самих данных: на объявлении за 650 $ те же три числа стоят
 * как 1702, 650 и 560.
 */
export function myhomePayloadPrice(
  document: Document,
  currency: string | null,
): { price: number | null; currency: string | null } {
  const listing = statement(nextData(document));
  if (listing === null) return { price: null, currency };

  const total = num(listing['total_price']);
  if (currency !== null) return { price: total, currency };

  const byId: Record<string, string> = { '1': 'GEL', '2': 'USD', '3': 'EUR' };
  const code = text(listing['currency_id']);

  return { price: total, currency: code === null ? null : (byId[code] ?? null) };
}

/**
 * Фотографии — полного размера и все.
 *
 * У каждой три адреса: `large`, `thumb`, `blur`. Разбор разметки брал из
 * галереи то, что там загружено, а загружено в полном размере только открытое
 * фото — отсюда и была жалоба на мелкие снимки.
 */
function photos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const items = value
    .filter(isRecord)
    .map((image) => ({ url: text(image['large']), isMain: flag(image['is_main']) ?? false }))
    .filter((image): image is { url: string; isMain: boolean } => image.url !== null);

  items.sort((a, b) => Number(b.isMain) - Number(a.isMain));

  return [...new Set(items.map((image) => image.url))];
}

/**
 * Собственник или посредник.
 *
 * `physical` — частное лицо; `broker` и всё прочее — посредник. Рядом лежит
 * ещё и число объявлений продавца: пятьдесят объявлений у «частного лица»
 * говорят сами за себя, но такого поля в контракте нет, и выводить из него
 * признак самостоятельно значило бы гадать.
 */
function sellerKind(listing: Record<string, unknown>): 'owner' | 'agency' | null {
  const kind = text(at(listing, ['user_type', 'type']));
  if (kind === null) return null;

  return kind === 'physical' ? 'owner' : 'agency';
}
