import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { LOCALES, formatMoney, translate, translator } from '@kleekto/i18n';
import { parseHTML } from 'linkedom';
import { describe, expect, it, vi } from 'vitest';

import { ApiClient, UnauthenticatedError } from './core/api-client';
import { runImport, toRequestBody, usablePhone } from './core/import-manager';
import type { ImportRequestBody, ImportResponse } from './core/import-manager';
import { MENU_IDS, outcomeByMenuId } from './core/messages';
import { readSession, writeSession, type Session, type StorageArea } from './core/storage';
import { Ui } from './content/ui';

/**
 * ГЕЙТ ФАЗЫ 6.
 *
 * Chrome здесь не запускается и не нужен: вся логика импорта вынесена
 * в `core/import-manager.ts`, который получает `document` аргументом,
 * а сеть — зависимостью. Это сделано ровно ради теста ниже.
 */

// ── Фикстуры ─────────────────────────────────────────────────────────────────

const FIXTURES = join(import.meta.dirname, '../../../docs/fixtures/ss-ge/listings');

function fixtureFiles(): string[] {
  try {
    return readdirSync(FIXTURES)
      .filter((name) => name.endsWith('.html'))
      .map((name) => join(FIXTURES, name))
      .sort();
  } catch {
    return [];
  }
}

const hasFixtures = fixtureFiles().length > 0;

function realListing(): { document: Document; url: string } {
  const file = fixtureFiles()[0] as string;
  const html = readFileSync(file, 'utf8');
  const { document } = parseHTML(html);
  const match = /saved from url=\(\d+\)([^\s]+)/u.exec(html.slice(0, 400));

  return {
    document: document as unknown as Document,
    url: match?.[1] ?? 'https://home.ss.ge/ka/udzravi-qoneba/bina-31346373',
  };
}

/**
 * Та же реальная страница, но с нераскрытым телефоном.
 *
 * ПОЧЕМУ СТРАНИЦА СОБИРАЕТСЯ, А НЕ БЕРЁТСЯ ГОТОВОЙ. Среди четырнадцати
 * присланных фикстур нет ни одной без раскрытого номера — это и есть
 * незакрытый `Q24`. Поэтому состояние воспроизводится: с настоящей страницы
 * убираются ссылки `tel:`, ровно то, что появляется на ней после нажатия
 * агентом «показать телефон».
 *
 * Проверка от этого не становится слабее: всё остальное на странице —
 * настоящее, включая блок похожих объявлений с ИХ телефонами. Именно на нём
 * ломался бы наивный поиск «любого номера на странице».
 */
function listingWithHiddenPhone(): { document: Document; url: string } {
  const listing = realListing();
  for (const link of listing.document.querySelectorAll('a[href^="tel:"]')) {
    link.remove();
  }
  return listing;
}

const OK_RESPONSE: ImportResponse = {
  result: 'created',
  verdict: 'NONE',
  propertyId: '11111111-1111-1111-1111-111111111111',
  sourceListingId: '22222222-2222-2222-2222-222222222222',
  observationId: '33333333-3333-3333-3333-333333333333',
  matches: [],
  otherTeamMatches: [],
  reasonHuman: null,
};

// ── Правило 11: главное требование фазы ──────────────────────────────────────

