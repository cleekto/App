import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { FIXTURE_ROOT } from './fixtures';
import { harvestPayload, searchHarvest } from './search-results';
import type { SearchHarvest } from './search-results';

/**
 * Разбор списков объявлений — источник рабочей ленты.
 *
 * Формы данных здесь взяты с сохранённых страниц myhome.ge, но собраны
 * заново, без чужих имён и адресов (правило 10). Проверяется наш разбор,
 * а не содержимое чужой базы.
 *
 * Отдельно, если сохранённые страницы на месте, тот же разбор прогоняется
 * по ним: синтетическая форма доказывает, что код делает, что задумано,
 * а живая страница — что задумано было верно.
 */

/** Карточка списка myhome в том виде, в каком её отдаёт площадка. */
function card(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 11111111,
    dynamic_slug: 'iyideba-2-otaxiani-bina-vakeshi',
    dynamic_title: 'იყიდება 2 ოთახიანი ბინა ვაკეში',
    area: 56,
    room: '2',
    floor: 3,
    total_floors: 9,
    district_name: 'ვაკე-საბურთალო',
    urban_name: 'ვაკე',
    price: {
      '1': { price_total: 261_000, price_square: 4661 },
      '2': { price_total: 100_000, price_square: 1786 },
      '3': { price_total: 86_000, price_square: 1536 },
    },
    images: [
      { large: 'https://example.invalid/a.webp', thumb: 'https://example.invalid/a_t.webp' },
      {
        large: 'https://example.invalid/b.webp',
        thumb: 'https://example.invalid/b_t.webp',
        is_main: true,
      },
    ],
    user_id: 4242,
    user_title: 'ნინო',
    user_type: { type: 'physical', logo: null, is_premier_agent: null },
    ...over,
  };
}

/** Карточка выдачи ss.ge в том виде, в каком её отдаёт площадка. */
function ssCard(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    applicationId: 36645610,
    detailUrl: 'iyideba-2-otaxiani-bina-ximshiashvilis-ubanshi-36645610',
    title: 'იყიდება 2 ოთახიანი ბინა ბათუმში',
    shortTitle: 'იყიდება ბინა',
    totalArea: 48,
    // Спальня — не комната: у двухкомнатной здесь стоит единица.
    numberOfBedrooms: 1,
    floorNumber: '9',
    totalAmountOfFloor: 41,
    address: {
      cityTitle: 'ბათუმი',
      districtTitle: 'ბათუმის უბნები',
      subdistrictTitle: 'ხიმშიაშვილის უბანი',
      streetTitle: 'ხიმშიაშვილის ქ.',
      streetNumber: '5',
    },
    price: { priceGeo: 340_000, priceUsd: 130_000, currencyType: 2 },
    appImages: [
      { fileName: 'https://example.invalid/second.jpg', isMain: false, orderNo: 1 },
      { fileName: 'https://example.invalid/main.jpg', isMain: true, orderNo: 0 },
    ],
    userId: '1df755ab-1508-43b4-b042-bd05c3425856',
    userInfo: null,
    ...over,
  };
}

function ssPayload(
  cards: Array<Record<string, unknown>>,
  fullUrl: string,
): { pageProps: Record<string, unknown> } {
  return {
    pageProps: {
      fullUrl,
      initialPage: 1,
      applicationList: { realStateItemModel: cards, totalCount: 0 },
    },
  };
}

function listPayload(cards: Array<Record<string, unknown>>): unknown {
  return {
    pageProps: {
      dehydratedState: {
        queries: [
          { queryKey: ['cardView'], state: { data: 'grid' } },
          {
            queryKey: ['statements', 'list', { params: { locale: 'ka' } }],
            state: { data: { result: true, data: { data: cards } } },
          },
        ],
      },
    },
  };
}

