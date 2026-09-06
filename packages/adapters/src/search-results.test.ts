import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { FIXTURE_ROOT } from './fixtures';
import { harvestPayload, searchHarvest } from './search-results';

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

  it('ss.ge не разбирает: проверенных данных о его выдаче у нас нет', () => {
    // Правило 2. Продавцы ss.ge узнаются со страниц объявлений, которые
    // агент открывает сам, — а не догадками о структуре списка.
    const document = page({ props: listPayload([card()]) });

    expect(
      searchHarvest(document, 'https://home.ss.ge/ka/udzravi-qoneba/l/bina/iyideba'),
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
 * пропускается, когда папки нет, — и говорит об этом вслух, а не делает
 * вид, что проверил.
 */
const searchPages = ((): Array<{ name: string; document: Document; url: string }> => {
  try {
    const dir = join(FIXTURE_ROOT, 'myhome-ge', 'search');
    return readdirSync(dir)
      .filter((name) => name.endsWith('.html'))
      .map((name) => {
        const html = readFileSync(join(dir, name), 'utf8');
        const { document } = parseHTML(html);
        const match = /saved from url=\(\d+\)([^\s]+)/u.exec(html.slice(0, 400));

        return {
          name,
          document: document as unknown as Document,
          url: match?.[1] ?? 'https://www.myhome.ge/udzravi-qoneba/l',
        };
      });
  } catch {
    return [];
  }
})();

describe.runIf(searchPages.length > 0)('сохранённые страницы myhome', () => {
  it('хотя бы одна страница списка разбирается', () => {
    const harvested = searchPages
      .map((page) => searchHarvest(page.document, page.url))
      .filter((harvest) => harvest !== null);

    expect(harvested.length).toBeGreaterThan(0);
  });

  it('у разобранных карточек есть номер, адрес и продавец', () => {
    for (const page of searchPages) {
      const harvest = searchHarvest(page.document, page.url);
      if (harvest === null) continue;

      for (const one of harvest.cards) {
        expect(one.externalId).not.toBe('');
        expect(() => new URL(one.url)).not.toThrow();
        expect(one.sellerExternalId).not.toBeNull();
      }
    }
  });

  it('телефонов в разобранном нет ни одного (правило 11)', () => {
    for (const page of searchPages) {
      const harvest = searchHarvest(page.document, page.url);
      if (harvest === null) continue;

      // Разбор возвращает объекты фиксированной формы; поля телефона в ней
      // нет по построению, и это проверяется на настоящих данных.
      for (const one of harvest.cards) {
        expect(Object.keys(one)).not.toContain('phone');
        expect(JSON.stringify(one)).not.toMatch(/\+?995\d{9}/u);
      }
    }
  });
});
