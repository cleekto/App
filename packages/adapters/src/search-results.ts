/**
 * Разбор СПИСКОВ объявлений — источник рабочей ленты.
 *
 * ЗАЧЕМ ОТДЕЛЬНО ОТ РАЗБОРА ОБЪЯВЛЕНИЯ. Страница объявления даёт всё и стоит
 * одного открытия человеком. Список даёт десяток карточек разом и открывается
 * агентом и так, много раз за день. Ни одного лишнего обращения к площадке
 * здесь не происходит: читается то, что браузер уже загрузил.
 *
 * ПОЧЕМУ НЕЛЬЗЯ ПРОСТО ЧИТАТЬ `__NEXT_DATA__`. Проверено на сохранённых
 * страницах: после перехода внутри сайта этот блок остаётся от ПРЕДЫДУЩЕЙ
 * страницы. У ss.ge на странице списка `/ka/udzravi-qoneba/l/bina/iyideba`
 * в нём лежало `page: "/real-estate/[slug]"` с карточкой ранее открытого
 * объявления; у myhome два сохранённых списка — продажа и аренда — оба
 * содержали данные аренды. Агент листает выдачу переходами, а не
 * перезагрузками, поэтому разбор одного `__NEXT_DATA__` собирал бы вчерашнее.
 *
 * Отсюда две точки входа:
 *   `searchHarvest`   — разбор `__NEXT_DATA__` при обычной загрузке страницы,
 *                       с ПРОВЕРКОЙ, что данные относятся к текущему адресу;
 *   `harvestPayload`  — разбор ответа, который страница получила сама
 *                       (перехват в расширении). Он всегда свежий.
 *
 * ТЕЛЕФОНОВ ОТСЮДА НЕ БЕРЁТСЯ НИ ОДНОГО. В списках их нет, но правило важнее
 * факта: телефон собственника попадает в систему только после того, как агент
 * сам открыл объявление и раскрыл номер (правило 11).
 */

import { detectPropertyType, detectTransactionType } from './vocabulary';
import type { PropertyTypeCode, TransactionTypeCode } from './vocabulary';

/** Одна карточка из списка. Всё необязательное: площадка отдаёт по-разному. */
export interface SearchCard {
  /** Номер объявления на площадке. */
  externalId: string;
  /** Адрес объявления. По нему агент и уходит на площадку. */
  url: string;
  price: number | null;
  currency: string | null;
  area: number | null;
  rooms: number | null;
  floor: number | null;
  totalFloors: number | null;
  district: string | null;
  propertyType: PropertyTypeCode | null;
  transactionType: TransactionTypeCode | null;
  /** Маленькое фото с самой площадки: строка ленты без него выглядит пустой. */
  thumbnailUrl: string | null;

  /** Идентификатор продавца на площадке. Ключ, по которому копится знание. */
  sellerExternalId: string | null;
  sellerName: string | null;
  /** Тип продавца, если площадка его назвала. `null` — выяснится позже. */
  sellerKind: 'owner' | 'agency' | null;
}