describe('myhome: список из перехваченного ответа', () => {
  it('разбирает карточку целиком', () => {
    const harvest = harvestPayload(listPayload([card()]));

    expect(harvest?.source).toBe('MYHOME_GE');
    expect(harvest?.cards).toHaveLength(1);

    const [first] = harvest?.cards ?? [];
    expect(first).toMatchObject({
      externalId: '11111111',
      url: 'https://www.myhome.ge/udzravi-qoneba/iyideba-2-otaxiani-bina-vakeshi-11111111',
      area: 56,
      rooms: 2,
      floor: 3,
      totalFloors: 9,
      district: 'ვაკე',
      sellerExternalId: '4242',
      sellerKind: 'owner',
    });
  });

  it('цену берёт в долларах: только в них объявления сравнимы между собой', () => {
    const [first] = harvestPayload(listPayload([card()]))?.cards ?? [];

    expect(first?.price).toBe(100_000);
    expect(first?.currency).toBe('USD');
  });

  it('лари остаётся запасным вариантом, когда доллара нет', () => {
    const [first] =
      harvestPayload(listPayload([card({ price: { '1': { price_total: 2600 } } })]))?.cards ?? [];

    expect(first?.price).toBe(2600);
    expect(first?.currency).toBe('GEL');
  });

  it('тип и сделку читает из заголовка, а не из числовых кодов площадки', () => {
    const [sale] = harvestPayload(listPayload([card()]))?.cards ?? [];
    expect(sale?.transactionType).toBe('SALE');
    expect(sale?.propertyType).toBe('APARTMENT');

    const [rent] =
      harvestPayload(
        listPayload([
          card({ dynamic_title: 'ქირავდება 3 ოთახიანი ბინა მესამე მასივში', deal_type_id: 7 }),
        ]),
      )?.cards ?? [];
    expect(rent?.transactionType).toBe('RENT');
  });

  it('берёт главное фото, а не первое попавшееся', () => {
    const [first] = harvestPayload(listPayload([card()]))?.cards ?? [];
    expect(first?.thumbnailUrl).toBe('https://example.invalid/b_t.webp');
  });

  it.each([
    ['broker', 'agency'],
    ['agent', 'agency'],
    ['physical', 'owner'],
  ])('тип продавца %s → %s', (type, expected) => {
    const [first] = harvestPayload(listPayload([card({ user_type: { type } })]))?.cards ?? [];

    expect(first?.sellerKind).toBe(expected);
  });

  it('не выдумывает тип, когда площадка его не назвала', () => {
    const [first] = harvestPayload(listPayload([card({ user_type: null })]))?.cards ?? [];

    // «Не знаю» и «агентство» — разные вещи: такое объявление в ленту
    // не попадёт вовсе, и это лучше, чем показать посредника собственником.
    expect(first?.sellerKind).toBeNull();
  });

  it('карточку без номера объявления пропускает, а не портит остальные', () => {
    const harvest = harvestPayload(listPayload([card({ id: null }), card({ id: 22222222 })]));

    expect(harvest?.cards.map((one) => one.externalId)).toEqual(['22222222']);
  });

  it('чужой ответ той же формы не разбирает', () => {
    // У ответа есть `data.data`, но это не карточки списка.
    expect(harvestPayload({ data: { data: [{ id: 1, title: 'что-то другое' }] } })).toBeNull();
    expect(harvestPayload({ hello: 'world' })).toBeNull();
    expect(harvestPayload(null)).toBeNull();
  });
});

