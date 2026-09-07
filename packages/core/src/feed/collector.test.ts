import { describe, expect, it, vi } from 'vitest';

import type { CollectedPage, CollectorSource } from './collector';
import { runCollector } from './collector';

/**
 * Прогон сборщика — без сети и без базы.
 *
 * Сценарий на то и вынесен в ядро, чтобы его можно было прогнать целиком:
 * площадки он получает аргументом, а работу с индексом делают функции,
 * которые здесь подменены. Проверяется поведение прогона, а не разбор
 * разметки — тот проверен отдельно, на настоящих страницах.
 */

const ingest = vi.hoisted(() => vi.fn());
const queue = vi.hoisted(() => vi.fn());
const apply = vi.hoisted(() => vi.fn());
const applySignals = vi.hoisted(() => vi.fn());

vi.mock('./harvest', () => ({ ingestListings: ingest }));
vi.mock('./sellers', () => ({
  sellersToResolve: queue,
  applySellerKind: apply,
  applyListingSignals: applySignals,
}));

/** Признаки страницы объявления. Телефона в них нет по устройству. */
function signals(
  sellerKind: 'owner' | 'agency' | null,
  viewCount: number | null = 42,
): { sellerKind: 'owner' | 'agency' | null; viewCount: number | null; publishedAt: string | null } {
  return { sellerKind, viewCount, publishedAt: null };
}

function page(cards: number, failure: string | null = null): CollectedPage {
  return {
    url: 'https://example.invalid/l',
    failure,
    cards: Array.from({ length: cards }, (_, index) => ({
      externalId: `card-${String(index)}`,
      url: `https://example.invalid/${String(index)}`,
    })),
  };
}

function site(over: Partial<CollectorSource> = {}): CollectorSource {
  return {
    source: 'SS_GE',
    readLists: () => Promise.resolve([page(3)]),
    readListing: null,
    ...over,
  };
}

/** Сценарий спит между обращениями; в тестах ждать нечего. */
const nap = { sleep: () => Promise.resolve() };

