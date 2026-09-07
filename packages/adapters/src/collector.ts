/**
 * Сборщик: чтение страниц площадок с сервера.
 *
 * ЗАЧЕМ ОН ЕСТЬ. Лента, которую наполняют браузеры агентов, показывает им то,
 * что они и так открыли, — то есть не работает. Агент должен утром включить
 * компьютер, открыть kleekTo и увидеть свежие объявления, ни разу не зайдя
 * на площадку. Другого источника, кроме нашего собственного запроса, для
 * этого нет: либо браузер агента, либо мы.
 *
 * ЧТО ПРОВЕРЕНО ПЕРЕД ТЕМ, КАК ЭТО ПИСАТЬ (2026-09-07)
 *
 *   `robots.txt` обеих площадок разрешает ровно те страницы, которые нужны:
 *   у ss.ge закрыты только `/ka|en|ru/user`, у myhome стоит явный
 *   `Allow: /udzravi-qoneba/*`, а закрыты профили маклеров, которые нам
 *   не нужны. Правовая сторона чтения закрыта решением владельца,
 *   `ADR-0010`: у ss.ge опубликованных условий нет вовсе, в условиях TNET
 *   запрета на роботов нет.
 *
 *   Один обычный запрос к каждой площадке вернул полный список: 20 карточек
 *   у myhome (с типом продавца), 16 у ss.ge. Ни капчи, ни входа, ни проверки
 *   браузера.
 *
 * DOM ЗДЕСЬ НЕ НУЖЕН, и это не мелочь: `linkedom` — зависимость только
 * для тестов, а тянуть разбор целой разметки в рабочий путь ради одного
 * блока данных было бы расточительно. Читается ровно `__NEXT_DATA__`.
 *
 * ТЕЛЕФОНОВ СБОРЩИК НЕ БЕРЁТ. В списках их нет, а со страницы объявления
 * он читает единственное поле — тип продавца (правило 11 остаётся в силе:
 * оно держится не на риске блокировки, а на дедупликации).
 */

import { harvestPayload, type SearchHarvest } from './search-results';

/**
 * Блок данных Next.js в разметке.
 *
 * Next.js экранирует `<` внутри строк как `<`, поэтому первый же
 * `</script>` действительно закрывает блок, и нежадный поиск безопасен.
 */
const NEXT_DATA = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/u;

/** Что показывает страница списка, когда её открывают из браузера. */
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

/** Долго не ждём: страница либо отвечает быстро, либо не отвечает. */
const TIMEOUT_MS = 20_000;

export interface CollectorPage {
  source: 'SS_GE' | 'MYHOME_GE';
  url: string;
}

/**
 * Страницы, которые сборщик читает по кругу.
 *
 * Только первые страницы списков — дальше первой ходить незачем: объявление,
 * упавшее на вторую, уже не новое. Категории выбраны по тому, чем работают
 * агентства: жильё и участки, продажа и аренда.
 *
 * MYHOME.GE ЗДЕСЬ НЕТ, И ЭТО НЕ ЗАБЫВЧИВОСТЬ.
 *
 * Он стоит за Cloudflare: программному клиенту вместо страницы приходит
 * «Just a moment…» и код 403 — проверено прогоном, три страницы из трёх.
 * Обходить этот заслон мы не будем. Не только потому, что это обход защиты,
 * а потому, что он бессмысленно дорог: настойчивый клиент, который долбит
 * проверку каждый час, — первое, что площадка блокирует насовсем, и первое,
 * что всплывёт в разговоре о доступе к API.
 *
 * По myhome остаётся расширение: браузер агента проходит проверку сам,
 * потому что он и есть браузер. Как только появится API — сюда вернутся
 * три строки, и всё остальное уже готово.
 *
 * Адреса ss.ge выведены из тех, что открывал владелец, и проверены прогоном:
 * четыре страницы, 64 карточки, 50 новых объявлений.
 */
export const COLLECTOR_PAGES: readonly CollectorPage[] = [
  { source: 'SS_GE', url: 'https://home.ss.ge/ka/udzravi-qoneba/l/bina/iyideba' },
  { source: 'SS_GE', url: 'https://home.ss.ge/ka/udzravi-qoneba/l/bina/qiravdeba' },
  { source: 'SS_GE', url: 'https://home.ss.ge/ka/udzravi-qoneba/l/saxli/iyideba' },
  { source: 'SS_GE', url: 'https://home.ss.ge/ka/udzravi-qoneba/l/mitsis-nakveti/iyideba' },
];

