import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';

import { fixturesAvailable, loadFixtures } from './fixtures';
import { MyhomeAdapter } from './myhome-ge';
import { SsGeAdapter } from './ss-ge';
import { adapterFor } from './index';
import { isGeorgianMobile, parseFloorPair } from './shared';
import { detectPropertyType, detectTransactionType, roomsFromTitle } from './vocabulary';

/**
 * ГЕЙТ ФАЗЫ 5. Адаптеры извлекают данные из РЕАЛЬНЫХ страниц (DoD §3.Ф5).
 *
 * Chrome здесь не нужен: адаптер получает готовый `Document` аргументом,
 * а не берёт глобальный. Именно ради этого он и вынесен в отдельный пакет.
 */

const ss = new SsGeAdapter();
const myhome = new MyhomeAdapter();

const hasSs = fixturesAvailable('ss-ge');
const hasMyhome = fixturesAvailable('myhome-ge');

describe('выбор адаптера по адресу', () => {
  it.each([
    ['https://home.ss.ge/ka/udzravi-qoneba/iyideba-bina-31346373', 'SS_GE'],
    ['https://ss.ge/ru/nedvizhimost/123', 'SS_GE'],
    ['https://www.myhome.ge/udzravi-qoneba/iyideba-bina-25704507/', 'MYHOME_GE'],
    ['https://myhome.ge/ru/nedvizhimost/456', 'MYHOME_GE'],
  ])('%s → %s', (url, expected) => {
    expect(adapterFor(url)?.sourceId).toBe(expected);
  });

  it.each(['https://example.com/listing/1', 'https://ss.ge.evil.com/phishing', 'не адрес вовсе'])(
    '%s не обслуживается ни одним адаптером',
    (url) => {
      // Ложное срабатывание на чужом домене означало бы, что расширение
      // попытается читать чужую страницу как объявление.
      expect(adapterFor(url)).toBeNull();
    },
  );
});