describe('разбор загруженной страницы', () => {
  function page(nextData: unknown): Document {
    const { document } = parseHTML(
      `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
        nextData,
      )}</script></body></html>`,
    );
    return document as unknown as Document;
  }

  it('собирает список myhome из разметки', () => {
    const document = page({ props: listPayload([card()]) });
    const harvest = searchHarvest(document, 'https://www.myhome.ge/udzravi-qoneba/iyideba/bina');

    expect(harvest?.cards).toHaveLength(1);
  });

  it('НЕ собирает со страницы объявления: там данные списка устарели', () => {
    /*
     * Главная ловушка этого разбора. После перехода внутри сайта
     * `__NEXT_DATA__` остаётся от предыдущей страницы — на сохранённых
     * страницах обеих площадок так и было. Без этой проверки лента
     * пополнялась бы вчерашней выдачей при каждом открытии объявления.
     */
    const stale = { props: listPayload([card()]) };
    (stale.props as { pageProps: Record<string, unknown> }).pageProps['statementId'] = '25964691';

    const document = page(stale);
    const harvest = searchHarvest(
      document,
      'https://www.myhome.ge/udzravi-qoneba/iyideba-bina-25964691',
    );

    expect(harvest).toBeNull();
  });

  it('собирает список ss.ge из разметки', () => {
    const url = 'https://home.ss.ge/ka/udzravi-qoneba/l/bina/iyideba';
    const document = page({ props: ssPayload([ssCard()], url) });
    const harvest = searchHarvest(document, url);

    expect(harvest?.source).toBe('SS_GE');
    expect(harvest?.cards).toHaveLength(1);
  });

  it('НЕ собирает, когда страница называет ЧУЖОЙ адрес', () => {
    /*
     * Ровно тот случай, из-за которого разбор ss.ge пришлось отложить
     * в прошлый раз: после перехода внутри сайта `__NEXT_DATA__` остался
     * от предыдущей страницы. Страница называет свой адрес сама
     * (`pageProps.fullUrl`), и сверка с ним — точная, а не по признакам.
     */
    const document = page({
      props: ssPayload([ssCard()], 'https://home.ss.ge/ka/udzravi-qoneba/l/saxli'),
    });

    expect(
      searchHarvest(document, 'https://home.ss.ge/ka/udzravi-qoneba/l/bina/iyideba'),
    ).toBeNull();
  });

  it('НЕ собирает, когда страница своего адреса не называет', () => {
    // Старые сохранённые страницы `fullUrl` не содержали вовсе. Нет сверки —
    // нет сбора: лучше не собрать, чем записать вчерашнюю выдачу как свежую.
    const payload = ssPayload([ssCard()], 'https://home.ss.ge/ka/udzravi-qoneba/l/bina/iyideba');
    delete (payload.pageProps as Record<string, unknown>)['fullUrl'];

    expect(
      searchHarvest(
        page({ props: payload }),
        'https://home.ss.ge/ka/udzravi-qoneba/l/bina/iyideba',
      ),
    ).toBeNull();
  });

  it('чужой сайт не обслуживает', () => {
    const document = page({ props: listPayload([card()]) });

    expect(searchHarvest(document, 'https://myhome.ge.evil.com/l')).toBeNull();
    expect(searchHarvest(document, 'не адрес вовсе')).toBeNull();
  });

  it('битую разметку переносит молча', () => {
    const { document } = parseHTML(
      '<html><body><script id="__NEXT_DATA__">{нет</script></body></html>',
    );

    expect(
      searchHarvest(document as unknown as Document, 'https://www.myhome.ge/udzravi-qoneba/l'),
    ).toBeNull();
  });
});

/**
 * Тот же разбор на настоящих сохранённых страницах.
 *
 * Файлы лежат вне git (в них настоящие имена и телефоны), поэтому набор
 * пропускается, когда папок нет, — и говорит об этом вслух, а не делает
 * вид, что проверил.
 */
interface SavedPage {
  name: string;
  document: Document;
  url: string;
}

function savedPages(site: 'ss-ge' | 'myhome-ge'): SavedPage[] {
  try {
    const dir = join(FIXTURE_ROOT, site, 'search');
    return readdirSync(dir)
      .filter((name) => name.endsWith('.html'))
      .map((name) => {
        const html = readFileSync(join(dir, name), 'utf8');
        const { document } = parseHTML(html);

        // Браузер записывает исходный адрес комментарием первой строкой.
        // Он же — то, с чем сверяется свежесть данных.
        const match = /saved from url=\(\d+\)([^\s]+)/u.exec(html.slice(0, 400));

        return {
          name,
          document: document as unknown as Document,
          url: match?.[1] ?? 'https://example.invalid/',
        };
      });
  } catch {
    return [];
  }
}