describe('правило раскрытого телефона', () => {
  /**
   * ОБЯЗАТЕЛЬНЫЙ ТЕСТ ФАЗЫ 6 (промпт §6.2).
   *
   * Проверяется не «показалось сообщение», а то, что запроса НЕ БЫЛО.
   * Разница принципиальная: импорт без телефона ломает дедупликацию второго
   * и третьего уровня, и одно молчаливое исключение здесь портит базу
   * за неделю.
   */
  it.skipIf(!hasFixtures)('телефон не раскрыт: запрос не отправлен', async () => {
    const send = vi.fn<(body: ImportRequestBody) => Promise<ImportResponse>>();
    const { document, url } = listingWithHiddenPhone();

    const result = await runImport({ send }, document, url, { outcome: 'consent' });

    expect(result.kind).toBe('phone_not_revealed');
    expect(send).not.toHaveBeenCalled();
  });

  it.skipIf(!hasFixtures)('блокировка действует на все четыре исхода', async () => {
    // Телефон сохраняется во всех четырёх случаях (§5Б.2): при «Согласен» —
    // как контакт объекта, в остальных трёх — в индексе. Значит, и требовать
    // его надо во всех четырёх, а не только при создании объекта.
    const { document, url } = listingWithHiddenPhone();

    for (const outcome of ['consent', 'refused', 'no_answer', 'callback'] as const) {
      const send = vi.fn<(body: ImportRequestBody) => Promise<ImportResponse>>();
      const result = await runImport({ send }, document, url, {
        outcome,
        callbackAt: new Date().toISOString(),
      });

      expect(result.kind, outcome).toBe('phone_not_revealed');
      expect(send, outcome).not.toHaveBeenCalled();
    }
  });

  it.skipIf(!hasFixtures)('предпросмотр не теряется при блокировке', async () => {
    // DESIGN §25.1: ничего из сделанного агентом не пропадает.
    const { document, url } = listingWithHiddenPhone();
    const result = await runImport({ send: vi.fn() }, document, url, { outcome: 'consent' });

    expect(result.kind).toBe('phone_not_revealed');
    if (result.kind !== 'phone_not_revealed') return;

    expect(result.preview.price).toBeGreaterThan(0);
    expect(result.preview.phone).toBeNull();
  });

  it.each([
    ['*** ** **', 'звёздочки'],
    ['599•••••', 'точки-заглушки'],
    ['show number', 'английская подпись кнопки'],
    ['показать номер', 'русская подпись кнопки'],
    ['0322121661', 'городской номер площадки'],
    ['12345', 'слишком коротко'],
    ['', 'пусто'],
  ])('«%s» не считается раскрытым номером (%s)', (masked) => {
    expect(usablePhone([masked])).toBeNull();
  });

  it('настоящий номер проходит в обоих написаниях', () => {
    expect(usablePhone(['555000111'])).toBe('555000111');
    expect(usablePhone(['+995 555 00 01 11'])).toBe('+995 555 00 01 11');
  });

  it('маска не мешает найти настоящий номер рядом', () => {
    expect(usablePhone(['показать', '555000111'])).toBe('555000111');
  });
});

// ── Обычный путь ─────────────────────────────────────────────────────────────

describe('импорт с раскрытым телефоном', () => {
  it.skipIf(!hasFixtures)('запрос уходит и содержит извлечённые поля', async () => {
    const send = vi.fn<(body: ImportRequestBody) => Promise<ImportResponse>>(
      async () => OK_RESPONSE,
    );
    const { document, url } = realListing();

    const result = await runImport({ send }, document, url, { outcome: 'consent' });

    expect(result.kind).toBe('sent');
    expect(send).toHaveBeenCalledTimes(1);

    const body = send.mock.calls[0]?.[0] as ImportRequestBody;
    expect(body.source).toBe('SS_GE');
    expect(body.outcome).toBe('consent');
    expect(body.owner.phone).toMatch(/^5\d{8}$/u);
    expect(body.parserVersion).toBe('ss.ge@1.0.0');
    expect(body.price).toBeGreaterThan(0);
  });

  it.skipIf(!hasFixtures)('все четыре исхода идут одной логикой', async () => {
    // §5Б.2: «поверх одной общей логики». Расширение не решает, создавать ли
    // объект, — оно передаёт исход. Решение принимает сервер (правило R14),
    // и держать это знание в двух местах нельзя.
    const { document, url } = realListing();

    for (const outcome of ['consent', 'refused', 'no_answer', 'callback'] as const) {
      const send = vi.fn<(body: ImportRequestBody) => Promise<ImportResponse>>(
        async () => OK_RESPONSE,
      );
      await runImport({ send }, document, url, {
        outcome,
        callbackAt: '2026-09-10T10:00:00.000Z',
      });

      const body = send.mock.calls[0]?.[0] as ImportRequestBody;
      expect(body.outcome, outcome).toBe(outcome);
      expect(body.owner.phone, outcome).toMatch(/^5\d{8}$/u);
    }
  });

  it('страница чужого сайта запроса не порождает', async () => {
    const send = vi.fn<(body: ImportRequestBody) => Promise<ImportResponse>>();
    const { document } = parseHTML('<!doctype html><html><body>новости</body></html>');

    const result = await runImport(
      { send },
      document as unknown as Document,
      'https://example.com/article/1',
      { outcome: 'consent' },
    );

    expect(result.kind).toBe('unsupported');
    expect(send).not.toHaveBeenCalled();
  });

  it.skipIf(!hasFixtures)('ошибка сети отличается от истёкшей сессии', async () => {
    const { document, url } = realListing();

    const network = await runImport(
      {
        send: () => Promise.reject(new TypeError('Failed to fetch')),
      },
      document,
      url,
      { outcome: 'consent' },
    );
    expect(network).toMatchObject({ kind: 'failed', error: 'network' });

    const expired = await runImport(
      {
        send: () => Promise.reject(new UnauthenticatedError()),
      },
      document,
      url,
      { outcome: 'consent' },
    );
    // §6.5: истёкший токен — предложение войти заново, а не молчаливый сбой.
    expect(expired).toMatchObject({ kind: 'failed', error: 'session' });
  });
});