describe('прогон сборщика', () => {
  it('складывает прочитанное в индекс', async () => {
    ingest.mockReset().mockResolvedValue({ accepted: 3, created: 2, sellersResolved: 0 });
    queue.mockReset().mockResolvedValue([]);

    const report = await runCollector([site()], nap);

    expect(ingest).toHaveBeenCalledTimes(1);
    expect(report.sources[0]).toMatchObject({
      pagesRead: 1,
      pagesFailed: 0,
      cardsSeen: 3,
      listingsCreated: 2,
    });
  });

  it('неудача одной страницы не отменяет остальные', async () => {
    /*
     * Площадка могла ответить ошибкой на один запрос из четырёх. Бросить
     * из-за этого весь прогон значило бы оставить агента без ленты до утра
     * из-за чужой пятисотой.
     */
    ingest.mockReset().mockResolvedValue({ accepted: 2, created: 2, sellersResolved: 0 });
    queue.mockReset().mockResolvedValue([]);

    const report = await runCollector(
      [site({ readLists: () => Promise.resolve([page(0, 'status'), page(2)]) })],
      nap,
    );

    expect(report.sources[0]).toMatchObject({ pagesRead: 1, pagesFailed: 1, listingsCreated: 2 });
    expect(ingest).toHaveBeenCalledTimes(1);
  });

  it('пустую страницу в индекс не отправляет', async () => {
    ingest.mockReset();
    queue.mockReset().mockResolvedValue([]);

    await runCollector([site({ readLists: () => Promise.resolve([page(0)]) })], nap);

    expect(ingest).not.toHaveBeenCalled();
  });

  it('НЕ ОТКРЫВАЕТ КАРТОЧКИ там, где площадка называет тип сама', async () => {
    /*
     * У myhome тип продавца стоит в самой карточке списка. Открывать её
     * объявления незачем, и сборщик этого не делает: лишнее обращение
     * к площадке ничего не даёт и видно только ей.
     */
    ingest.mockReset().mockResolvedValue({ accepted: 3, created: 0, sellersResolved: 0 });
    queue.mockReset().mockResolvedValue([]);

    await runCollector([site({ source: 'MYHOME_GE', readListing: null })], nap);

    expect(queue).not.toHaveBeenCalled();
  });

  it('опознаёт продавцов и разом зажигает их объявления', async () => {
    ingest.mockReset().mockResolvedValue({ accepted: 3, created: 3, sellersResolved: 0 });
    queue.mockReset().mockResolvedValue([
      {
        sellerId: 'a',
        observationId: 'obs-a',
        listingUrl: 'https://example.invalid/1',
        listingsSeen: 8,
      },
      {
        sellerId: 'b',
        observationId: 'obs-b',
        listingUrl: 'https://example.invalid/2',
        listingsSeen: 1,
      },
    ]);
    apply.mockReset().mockResolvedValueOnce(8).mockResolvedValueOnce(1);
    applySignals.mockReset().mockResolvedValue(undefined);

    const readListing = vi.fn().mockResolvedValue(signals('owner'));
    const report = await runCollector([site({ readListing })], nap);

    expect(readListing).toHaveBeenCalledTimes(2);
    expect(report.sources[0]).toMatchObject({
      sellersAsked: 2,
      sellersResolved: 2,
      // Одно обращение на продавца зажигает все его объявления — ради этого
      // сущность продавца и заведена.
      listingsLit: 9,
    });
  });

  it('невыясненный продавец не записывается наугад', async () => {
    // «Не знаю» и «собственник» — разные вещи. Страница не открылась —
    // продавец остаётся в очереди до следующего прогона.
    ingest.mockReset().mockResolvedValue({ accepted: 0, created: 0, sellersResolved: 0 });
    queue.mockReset().mockResolvedValue([
      {
        sellerId: 'a',
        observationId: 'obs-a',
        listingUrl: 'https://example.invalid/1',
        listingsSeen: 3,
      },
    ]);
    apply.mockReset();
    applySignals.mockReset().mockResolvedValue(undefined);

    const report = await runCollector(
      [site({ readListing: () => Promise.resolve(signals(null)) })],
      nap,
    );

    expect(apply).not.toHaveBeenCalled();
    expect(report.sources[0]).toMatchObject({ sellersAsked: 1, sellersResolved: 0 });
  });

  it('счётчик просмотров записывается даже когда тип выяснить не вышло', async () => {
    /*
     * Страница уже открыта. Второй раз ходить к площадке за тем же числом
     * было бы расточительством по отношению к ней и к нам.
     */
    ingest.mockReset().mockResolvedValue({ accepted: 0, created: 0, sellersResolved: 0 });
    queue.mockReset().mockResolvedValue([
      {
        sellerId: 'a',
        observationId: 'obs-a',
        listingUrl: 'https://x.invalid/1',
        listingsSeen: 1,
      },
    ]);
    apply.mockReset();
    applySignals.mockReset().mockResolvedValue(undefined);

    const report = await runCollector(
      [site({ readListing: () => Promise.resolve(signals(null, 1739)) })],
      nap,
    );

    expect(applySignals).toHaveBeenCalledWith('obs-a', signals(null, 1739));
    expect(apply).not.toHaveBeenCalled();
    expect(report.sources[0]).toMatchObject({ viewsRead: 1, sellersResolved: 0 });
  });

  it('держит паузу между обращениями к площадке', async () => {
    // Спешить сборщику некуда, а торопливость видна площадке первой.
    ingest.mockReset().mockResolvedValue({ accepted: 0, created: 0, sellersResolved: 0 });
    queue.mockReset().mockResolvedValue([
      {
        sellerId: 'a',
        observationId: 'obs-a',
        listingUrl: 'https://example.invalid/1',
        listingsSeen: 2,
      },
      {
        sellerId: 'b',
        observationId: 'obs-b',
        listingUrl: 'https://example.invalid/2',
        listingsSeen: 1,
      },
    ]);
    apply.mockReset().mockResolvedValue(0);
    applySignals.mockReset().mockResolvedValue(undefined);

    const sleep = vi.fn().mockResolvedValue(undefined);
    await runCollector([site({ readListing: () => Promise.resolve(signals('agency')) })], {
      sleep,
      pauseMs: 1500,
    });

    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1500);
  });

  it('нулевой бюджет означает «карточки не открывать вовсе»', async () => {
    ingest.mockReset().mockResolvedValue({ accepted: 0, created: 0, sellersResolved: 0 });
    queue.mockReset();

    await runCollector([site({ readListing: () => Promise.resolve(signals('owner')) })], {
      ...nap,
      sellerBudget: 0,
    });

    expect(queue).not.toHaveBeenCalled();
  });
});
