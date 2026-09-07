import type { Source } from '@kleekto/db';

import type { HarvestCard } from './harvest';
import { ingestListings } from './harvest';
import { applySellerKind, sellersToResolve } from './sellers';

/**
 * Прогон сборщика: наполнить ленту без участия агента.
 *
 * РАДИ ЧЕГО. Агент утром включает компьютер, открывает kleekTo и видит свежие
 * объявления — не заходя ни на одну площадку. Лента, которую наполняли
 * браузеры агентов, показывала им то, что они и так открыли; это и было
 * её главной поломкой.
 *
 * ЯДРО НЕ ЗНАЕТ О ПЛОЩАДКАХ, и здесь это видно буквально: ни одного адреса,
 * ни одного имени сайта. Как читать страницы, знает адаптер и передаёт сюда
 * готовыми функциями. Так инвариант «логика источника живёт только
 * в адаптере» остаётся целым, а сценарий при этом можно прогнать в тесте
 * без сети.
 *
 * ЛЕНТА — НЕ БАЗА. Прогон не создаёт ни одного объекта: объект появляется
 * только по «Согласен» после разговора (правило 0). Телефона здесь нет
 * вовсе — ни в списках, ни в опознании продавца.
 */

/** Что сборщик прочитал с одной страницы списка. */
export interface CollectedPage {
  url: string;
  cards: HarvestCard[];
  /** Короткая причина неудачи для журнала. `null` — всё вышло. */
  failure: string | null;
}

/**
 * Одна площадка глазами сценария: две способности и ничего больше.
 *
 * Обе передаются извне. Ядро не знает ни адресов, ни разметки — только то,
 * что списки можно прочитать, а тип продавца иногда приходится выяснять
 * отдельно.
 */
export interface CollectorSource {
  source: Source;
  /** Прочитать страницы списков. Одна неудача не отменяет остальные. */
  readLists(): Promise<CollectedPage[]>;
  /**
   * Узнать тип продавца по адресу любого его объявления.
   *
   * `null` означает «эта площадка называет тип сама, выяснять нечего» —
   * так у myhome. Тогда очередь опознания для неё не разбирается вовсе.
   */
  readSellerKind: ((listingUrl: string) => Promise<'owner' | 'agency' | null>) | null;
}

export interface CollectorOptions {
  /**
   * Сколько продавцов опознавать за прогон.
   *
   * Это единственное место, где сборщик открывает карточки, и потолок здесь
   * нужен не для нагрузки на нас, а для приличия по отношению к площадке.
   * Опознаётся продавец, а не объявление, поэтому и двух десятков за прогон
   * хватает, чтобы очередь не росла.
   */
  sellerBudget?: number | undefined;
  /** Пауза между обращениями к площадке. Спешить сборщику некуда. */
  pauseMs?: number | undefined;
  /** Подменяется в тестах. */
  sleep?: ((ms: number) => Promise<void>) | undefined;
}

export interface SourceReport {
  source: Source;
  pagesRead: number;
  pagesFailed: number;
  cardsSeen: number;
  listingsCreated: number;
  sellersAsked: number;
  sellersResolved: number;
  /** Сколько объявлений зажглось от опознанных продавцов. */
  listingsLit: number;
}

export interface CollectorReport {
  startedAt: string;
  finishedAt: string;
  sources: SourceReport[];
}

const DEFAULT_SELLER_BUDGET = 20;
const DEFAULT_PAUSE_MS = 1000;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export async function runCollector(
  sources: readonly CollectorSource[],
  options: CollectorOptions = {},
): Promise<CollectorReport> {
  const budget = options.sellerBudget ?? DEFAULT_SELLER_BUDGET;
  const pause = options.pauseMs ?? DEFAULT_PAUSE_MS;
  const sleep = options.sleep ?? wait;

  const startedAt = new Date().toISOString();
  const reports: SourceReport[] = [];

  for (const site of sources) {
    const report: SourceReport = {
      source: site.source,
      pagesRead: 0,
      pagesFailed: 0,
      cardsSeen: 0,
      listingsCreated: 0,
      sellersAsked: 0,
      sellersResolved: 0,
      listingsLit: 0,
    };

    const pages = await site.readLists();

    for (const page of pages) {
      if (page.failure !== null) {
        report.pagesFailed += 1;
        continue;
      }

      report.pagesRead += 1;
      report.cardsSeen += page.cards.length;

      if (page.cards.length === 0) continue;

      const result = await ingestListings(site.source, page.cards);
      report.listingsCreated += result.created;
    }

    /*
     * ОЧЕРЕДЬ ОПОЗНАНИЯ — только там, где площадка тип не называет.
     *
     * У myhome `readSellerKind` пуст, и карточки её объявлений не открываются
     * никогда: незачем. У ss.ge иначе — без этого шага лента собственников
     * по ней остаётся пустой навсегда.
     */
    if (site.readSellerKind !== null && budget > 0) {
      const queue = await sellersToResolve(site.source, budget);

      for (const seller of queue) {
        await sleep(pause);

        report.sellersAsked += 1;
        const kind = await site.readSellerKind(seller.listingUrl);
        if (kind === null) continue;

        report.sellersResolved += 1;
        report.listingsLit += await applySellerKind(seller.sellerId, kind, 'listing');
      }
    }

    reports.push(report);
  }

  return { startedAt, finishedAt: new Date().toISOString(), sources: reports };
}