const saved = [...savedPages('myhome-ge'), ...savedPages('ss-ge')];
const harvestedPages = saved
  .map((one) => ({ name: one.name, harvest: searchHarvest(one.document, one.url) }))
  .filter((one): one is { name: string; harvest: SearchHarvest } => one.harvest !== null);

describe.runIf(saved.length > 0)('сохранённые страницы площадок', () => {
  it('разбираются списки ОБЕИХ площадок', () => {
    const sources = new Set(harvestedPages.map((one) => one.harvest.source));

    // Страницы объявлений в тех же папках разбираться не должны, а списки
    // обеих площадок — должны: ради второй из них и запрашивалась фикстура.
    expect(sources).toContain('MYHOME_GE');
    expect(sources).toContain('SS_GE');
  });

  it('у каждой карточки есть номер, разбираемый адрес и продавец', () => {
    for (const { harvest } of harvestedPages) {
      expect(harvest.cards.length).toBeGreaterThan(0);

      for (const one of harvest.cards) {
        expect(one.externalId).not.toBe('');
        expect(() => new URL(one.url)).not.toThrow();
        // Ключ, по которому копится знание о продавце. Без него объявление
        // ss.ge осталось бы «невыясненным» навсегда.
        expect(one.sellerExternalId).not.toBeNull();
      }
    }
  });

  it('телефонов в разобранном нет ни одного (правило 11)', () => {
    for (const { harvest } of harvestedPages) {
      for (const one of harvest.cards) {
        expect(Object.keys(one)).not.toContain('phone');
        expect(JSON.stringify(one)).not.toMatch(/\+?995\d{9}/u);
      }
    }
  });
});

const ssHarvest = harvestedPages.find((one) => one.harvest.source === 'SS_GE')?.harvest ?? null;

describe.runIf(ssHarvest !== null)('сохранённая выдача ss.ge', () => {
  const cards = ssHarvest?.cards ?? [];

  it('адрес объявления совпадает с каноническим адресом площадки', () => {
    // Проверено на одиннадцати сохранённых страницах: `<link rel="canonical">`
    // равен ровно этой склейке.
    for (const one of cards) {
      expect(one.url).toMatch(/^https:\/\/home\.ss\.ge\/ka\/udzravi-qoneba\/[a-z0-9-]+$/u);
    }
  });

  it('комнаты берутся из заголовка, а не из числа спален', () => {
    /*
     * У «იყიდება 2 ოთახიანი ბინა» в данных стоит `numberOfBedrooms: 1`.
     * Спальня — не комната, и агент, ищущий двушку, по такому числу
     * её бы не нашёл.
     */
    const withRooms = cards.filter((one) => one.rooms !== null);
    expect(withRooms.length).toBeGreaterThan(0);

    for (const one of withRooms) {
      expect(one.rooms).toBeGreaterThan(0);
    }
  });

  it('цена приводится к доллару', () => {
    const priced = cards.filter((one) => one.price !== null);
    expect(priced.length).toBeGreaterThan(0);

    for (const one of priced) expect(one.currency).toBe('USD');
  });

  it('ТИП ПРОДАВЦА ИЗ ВЫДАЧИ НЕ ВЫВОДИТСЯ, кроме агентства с брендом', () => {
    /*
     * Главный факт про ss.ge, ради которого заведена сущность продавца:
     * в списке частный маклер неотличим от собственника. В этой самой
     * выдаче лежит объявление 35756896 с пустым `userInfo`, а на его
     * странице стоит `userEntityType: "Broker"`.
     *
     * Поэтому «собственник» отсюда не приходит НИКОГДА: только `agency`
     * (у агентств с брендом) либо `null` — «выяснится, когда агент откроет
     * любое объявление этого продавца».
     */
    expect(cards.every((one) => one.sellerKind !== 'owner')).toBe(true);
    expect(cards.some((one) => one.sellerKind === null)).toBe(true);
  });
});