/**
 * Разбор скачанной разметки — без DOM.
 *
 * Адреса на входе нет намеренно: страница скачана запросом по конкретному
 * адресу, переходов внутри сайта — из-за которых `__NEXT_DATA__` устаревает —
 * тут не бывает по построению. Сверять нечего и не с чем.
 */
export function harvestHtml(html: string): SearchHarvest | null {
  const match = NEXT_DATA.exec(html);
  if (match?.[1] === undefined) return null;

  let root: unknown;
  try {
    root = JSON.parse(match[1]);
  } catch {
    return null;
  }

  // Пустой ответ — не ошибка: у категории может не оказаться объявлений,
  // и молчание тут честнее выдуманного результата.
  return harvestPayload((root as { props?: unknown }).props);
}

export interface FetchOutcome {
  url: string;
  status: number | null;
  harvest: SearchHarvest | null;
  /** Короткая причина, по которой ничего не вышло. Для журнала, не агенту. */
  failure: string | null;
}

/**
 * Скачать и разобрать одну страницу списка.
 *
 * Обращение ровно одно, повторов нет. Сборщик работает по кругу: не вышло
 * сейчас — выйдет через несколько минут, и настойчивость тут вредна.
 */
export async function fetchListPage(
  page: CollectorPage,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<FetchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetchImpl(page.url, {
      signal: controller.signal,
      headers: {
        // Обычный браузерный набор. Площадки отдают список именно на такой
        // запрос — проверено; клиент, представляющийся иначе, получает 403.
        'user-agent': BROWSER_UA,
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'ka,en;q=0.9,ru;q=0.8',
      },
    });

    if (!response.ok) {
      return { url: page.url, status: response.status, harvest: null, failure: 'status' };
    }

    const html = await response.text();
    const harvest = harvestHtml(html);

    return {
      url: page.url,
      status: response.status,
      harvest,
      failure: harvest === null ? 'parse' : null,
    };
  } catch (error) {
    return {
      url: page.url,
      status: null,
      harvest: null,
      failure: error instanceof Error ? error.name : 'unknown',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Тип продавца со страницы объявления ss.ge — И БОЛЬШЕ НИЧЕГО.
 *
 * ЭТО САМОЕ ЧУВСТВИТЕЛЬНОЕ МЕСТО СБОРЩИКА, и написано оно нарочно узко.
 * В списке ss.ge тип продавца не виден: частный маклер там неотличим
 * от собственника, и без этого запроса лента собственников по ss.ge пуста.
 * Но на той же странице лежит телефон собственника — ДО того, как человек
 * нажал «показать номер».
 *
 * Поэтому функция возвращает `'owner' | 'agency' | null` и физически не может
 * вернуть ничего другого: она читает одно поле, `userEntityType`. Телефон
 * не разбирается, не передаётся дальше и в базу не попадает. Проверяется
 * тестом, который падает, если номер просочится.
 *
 * Одного такого запроса хватает на ВСЕ объявления продавца — прошлые
 * и будущие. Поэтому их десятки в день, а не тысячи.
 */
export function sellerKindFromListingHtml(html: string): 'owner' | 'agency' | null {
  const match = NEXT_DATA.exec(html);
  if (match?.[1] === undefined) return null;

  let root: unknown;
  try {
    root = JSON.parse(match[1]);
  } catch {
    return null;
  }

  const app = dig(root, ['props', 'pageProps', 'applicationData']);
  if (typeof app !== 'object' || app === null) return null;

  const entity = (app as Record<string, unknown>)['userEntityType'];
  if (typeof entity !== 'string' || entity.trim() === '') return null;

  // `Individual` — частное лицо. Всё прочее (агентство, застройщик, брокер) —
  // посредник: различать их между собой агенту незачем.
  return entity === 'Individual' ? 'owner' : 'agency';
}

/** Скачать страницу объявления и узнать по ней тип продавца. */
export async function fetchSellerKind(
  listingUrl: string,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<'owner' | 'agency' | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetchImpl(listingUrl, {
      signal: controller.signal,
      headers: {
        'user-agent': BROWSER_UA,
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'ka,en;q=0.9,ru;q=0.8',
      },
    });
    if (!response.ok) return null;

    return sellerKindFromListingHtml(await response.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function dig(value: unknown, path: readonly string[]): unknown {
  let current = value;
  for (const key of path) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