describe.skipIf(!hasSs)('ss.ge на реальных страницах', () => {
  const fixtures = loadFixtures('ss-ge');

  it('фикстуры загружены', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(5);
  });

  it.each(loadFixtures('ss-ge').map((f) => [f.name.slice(0, 40), f] as const))(
    '%s разбирается',
    (_name, fixture) => {
      const { payload, missingFields, parserVersion } = ss.extract(fixture.document, fixture.url);

      expect(payload.source).toBe('SS_GE');
      expect(parserVersion).toBe('ss.ge@1.0.0');

      // Номер объявления есть у всех разобранных страниц.
      expect(payload.externalId).toMatch(/^\d{7,}$/u);
      expect(payload.sourceUrl).toContain('ss.ge');
      expect(payload.title).toBeTruthy();
      // Суффикс площадки в заголовок объекта попадать не должен.
      expect(payload.title).not.toContain('| ss.ge');

      expect(payload.transactionType).toMatch(/^(SALE|RENT)$/u);
      expect(payload.propertyType).toBeTruthy();
      expect(payload.area).toBeGreaterThan(0);

      // Телефон раскрыт на всех присланных фикстурах.
      expect(payload.owner.phones.length).toBeGreaterThan(0);
      for (const phone of payload.owner.phones) expect(isGeorgianMobile(phone)).toBe(true);

      // missingFields заполняется честно, а не остаётся пустым (D9).
      expect(Array.isArray(missingFields)).toBe(true);
      for (const field of missingFields) {
        expect(typeof field).toBe('string');
      }
    },
  );

  it('телефон площадки не попадает в контакты собственника', () => {
    // 0322121661 — линия поддержки ss.ge, она есть на каждой странице.
    // Попади она в базу как телефон собственника — отравила бы дедупликацию
    // всей команды: под одним номером оказались бы все объекты подряд.
    for (const fixture of fixtures) {
      const { payload } = ss.extract(fixture.document, fixture.url);
      expect(payload.owner.phones).not.toContain('0322121661');
    }
  });

  it('этаж не берётся из карточки соседнего объявления', () => {
    // На странице есть блок похожих предложений с теми же иконками.
    // У коммерческого помещения этажа нет, и без ограничения по подписи
    // адаптер брал бы «6/10» из чужой карточки.
    const commercial = fixtures.find((f) => f.name.includes('36375375'));
    expect(commercial).toBeDefined();

    const { payload, missingFields } = ss.extract(
      (commercial as (typeof fixtures)[number]).document,
      (commercial as (typeof fixtures)[number]).url,
    );

    expect(payload.floor).toBeNull();
    expect(payload.rooms).toBeNull();
    expect(missingFields).toContain('floor');
    expect(missingFields).toContain('rooms');
    // Площадь при этом читается: она у этого объявления есть.
    expect(payload.area).toBe(24);
  });

  it('квартира разбирается со всеми параметрами', () => {
    const flat = fixtures.find((f) => f.name.includes('31346373'));
    const { payload } = ss.extract(
      (flat as (typeof fixtures)[number]).document,
      (flat as (typeof fixtures)[number]).url,
    );

    expect(payload.externalId).toBe('31346373');
    expect(payload.price).toBe(179000);
    expect(payload.currency).toBe('USD');
    expect(payload.area).toBe(85);
    expect(payload.rooms).toBe(2);
    expect(payload.bedrooms).toBe(1);
    expect(payload.floor).toBe(7);
    expect(payload.totalFloors).toBe(10);
    expect(payload.propertyType).toBe('APARTMENT');
    expect(payload.transactionType).toBe('SALE');
    // Сам номер в репозиторий не попадает (правило 10): репозиторий публичный,
    // а это телефон живого человека. Проверяется то, что от проверки и требуется:
    // номер ровно один — значит, линия поддержки площадки отсеяна, — и он
    // грузинский мобильный.
    expect(payload.owner.phones).toHaveLength(1);
    expect(payload.owner.phones[0]).toMatch(/^5\d{8}$/u);
  });

  it('объявление без цены не получает выдуманную цену', () => {
    // У одной посуточной аренды цены в заголовке нет вовсе.
    const noPrice = fixtures.find((f) => f.name.includes('31226003'));
    const { payload, missingFields } = ss.extract(
      (noPrice as (typeof fixtures)[number]).document,
      (noPrice as (typeof fixtures)[number]).url,
    );

    expect(payload.price).toBeNull();
    expect(missingFields).toContain('price');
  });

  it('адрес и район объявлены отсутствующими, а не угаданы', () => {
    // На разобранных страницах их нет в отдельных полях, а вытаскивать
    // из заголовка нельзя: район стоит в падеже.
    for (const fixture of fixtures) {
      const { payload, missingFields } = ss.extract(fixture.document, fixture.url);
      expect(payload.address).toBeNull();
      expect(payload.district).toBeNull();
      expect(missingFields).toContain('address');
      expect(missingFields).toContain('district');
    }
  });

  it('раскрытый телефон опознаётся', () => {
    for (const fixture of fixtures) {
      expect(ss.isPhoneRevealed(fixture.document)).toBe(true);
    }
  });
});