// ── Форма запроса ────────────────────────────────────────────────────────────

describe('тело запроса', () => {
  const extraction = {
    payload: {
      source: 'SS_GE' as const,
      sourceUrl: 'https://home.ss.ge/ka/udzravi-qoneba/bina-31346373',
      externalId: '31346373',
      title: 'квартира',
      propertyType: 'APARTMENT' as const,
      transactionType: 'SALE' as const,
      price: 179000,
      currency: 'USD',
      area: 85,
      rooms: 2,
      bedrooms: 1,
      floor: 7,
      totalFloors: 10,
      district: null,
      address: null,
      description: 'описание',
      photos: ['https://static.ss.ge/a.jpg'],
      bathrooms: null,
      balconies: null,
      balconyArea: null,
      houseArea: null,
      yardArea: null,
      condition: null,
      buildingStatus: null,
      projectType: null,
      cadastralCode: null,
      sellerKind: null,
      owner: { name: null, phones: ['555000111'] },
    },
    missingFields: ['address', 'district'],
    parserVersion: 'ss.ge@1.0.0',
  };

  /**
   * ПРАВИЛО 5. Расширению неоткуда взять область компании, и посылать её
   * оно не должно даже случайно: сервер берёт её из сессии.
   */
  it('не содержит companyId, teamId и assignedUserId', () => {
    const body = toRequestBody(extraction, '555000111', { outcome: 'consent' });
    const keys = Object.keys(body);

    for (const forbidden of ['companyId', 'teamId', 'assignedUserId', 'userId']) {
      expect(keys, forbidden).not.toContain(forbidden);
    }
  });

  /**
   * Схема сервера объявлена `.strict()`: лишнее поле не игнорируется,
   * а роняет запрос целиком с ответом 400 — вместе со всем импортом,
   * а не с одним полем.
   *
   * Раньше здесь стоял список запрещённых имён, и он устаревал каждый раз,
   * когда поле добавляли на сервер. Теперь сверка идёт с самой схемой:
   * тест читает исходник маршрута. Тому же классу ошибки — поле есть
   * в ядре, но забыто в схеме — этот тест не даёт повториться.
   */
  it('шлёт только то, что принимает схема сервера', () => {
    const route = readFileSync(
      join(import.meta.dirname, '../../../apps/web/app/api/v1/import/listing/route.ts'),
      'utf8',
    );

    // Тело схемы — от `z.object({` до `.strict()`. Читать глазами по всему
    // файлу нельзя: слово `photos` встречается и в комментариях.
    const start = route.indexOf('.object({');
    const schema = route.slice(start, route.indexOf('.strict()', start));
    expect(schema.length).toBeGreaterThan(100);

    const declared = new Set([...schema.matchAll(/^ {4}(\w+):/gmu)].map((match) => match[1]));
    expect(declared.size).toBeGreaterThan(20);

    const body = toRequestBody(extraction, '555000111', {
      outcome: 'callback',
      callbackAt: '2026-09-10T10:00:00.000Z',
      note: 'x',
      acknowledgedDuplicateOf: ['00000000-0000-0000-0000-000000000000'],
    });

    for (const key of Object.keys(body)) {
      expect(declared, key).toContain(key);
    }
  });

  it('необязательные поля не появляются пустыми', () => {
    // `.strict()` отвергает и `callbackAt: undefined`: ключ есть, значение
    // не проходит проверку. Поэтому их не должно быть вовсе.
    const body = toRequestBody(extraction, '555000111', { outcome: 'refused' });
    const keys = Object.keys(body);

    expect(keys).not.toContain('callbackAt');
    expect(keys).not.toContain('doNotCallCompanyWide');
    expect(keys).not.toContain('note');
    expect(keys).not.toContain('acknowledgedDuplicateOf');
  });

  it('дата перезвона передаётся, когда она есть', () => {
    const body = toRequestBody(extraction, '555000111', {
      outcome: 'callback',
      callbackAt: '2026-09-10T10:00:00.000Z',
    });
    expect(body.callbackAt).toBe('2026-09-10T10:00:00.000Z');
  });

  it('флаг «просил не звонить» передаётся только поднятым', () => {
    const raised = toRequestBody(extraction, '555000111', {
      outcome: 'refused',
      doNotCallCompanyWide: true,
    });
    expect(raised.doNotCallCompanyWide).toBe(true);

    const lowered = toRequestBody(extraction, '555000111', {
      outcome: 'refused',
      doNotCallCompanyWide: false,
    });
    expect(Object.keys(lowered)).not.toContain('doNotCallCompanyWide');
  });

  it('missingFields доходят до сервера', () => {
    // Метрика `parser failure rate` (§6.5) строится на них: о смене вёрстки
    // площадки мы должны узнавать из метрики, а не от разозлённого агента.
    const body = toRequestBody(extraction, '555000111', { outcome: 'consent' });
    expect(body.missingFields).toEqual(['address', 'district']);
  });
});

