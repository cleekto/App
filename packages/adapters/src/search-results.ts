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
 * Та же страница ss.ge, сохранённая ОБЫЧНОЙ ЗАГРУЗКОЙ, содержит и список
 * из шестнадцати карточек, и собственный адрес в `pageProps.fullUrl` —
 * по нему свежесть и проверяется, без догадок.
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

import { detectPropertyType, detectTransactionType, roomsFromTitle } from './vocabulary';
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

  /**
   * Когда объявление появилось на площадке — ПО ЕЁ СОБСТВЕННЫМ ДАННЫМ.
   *
   * Смысл у площадок разный, и путать их нельзя: у ss.ge это `createDate`,
   * настоящая дата публикации; у myhome — `last_updated`, дата последнего
   * изменения, потому что даты публикации myhome не отдаёт вовсе.
   *
   * ISO-строка либо `null`. Ради этого поля сборщик и нужен: сам ss.ge
   * сортирует выдачу по времени «поднятия», и наверху у него висят
   * объявления трёхлетней давности.
   */
  publishedAt: string | null;

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

/**
 * Дата площадки без пояса — во время рынка.
 *
 * myhome отдаёт «2026-09-06 00:41:32». Разобрать это как UTC значило бы
 * сдвинуть каждое объявление на четыре часа назад, и полоса «новые»
 * перестала бы быть новой.
 */