describe.skipIf(!hasMyhome)('myhome.ge на реальных страницах', () => {
  const fixtures = loadFixtures('myhome-ge');

  it('фикстуры загружены', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(5);
  });

  it.each(loadFixtures('myhome-ge').map((f) => [f.name.slice(0, 40), f] as const))(
    '%s разбирается',
    (_name, fixture) => {
      const { payload, parserVersion } = myhome.extract(fixture.document, fixture.url);

      expect(payload.source).toBe('MYHOME_GE');
      expect(parserVersion).toBe('myhome.ge@1.0.0');

      expect(payload.externalId).toMatch(/^\d{7,}$/u);
      expect(payload.title).toBeTruthy();
      expect(payload.title).not.toContain('| Myhome');

      expect(payload.price).toBeGreaterThan(0);
      expect(payload.currency).toBe('USD');
      expect(payload.area).toBeGreaterThan(0);
      expect(payload.propertyType).toBeTruthy();
      expect(payload.transactionType).toBe('SALE');

      // Адрес у этой площадки есть в мета-описании — в отличие от ss.ge.
      expect(payload.address).toBeTruthy();

      expect(payload.owner.phones.length).toBeGreaterThan(0);
      for (const phone of payload.owner.phones) expect(isGeorgianMobile(phone)).toBe(true);
    },
  );

  it('телефон площадки не попадает в контакты собственника', () => {
    for (const fixture of fixtures) {
      const { payload } = myhome.extract(fixture.document, fixture.url);
      expect(payload.owner.phones.some((p) => p.includes('0322800015'))).toBe(false);
    }
  });

  it('два номера собственника читаются оба', () => {
    // Подтверждает решение хранить телефоны отдельной таблицей: в одном
    // объявлении их действительно бывает несколько (ADR-0002).
    const two = fixtures.find((f) => f.name.includes('25880090'));
    const { payload } = myhome.extract(
      (two as (typeof fixtures)[number]).document,
      (two as (typeof fixtures)[number]).url,
    );

    expect(payload.owner.phones).toHaveLength(2);
  });

  it('квартира разбирается со всеми параметрами', () => {
    const flat = fixtures.find((f) => f.name.includes('25704507'));
    const { payload } = myhome.extract(
      (flat as (typeof fixtures)[number]).document,
      (flat as (typeof fixtures)[number]).url,
    );

    expect(payload.externalId).toBe('25704507');
    expect(payload.price).toBe(70000);
    expect(payload.area).toBe(66);
    expect(payload.rooms).toBe(3);
    expect(payload.floor).toBe(8);
    expect(payload.totalFloors).toBe(12);
    expect(payload.propertyType).toBe('APARTMENT');
    expect(payload.address).toBe('პ. იბერის ქ. 22ბ');
  });

  it('земельный участок опознаётся как земля, а не как жильё', () => {
    const land = fixtures.find((f) => f.name.includes('25880360'));
    const { payload } = myhome.extract(
      (land as (typeof fixtures)[number]).document,
      (land as (typeof fixtures)[number]).url,
    );

    expect(payload.propertyType).toBe('LAND');
    expect(payload.area).toBe(1000);
  });

  it('раскрытый телефон опознаётся', () => {
    for (const fixture of fixtures) {
      expect(myhome.isPhoneRevealed(fixture.document)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Чистые функции — проверяются без страниц
// ─────────────────────────────────────────────────────────────────────────────

describe('разбор значений', () => {
  it.each([
    ['7/10', 7, 10],
    ['8 / 12', 8, 12],
    ['30/54', 30, 54],
  ])('«%s» → этаж %s из %s', (input, floor, total) => {
    expect(parseFloorPair(input)).toEqual({ floor, totalFloors: total });
  });

  it('этаж без этажности не выдумывает второе число', () => {
    expect(parseFloorPair('5')).toEqual({ floor: 5, totalFloors: null });
    expect(parseFloorPair(null)).toEqual({ floor: null, totalFloors: null });
  });

  it.each([
    ['+995555000111', true],
    ['555000111', true],
    ['0322121661', false],
    ['0322800015', false],
    ['12345', false],
  ])('«%s» мобильный: %s', (phone, expected) => {
    expect(isGeorgianMobile(phone)).toBe(expected);
  });
});

describe('словарь типов на трёх языках', () => {
  it.each([
    ['იყიდება 2 ოთახიანი ბინა', 'APARTMENT'],
    ['3-room apartment for sale', 'APARTMENT'],
    ['продаётся 3 комнатная квартира', 'APARTMENT'],
    ['კერძო სახლი', 'HOUSE'],
    ['მიწის ნაკვეთი', 'LAND'],
    ['საოფისე ფართი', 'COMMERCIAL'],
    ['სავაჭრო კომერციული ფართი', 'COMMERCIAL'],
  ])('«%s» → %s', (title, expected) => {
    expect(detectPropertyType(title)).toBe(expected);
  });

  it('офисная площадь не опознаётся как жильё', () => {
    // Порядок проверки важен: «საოფისე ფართი» содержит слова, которые
    // при другом порядке дали бы APARTMENT.
    expect(detectPropertyType('ქირავდება საოფისე ფართი სოლოლაკში')).toBe('COMMERCIAL');
  });

  it.each([
    ['იყიდება ბინა', 'SALE'],
    ['ქირავდება ბინა', 'RENT'],
    ['for rent', 'RENT'],
    ['продаётся квартира', 'SALE'],
  ])('«%s» → %s', (title, expected) => {
    expect(detectTransactionType(title)).toBe(expected);
  });

  it('незнакомый тип остаётся пустым, а не «ближайшим похожим»', () => {
    expect(detectPropertyType('нечто непонятное')).toBeNull();
    expect(detectTransactionType('нечто непонятное')).toBeNull();
  });

  it.each([
    ['იყიდება 3 ოთახიანი ბინა', 3],
    ['5-room apartment', 5],
    ['4 комнатная квартира', 4],
  ])('комнатность из «%s» → %s', (title, expected) => {
    expect(roomsFromTitle(title)).toBe(expected);
  });
});

/**
 * ФОТОГРАФИИ ПРИНАДЛЕЖАТ ЭТОМУ ОБЪЯВЛЕНИЮ, А НЕ СОСЕДНЕМУ.
 *
 * Проверка появилась по факту дефекта: отбор картинок по одному лишь CDN
 * приносил снимки из карточек похожих предложений — 19 миниатюр на квартире
 * ss.ge и все 32 «фото галереи» на участке myhome, причём там соседние
 * участки были на том же Лиси, то есть почти неотличимы от разбираемого.
 *
 * Это не косметика. Фотографии — признак дедупликации, и снимки соседнего
 * похожего объекта тянут оценку к ложному вердикту «дубль».
 */
describe('фотографии не берутся из чужих карточек', () => {
  /** Адрес объявления, на которое ведёт ссылка вокруг картинки. */
  function linkedListing(document: Document, src: string): string | null {
    for (const img of document.querySelectorAll('img')) {
      const own = img.getAttribute('src');
      if (own === null || (own !== src && !src.endsWith(own))) continue;
      return img.closest('a')?.getAttribute('href') ?? null;
    }
    return null;
  }

  it.skipIf(!hasSs)('ss.ge: ни один снимок не лежит в ссылке на другое объявление', () => {
    for (const fixture of loadFixtures('ss-ge')) {
      const { payload } = ss.extract(fixture.document, fixture.url);
      expect(payload.photos.length).toBeGreaterThan(0);

      for (const photo of payload.photos) {
        const href = linkedListing(fixture.document, photo);
        if (href !== null) {
          expect(href, `${fixture.name}: ${photo}`).toContain(payload.externalId as string);
        }
      }
    }
  });

  it.skipIf(!hasMyhome)('myhome.ge: ни один снимок не лежит в ссылке на другое объявление', () => {
    for (const fixture of loadFixtures('myhome-ge')) {
      const { payload } = myhome.extract(fixture.document, fixture.url);
      expect(payload.photos.length).toBeGreaterThan(0);

      for (const photo of payload.photos) {
        const href = linkedListing(fixture.document, photo);
        if (href !== null) {
          expect(href, `${fixture.name}: ${photo}`).toContain(payload.externalId as string);
        }
      }
    }
  });

  /**
   * Своя галерея на сохранённых страницах не видна: браузер переписывает
   * пути своих картинок на локальные. Поэтому правило проверяется отдельно
   * на собранной вручную разметке — иначе «своя картинка сохраняется»
   * осталось бы непроверенным вовсе.
   */
  it('своя галерея сохраняется, карточка соседа отбрасывается', () => {
    const { document } = parseHTML(`<!doctype html><html><head>
        <meta property="og:url" content="https://home.ss.ge/ka/udzravi-qoneba/bina-31346373">
        <meta property="og:image" content="https://static.ss.ge/own/cover.jpg">
      </head><body>
        <div><img src="https://static.ss.ge/own/1.jpg"></div>
        <div><img src="https://static.ss.ge/own/2.jpg"></div>
        <a href="/ka/udzravi-qoneba/bina-99999999"><img src="https://static.ss.ge/foreign/9.jpg"></a>
        <a href="/ka/udzravi-qoneba/bina-31346373"><img src="https://static.ss.ge/own/3.jpg"></a>
      </body></html>`);

    const { payload } = ss.extract(
      document as unknown as Document,
      'https://home.ss.ge/ka/udzravi-qoneba/bina-31346373',
    );

    expect(payload.photos).toEqual([
      'https://static.ss.ge/own/cover.jpg',
      'https://static.ss.ge/own/1.jpg',
      'https://static.ss.ge/own/2.jpg',
      // Ссылка на само это объявление своей картинке не мешает.
      'https://static.ss.ge/own/3.jpg',
    ]);
  });
});