// ── Контекстное меню ─────────────────────────────────────────────────────────

describe('контекстное меню', () => {
  it('четыре пункта, по одному на исход', () => {
    expect(Object.keys(MENU_IDS).sort()).toEqual(['callback', 'consent', 'no_answer', 'refused']);
  });

  it('идентификатор пункта разворачивается обратно в исход', () => {
    for (const [outcome, id] of Object.entries(MENU_IDS)) {
      expect(outcomeByMenuId(id)).toBe(outcome);
    }
    expect(outcomeByMenuId('чужой-пункт')).toBeNull();
  });
});

// ── Хранилище и токены ───────────────────────────────────────────────────────

function memoryStorage(initial: Record<string, unknown> = {}): StorageArea {
  const data = { ...initial };
  return {
    get: (key) => Promise.resolve({ [key]: data[key] }),
    set: (items) => {
      Object.assign(data, items);
      return Promise.resolve();
    },
    remove: (key) => {
      delete data[key];
      return Promise.resolve();
    },
  };
}

const SESSION: Session = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: 2_000_000,
  email: 'agent@example.com',
  locale: 'ka',
};

describe('хранилище сессии', () => {
  it('читает то, что записали', async () => {
    const area = memoryStorage();
    await writeSession(area, SESSION);
    expect(await readSession(area)).toEqual(SESSION);
  });

  it.each<[unknown, string]>([
    [undefined, 'пусто'],
    [{ accessToken: 'a' }, 'обрезанный объект от прошлой версии'],
    [{ ...SESSION, locale: 'de' }, 'язык не из наших трёх'],
    [{ ...SESSION, expiresAt: 'скоро' }, 'поле другого типа'],
  ])('мусор в хранилище читается как «нет сессии» (%#: %s)', async (stored) => {
    // После обновления расширения в chrome.storage лежит то, что записала
    // прошлая версия. Слепое доверие обернулось бы падением на старте —
    // у агента, посреди рабочего дня.
    const area = memoryStorage(stored === undefined ? {} : { session: stored });
    expect(await readSession(area)).toBeNull();
  });
});