export interface SearchHarvest {
  source: 'SS_GE' | 'MYHOME_GE';
  cards: SearchCard[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Мелочи разбора чужих данных
// ─────────────────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/\s/gu, '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean === '' ? null : clean;
}

/** Спуск по вложенным ключам без проверки на каждом уровне. */
function at(value: unknown, path: readonly string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

// ─────────────────────────────────────────────────────────────────────────────
// myhome.ge
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Валюты myhome — числовые коды.
 *
 * Установлено по самим данным: у одного объявления `{1: 900, 2: 344, 3: 296}`,
 * и 900/344 — курс лари к доллару, 344/296 — доллара к евро. Ни в каком
 * справочнике этого не написано, поэтому здесь и записано.
 */
const MYHOME_CURRENCY: Readonly<Record<string, string>> = {
  '1': 'GEL',
  '2': 'USD',
  '3': 'EUR',
};

/** Адрес объявления myhome: канонический, грузинский. */
const MYHOME_ORIGIN = 'https://www.myhome.ge';
const MYHOME_PATH = '/udzravi-qoneba/';

/**
 * Цена из карты валют.
 *
 * Берём доллар: он есть у каждого объявления, и только в нём цены разных
 * объявлений сравнимы между собой. Лари остаётся запасным вариантом.
 */
function myhomePrice(value: unknown): { price: number | null; currency: string | null } {
  if (!isRecord(value)) return { price: null, currency: null };

  for (const code of ['2', '1', '3']) {
    const entry = value[code];
    const total = num(at(entry, ['price_total']));
    if (total !== null) return { price: total, currency: MYHOME_CURRENCY[code] ?? null };
  }
  return { price: null, currency: null };
}

/**
 * Одна карточка myhome.
 *
 * Разобрано по сохранённым страницам списка (`["statements","list"]`
 * в `dehydratedState`), а не по документации, которой нет.
 */
function myhomeCard(raw: unknown): SearchCard[] {
  if (!isRecord(raw)) return [];

  const id = num(raw['id']);
  if (id === null) return [];

  const slug = text(raw['dynamic_slug']);
  const title = text(raw['dynamic_title']);
  const { price, currency } = myhomePrice(raw['price']);

  const images = raw['images'];
  const main = Array.isArray(images)
    ? (images.find((image) => isRecord(image) && image['is_main'] === true) ?? images[0])
    : null;

  const kind = raw['user_type'];
  const kindText = isRecord(kind) ? text(kind['type']) : null;

  return [
    {
      externalId: String(id),
      // Канонический адрес — тот, что стоит в `<link rel="canonical">`
      // на самой странице объявления. Проверено на сохранённой странице.
      url:
        slug === null
          ? `${MYHOME_ORIGIN}${MYHOME_PATH}${String(id)}`
          : `${MYHOME_ORIGIN}${MYHOME_PATH}${slug}-${String(id)}`,
      price,
      currency,
      area: num(raw['area']),
      rooms: num(raw['room']),
      floor: num(raw['floor']),
      totalFloors: num(raw['total_floors']),
      district: text(raw['urban_name']) ?? text(raw['district_name']),
      /*
       * Тип и сделка — ИЗ ЗАГОЛОВКА, а не из числовых `deal_type_id`
       * и `real_estate_type_id`. Числа площадка не расшифровывает, а на
       * сохранённых страницах встретилось единственное значение: по одному
       * примеру справочник не составляют (правило 14). Заголовок же написан
       * теми же грузинскими словами, которые словарь адаптеров уже понимает.
       */
      propertyType: detectPropertyType(title),
      transactionType: detectTransactionType(title),
      thumbnailUrl: isRecord(main) ? (text(main['thumb']) ?? text(main['large'])) : null,
      sellerExternalId: num(raw['user_id']) === null ? null : String(num(raw['user_id'])),
      sellerName: text(raw['user_title']),
      /*
       * `physical` — собственник, всё прочее (`broker`, `agent`) — посредник.
       * Различать посредников между собой агенту незачем: важно лишь, что
       * говорить придётся не с собственником.
       */
      sellerKind: kindText === null ? null : kindText === 'physical' ? 'owner' : 'agency',
    },
  ];
}

/**
 * Список myhome из `pageProps` — хоть из `__NEXT_DATA__`, хоть из ответа
 * `/_next/data/…`, который страница запросила при переходе. Форма одна и та же,
 * потому что это одна и та же величина Next.js.
 */
function myhomeFromPageProps(pageProps: unknown): SearchCard[] | null {
  const queries = at(pageProps, ['dehydratedState', 'queries']);
  if (!Array.isArray(queries)) return null;

  const lists = queries.filter((query) => {
    const key = at(query, ['queryKey']);
    return Array.isArray(key) && key[0] === 'statements' && key[1] === 'list';
  });
  if (lists.length === 0) return null;

  return lists.flatMap((query) => {
    const items = at(query, ['state', 'data', 'data', 'data']);
    return Array.isArray(items) ? items.flatMap(myhomeCard) : [];
  });
}

/**
 * Ответ собственного API myhome — то, что страница получает при смене
 * фильтра или страницы, уже без участия Next.js.
 *
 * Опознаётся ПО ФОРМЕ, а не по адресу: `{ result, data: { data: [...] } }`
 * с карточками внутри. Адрес и версия API площадки могут смениться в любой
 * день, форма ответа — редко, а привязка к адресу ломается молча.
 */
function myhomeFromApi(payload: unknown): SearchCard[] | null {
  const items = at(payload, ['data', 'data']);
  if (!Array.isArray(items) || items.length === 0) return null;

  // Карточка списка обязана иметь номер и тип продавца: иначе это другой
  // ответ той же формы, и трогать его не надо.
  const first = items[0];
  if (!isRecord(first) || first['id'] === undefined || first['user_type'] === undefined) {
    return null;
  }

  return items.flatMap(myhomeCard);
}

// ─────────────────────────────────────────────────────────────────────────────
// Точки входа
// ─────────────────────────────────────────────────────────────────────────────

function nextData(document: Document): Record<string, unknown> | null {
  const node = document.querySelector('#__NEXT_DATA__');
  if (node === null || node.textContent === null) return null;

  try {
    const parsed: unknown = JSON.parse(node.textContent);
    return isRecord(parsed) ? parsed : null;
  } catch {
    /*
     * Разметка сменилась — молча ничего не собираем. Ронять страницу агента
     * из-за нашего сбора нельзя: он пришёл работать, а не отлаживать нас.
     */
    return null;
  }
}

/**
 * Сбор со страницы, загруженной обычным способом.
 *
 * ПРОВЕРКА СВЕЖЕСТИ ОБЯЗАТЕЛЬНА. `__NEXT_DATA__` после перехода внутри сайта
 * остаётся от предыдущей страницы, и без сверки мы записали бы объявления
 * из чужой выдачи как увиденные сейчас. Сверяем по маршруту: у списка myhome
 * `page: "/[...slug]"` и в `query` лежат фильтры выдачи, а у объявления —
 * `statementId`.
 */
export function searchHarvest(document: Document, url: string): SearchHarvest | null {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }

  if (!host.endsWith('myhome.ge')) {
    /*
     * ss.ge СЮДА ПОКА НЕ ВХОДИТ, и это осознанно.
     *
     * На его странице списка `__NEXT_DATA__` содержал данные ранее открытого
     * ОБЪЯВЛЕНИЯ, а в разметке нашлось лишь двенадцать ссылок на объявления
     * из полусотни показанных. Ни того, ни другого не хватает, чтобы собирать
     * ленту честно, а придумывать структуру страницы запрещено (правило 2).
     *
     * Продавцы ss.ge при этом узнаются полностью — со страниц объявлений,
     * которые агент открывает сам: там есть и `userId`, и `userEntityType`.
     */
    return null;
  }

  const data = nextData(document);
  if (data === null) return null;

  // Список — только если страница действительно список: у объявления
  // в `pageProps` лежит `statementId`, и его данные к выдаче не относятся.
  const pageProps = at(data, ['props', 'pageProps']);
  if (isRecord(pageProps) && pageProps['statementId'] !== undefined) return null;

  const cards = myhomeFromPageProps(pageProps);
  return cards === null ? null : { source: 'MYHOME_GE', cards };
}

/**
 * Сбор из ответа, который страница получила сама.
 *
 * Расширение слушает ответы страницы и отдаёт их сюда. Опознание идёт
 * по форме: сначала `pageProps` перехода Next.js, затем ответ собственного
 * API площадки. Не подошло ни то, ни другое — значит, это не наш ответ.
 */
export function harvestPayload(payload: unknown): SearchHarvest | null {
  const viaPageProps = myhomeFromPageProps(at(payload, ['pageProps']));
  if (viaPageProps !== null && viaPageProps.length > 0) {
    return { source: 'MYHOME_GE', cards: viaPageProps };
  }

  const viaApi = myhomeFromApi(payload);
  if (viaApi !== null && viaApi.length > 0) return { source: 'MYHOME_GE', cards: viaApi };

  return null;
}