function marketTime(value: string | null): string | null {
  if (value === null) return null;

  const parsed = new Date(`${value.replace(' ', 'T')}+04:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
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
      /*
       * Даты публикации myhome не отдаёт — только `last_updated`. Формат
       * «2026-09-06 00:41:32», без пояса; читаем его как время рынка
       * (+04:00), а не как UTC: иначе всё уезжало бы на четыре часа.
       */
      publishedAt: marketTime(text(raw['last_updated'])),
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
// ss.ge
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Адрес объявления ss.ge.
 *
 * Слаг из `detailUrl` подставляется сюда без изменений: проверено на
 * одиннадцати сохранённых страницах — `<link rel="canonical">` каждой из них
 * равен ровно этой склейке.
 */
const SS_ORIGIN = 'https://home.ss.ge';
const SS_PATH = '/ka/udzravi-qoneba/';

/**
 * Одна карточка выдачи ss.ge.
 *
 * Разобрано по странице `home.ss.ge/ka/udzravi-qoneba/l/bina/iyideba`,
 * сохранённой обычной загрузкой (16 карточек).
 */
function ssCard(raw: unknown): SearchCard[] {
  if (!isRecord(raw)) return [];

  const id = num(raw['applicationId']);
  const slug = text(raw['detailUrl']);
  if (id === null || slug === null) return [];

  const title = text(raw['title']) ?? text(raw['shortTitle']);
  const address = isRecord(raw['address']) ? raw['address'] : {};
  const price = isRecord(raw['price']) ? raw['price'] : {};

  const images = raw['appImages'];
  const main = Array.isArray(images)
    ? (images.find((image) => isRecord(image) && image['isMain'] === true) ?? images[0])
    : null;

  /*
   * `userInfo` заполнен — ТОЧНО посредник: там название агентства с брендом.
   * Пустой не означает собственника, и это не осторожность, а факт: в этой же
   * выдаче лежит объявление 35756896 с `userInfo: null`, а на его странице
   * стоит `userEntityType: "Broker"`. Поэтому здесь `null` — «не выяснено»,
   * и выясняется оно по продавцу, когда агент откроет любое его объявление.
   */
  const seller = isRecord(raw['userInfo']) ? raw['userInfo'] : null;

  const usd = num(price['priceUsd']);
  const gel = num(price['priceGeo']);

  return [
    {
      externalId: String(id),
      url: `${SS_ORIGIN}${SS_PATH}${slug}`,
      // Доллар первым: в нём цены разных объявлений сравнимы между собой.
      price: usd ?? gel,
      currency: usd === null ? (gel === null ? null : 'GEL') : 'USD',
      area: num(raw['totalArea']),
      /*
       * КОМНАТЫ — ИЗ ЗАГОЛОВКА, А НЕ ИЗ `numberOfBedrooms`.
       *
       * Это разные величины, и путать их нельзя: у «იყიდება 2 ოთახიანი ბინა»
       * (двухкомнатная) в данных стоит `numberOfBedrooms: 1`. Спальня —
       * не комната, и агент, ищущий двушку, по такому числу её не нашёл бы.
       */
      rooms: roomsFromTitle(title),
      floor: num(raw['floorNumber']),
      totalFloors: num(raw['totalAmountOfFloor']),
      district: text(address['subdistrictTitle']) ?? text(address['districtTitle']),
      propertyType: detectPropertyType(title),
      transactionType: detectTransactionType(title),
      thumbnailUrl: isRecord(main) ? text(main['fileName']) : null,
      /*
       * `createDate` — публикация, `orderDate` — «поднятие». Берём первое,
       * и в этом весь смысл: сам сайт сортирует по второму, поэтому наверху
       * его выдачи висит объявление, созданное в 2023 году.
       */
      publishedAt: text(raw['createDate']),
      sellerExternalId: text(raw['userId']),
      sellerName: seller === null ? null : text(seller['name']),
      sellerKind: seller === null ? null : 'agency',
    },
  ];
}

/**
 * Список ss.ge из `pageProps` — из разметки или из ответа перехода Next.js.
 */
function ssFromPageProps(pageProps: unknown): SearchCard[] | null {
  const items = at(pageProps, ['applicationList', 'realStateItemModel']);
  if (!Array.isArray(items) || items.length === 0) return null;

  return items.flatMap(ssCard);
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

/** Путь адреса без завершающего слэша: по нему и сверяем свежесть. */
function pathOf(url: string): string | null {
  try {
    return new URL(url).pathname.replace(/\/+$/u, '');
  } catch {
    return null;
  }
}

/**
 * Сбор со страницы, загруженной обычным способом.
 *
 * ПРОВЕРКА СВЕЖЕСТИ ОБЯЗАТЕЛЬНА. `__NEXT_DATA__` после перехода внутри сайта
 * остаётся от предыдущей страницы, и без сверки мы записали бы чужую выдачу
 * как увиденную сейчас.
 *
 * У ss.ge проверка точная: страница сама называет свой адрес в
 * `pageProps.fullUrl`, и достаточно сверить его с тем, где мы находимся.
 * У myhome такого поля нет, поэтому там признак косвенный — `statementId`,
 * который есть только у страницы объявления.
 */
export function searchHarvest(document: Document, url: string): SearchHarvest | null {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }

  const data = nextData(document);
  if (data === null) return null;
  const pageProps = at(data, ['props', 'pageProps']);

  if (host.endsWith('ss.ge')) {
    /*
     * Сверка по собственному адресу страницы. Именно так ловится случай,
     * из-за которого разбор ss.ge пришлось отложить в прошлый раз: там
     * `fullUrl` отсутствовал вовсе, а рядом лежал `applicationData`
     * ранее открытого объявления.
     */
    const declared = isRecord(pageProps) ? text(pageProps['fullUrl']) : null;
    if (declared === null || pathOf(declared) !== pathOf(url)) return null;

    const cards = ssFromPageProps(pageProps);
    return cards === null ? null : { source: 'SS_GE', cards };
  }

  if (!host.endsWith('myhome.ge')) return null;

  // Список — только если страница действительно список: у объявления
  // в `pageProps` лежит `statementId`, и его данные к выдаче не относятся.
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
  const myhomePage = myhomeFromPageProps(at(payload, ['pageProps']));
  if (myhomePage !== null && myhomePage.length > 0) {
    return { source: 'MYHOME_GE', cards: myhomePage };
  }

  const myhomeApi = myhomeFromApi(payload);
  if (myhomeApi !== null && myhomeApi.length > 0) return { source: 'MYHOME_GE', cards: myhomeApi };

  /*
   * ss.ge: список лежит под `applicationList.realStateItemModel` — и в ответе
   * перехода Next.js (внутри `pageProps`), и, если площадка ответит своим
   * API той же формой, прямо в корне. Проверяются оба вложения, потому что
   * различать их по адресу означало бы привязаться к тому, что меняется.
   */
  const ss = ssFromPageProps(at(payload, ['pageProps'])) ?? ssFromPageProps(payload);
  if (ss !== null && ss.length > 0) return { source: 'SS_GE', cards: ss };

  return null;
}