describe('клиент API', () => {
  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }

  it('живой токен не обновляется зря', async () => {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () =>
      jsonResponse(OK_RESPONSE),
    );
    const client = new ApiClient({
      baseUrl: 'https://crm.example',
      storage: memoryStorage({ session: { ...SESSION, expiresAt: 10_000_000 } }),
      fetch: fetchMock as unknown as typeof fetch,
      now: () => 1_000_000,
    });

    await client.importListing({ outcome: 'consent' } as unknown as ImportRequestBody);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/v1/import/listing');
  });

  it('истекающий токен обновляется заранее', async () => {
    // Обновление по времени жизни, а не по ответу 401: иначе первый запрос
    // после истечения обязательно провалился бы, и агент увидел бы ошибку
    // там, где ничего не сломано.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ accessToken: 'new', refreshToken: 'new-r', expiresIn: 900 }),
      )
      .mockResolvedValueOnce(jsonResponse(OK_RESPONSE));

    const storage = memoryStorage({ session: { ...SESSION, expiresAt: 1_005_000 } });
    const client = new ApiClient({
      baseUrl: 'https://crm.example',
      storage,
      fetch: fetchMock as unknown as typeof fetch,
      now: () => 1_000_000,
    });

    await client.importListing({ outcome: 'consent' } as unknown as ImportRequestBody);

    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/v1/auth/refresh');
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/api/v1/import/listing');
    expect((await readSession(storage))?.accessToken).toBe('new');
  });

  it('отклонённый refresh стирает сессию', async () => {
    // В том числе при обнаружении кражи токена (ротация с детекцией, фаза 3).
    const storage = memoryStorage({ session: { ...SESSION, expiresAt: 1_000 } });
    const client = new ApiClient({
      baseUrl: 'https://crm.example',
      storage,
      fetch: vi.fn(async () => new Response('', { status: 401 })) as unknown as typeof fetch,
      now: () => 1_000_000,
    });

    await expect(
      client.importListing({ outcome: 'consent' } as unknown as ImportRequestBody),
    ).rejects.toBeInstanceOf(UnauthenticatedError);

    expect(await readSession(storage)).toBeNull();
  });

  it('401 на импорте стирает сессию', async () => {
    const storage = memoryStorage({ session: { ...SESSION, expiresAt: 10_000_000 } });
    const client = new ApiClient({
      baseUrl: 'https://crm.example',
      storage,
      fetch: vi.fn(async () => new Response('', { status: 401 })) as unknown as typeof fetch,
      now: () => 1_000_000,
    });

    await expect(
      client.importListing({ outcome: 'consent' } as unknown as ImportRequestBody),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(await readSession(storage)).toBeNull();
  });

  it('вход без сессии в хранилище не притворяется успехом', async () => {
    const client = new ApiClient({
      baseUrl: 'https://crm.example',
      storage: memoryStorage(),
      fetch: vi.fn() as unknown as typeof fetch,
      now: () => 1_000_000,
    });

    await expect(
      client.importListing({ outcome: 'consent' } as unknown as ImportRequestBody),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});

// ── Структурные проверки ─────────────────────────────────────────────────────

/**
 * Требования, которые нельзя выразить обычным тестом: они про то, чего
 * в коде быть НЕ должно. Такие правила ломаются не злым умыслом, а строчкой,
 * добавленной в спешке, — и обычный тест этого не заметит.
 */
describe('устройство расширения', () => {
  const read = (relative: string): string =>
    readFileSync(join(import.meta.dirname, relative), 'utf8');

  const CONTENT_FILES = ['content/content.ts', 'content/ui.ts'];

  /**
   * §6.5: «запросы к API — из service worker, не из content script».
   *
   * Content script живёт в песочнице чужой страницы. Запрос отсюда шёл бы
   * с origin площадки — со всеми последствиями для CORS и для сохранности
   * токена агентства.
   */
  it.each(CONTENT_FILES)('%s не ходит в сеть', (file) => {
    const source = read(file);

    expect(source).not.toMatch(/\bfetch\s*\(/u);
    expect(source).not.toContain('XMLHttpRequest');
    expect(source).not.toContain('navigator.sendBeacon');
  });

  /**
   * ПРАВИЛО 11, запретительная часть: «никогда не имитировать клик по кнопке
   * „показать телефон“ за агента».
   *
   * Свои кнопки расширение слушает через `addEventListener`, а не нажимает.
   * Появление `.click()` в content script означало бы, что кто-то решил
   * «помочь» агенту — и обошёл интерфейс площадки.
   */
  it.each(CONTENT_FILES)('%s не нажимает кнопки за агента', (file) => {
    expect(read(file)).not.toMatch(/\.click\s*\(\s*\)/u);
  });

  /**
   * ПРАВИЛО 12 живёт в фазе 6Б, но запрет на отправку формы дешевле
   * поставить сразу: в фазе 6 расширение форм не касается вовсе.
   */
  it.each(CONTENT_FILES)('%s не отправляет формы', (file) => {
    const source = read(file);
    expect(source).not.toMatch(/\.submit\s*\(\s*\)/u);
    expect(source).not.toContain('requestSubmit');
  });

  /**
   * В предпросмотр попадает чужой текст: заголовок объявления и адрес пишет
   * автор объявления. Один `innerHTML` с ним — и мы выполняем на странице
   * площадки то, что он туда вложил.
   */
  it('интерфейс собирается без innerHTML', () => {
    // Комментарии снимаются: упоминание `innerHTML` в пояснении, почему его
    // здесь нет, — это документация правила, а не его нарушение.
    const code = read('content/ui.ts')
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .replace(/\/\/.*$/gmu, '');

    expect(code).not.toContain('innerHTML');
    expect(code).not.toContain('insertAdjacentHTML');
  });

  /**
   * §6.3: «ничего чувствительного в localStorage». В content script
   * `localStorage` принадлежит домену площадки — токен агентства лежал бы
   * в песочнице ss.ge, доступный любому их скрипту.
   */
  it.each([...CONTENT_FILES, 'core/storage.ts', 'core/api-client.ts'])(
    '%s не трогает localStorage',
    (file) => {
      const source = read(file);
      // Упоминание в комментарии разрешено — оно объясняет, почему нельзя.
      const code = source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '');
      expect(code).not.toContain('localStorage');
      expect(code).not.toContain('sessionStorage');
    },
  );

  /**
   * Инвариант 6: логика площадки живёт только в адаптерах. Расширение
   * обращается к ним через `adapterFor` и про ss.ge с myhome не знает.
   */
  it.each(['core/import-manager.ts', 'content/content.ts', 'background/service-worker.ts'])(
    '%s не знает про разметку площадок',
    (file) => {
      const code = read(file)
        .replace(/\/\*[\s\S]*?\*\//gu, '')
        .replace(/\/\/.*$/gmu, '');

      // Адреса в манифесте и в шаблонах меню — это не знание о разметке,
      // поэтому проверяются селекторы и классы, а не имена доменов.
      expect(code).not.toContain('querySelector');
      expect(code).not.toContain('og:title');
      expect(code).not.toContain('icon-stairs');
    },
  );
});

// ── Интерфейс на трёх языках ─────────────────────────────────────────────────

/**
 * Правило 18: ни одной пользовательской строки в коде, все три языка
 * равноправны с первого дня.
 *
 * Проверяется поведением, а не чтением исходника: панель рисуется и с неё
 * читается текст. Утверждение «интерфейс переведён» иначе осталось бы
 * непроверенным — а грузинский здесь основной язык рынка.
 */
describe('интерфейс расширения', () => {
  function withDom<T>(run: () => T): T {
    // Подменяется только `document`: `navigator` в Node доступен лишь
    // на чтение, а интерфейсу он и не нужен — язык ему передают аргументом.
    const { document: dom } = parseHTML('<!doctype html><html><body></body></html>') as unknown as {
      document: Document;
    };

    const globals = globalThis as unknown as Record<string, unknown>;
    const saved = globals.document;

    globals.document = dom;
    try {
      return run();
    } finally {
      globals.document = saved;
    }
  }

  const PREVIEW = {
    title: 'ბინა',
    price: 179000,
    currency: 'USD',
    area: 85,
    rooms: 2,
    address: null,
    district: null,
    phone: '555000111',
    missingFields: ['address', 'district'],
  };

  it.each(LOCALES)('меню исхода разговора говорит на языке %s', (locale) => {
    const text = withDom(() => {
      const ui = new Ui(locale, () => undefined);
      ui.outcomeMenu(PREVIEW);
      return ui.content.textContent ?? '';
    });

    const t = translator(locale);
    expect(text).toContain(t('extension.callResult'));
    expect(text).toContain(t('extension.outcome.consent'));
    expect(text).toContain(t('extension.outcome.refused'));
    expect(text).toContain(t('extension.outcome.noAnswer'));
    expect(text).toContain(t('extension.outcome.callback'));

    // Дыра в переводе выглядит как ⟦ключ⟧ и должна быть заметна сразу.
    expect(text).not.toContain('⟦');
  });

  it.each(LOCALES)('блокировка по телефону объяснена на языке %s', (locale) => {
    const text = withDom(() => {
      const ui = new Ui(locale, () => undefined);
      ui.phoneNotRevealed(PREVIEW);
      return ui.content.textContent ?? '';
    });

    const t = translator(locale);
    expect(text).toContain(t('extension.phoneNotRevealed'));
    // DESIGN §25.1: одно очевидное следующее действие.
    expect(text).toContain(t('common.retry'));
    expect(text).not.toContain('⟦');
  });

  it('сводка показывает цену, площадь и незаполненные поля', () => {
    const text = withDom(() => {
      const ui = new Ui('ru', () => undefined);
      ui.outcomeMenu(PREVIEW);
      return ui.content.textContent ?? '';
    });

    // `Intl` рисует USD знаком доллара — проверяется то, что увидит агент,
    // а не код валюты. Валюта задаётся явно и из языка не выводится (Q13):
    // интерфейс русский, объект в долларах.
    expect(text).toContain(formatMoney('ru', 179000, 'USD'));
    expect(text).toContain('85');
    // Частичный успех — норма, и агент должен видеть, чего не хватает (§6.5).
    expect(text).toContain('address');
  });

  it('после отказа объяснена область: команда, а не компания', () => {
    // Конкуренция между командами разрешена владельцем, и прятать это
    // означало бы выдавать штатное поведение за дефект (DESIGN §25.4).
    const text = withDom(() => {
      const ui = new Ui('ru', () => undefined);
      ui.refusedRecorded();
      return ui.content.textContent ?? '';
    });

    expect(text).toContain(translate('ru', 'extension.refusedRecorded.scope'));
    expect(text).toContain(translate('ru', 'extension.refusedRecorded.doNotCall'));
  });

  it('жёсткий дубль не предлагает «добавить всё равно»', () => {
    // Вторая копия того же объекта в базе своей же команды бессмысленна.
    const blocked = withDom(() => {
      const ui = new Ui('ru', () => undefined);
      ui.duplicate('blocked', []);
      return ui.content.textContent ?? '';
    });
    expect(blocked).not.toContain(translate('ru', 'extension.duplicate.addAnyway'));

    // Предупреждение — другое дело: оно сообщает, а не запрещает.
    const warning = withDom(() => {
      const ui = new Ui('ru', () => undefined);
      ui.duplicate('warning', ['id-1']);
      return ui.content.textContent ?? '';
    });
    expect(warning).toContain(translate('ru', 'extension.duplicate.addAnyway'));
  });

  it('истёкшая сессия не предлагает бессмысленный повтор', () => {
    const text = withDom(() => {
      const ui = new Ui('ru', () => undefined);
      ui.error('session');
      return ui.content.textContent ?? '';
    });

    expect(text).toContain(translate('ru', 'extension.error.session'));
    expect(text).not.toContain(translate('ru', 'common.retry'));
  });

  it('заголовок объявления не исполняется как разметка', () => {
    // Заголовок пишет автор объявления. Это чужой текст на нашей панели.
    const text = withDom(() => {
      const ui = new Ui('ru', () => undefined);
      ui.outcomeMenu({ ...PREVIEW, address: '<img src=x onerror=alert(1)>' });
      return ui.content.textContent ?? '';
    });

    expect(text).toContain('<img src=x onerror=alert(1)>');
    expect(
      withDom(() => new Ui('ru', () => undefined).content.querySelectorAll('img').length),
    ).toBe(0);
  });
});
