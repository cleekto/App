import {
  COLLECTOR_PAGES,
  fetchListPage,
  fetchListingSignals,
  type CollectorPage,
} from '@kleekto/adapters';
import type { CollectedPage, CollectorSource } from '@kleekto/core';

/**
 * Проводка сборщика: какие площадки читать и чем.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ ФАЙЛ. Сценарий прогона живёт в ядре и о площадках не знает
 * ни строчки — ни адреса, ни имени сайта. Как читать страницы, знает адаптер.
 * Здесь эти две половины соединяются, и только здесь.
 *
 * ss.ge и myhome различаются одним: myhome называет тип продавца прямо
 * в списке, поэтому карточки её объявлений не открываются никогда
 * (`readSellerKind: null`). У ss.ge типа в списке нет, и без открытия одной
 * карточки НА ПРОДАВЦА лента собственников по ней остаётся пустой.
 */

function pagesOf(source: 'SS_GE' | 'MYHOME_GE'): CollectorPage[] {
  return COLLECTOR_PAGES.filter((page) => page.source === source);
}

/** Прочитать все страницы одной площадки, не спеша и не сдаваясь на первой. */
async function readLists(source: 'SS_GE' | 'MYHOME_GE'): Promise<CollectedPage[]> {
  const pages: CollectedPage[] = [];

  for (const page of pagesOf(source)) {
    const outcome = await fetchListPage(page);

    pages.push({
      url: outcome.url,
      cards: outcome.harvest?.cards ?? [],
      failure: outcome.failure,
    });
  }

  return pages;
}

/**
 * Площадки, которые читает сборщик.
 *
 * MYHOME.GE ОТСЮДА ИСКЛЮЧЁН: он стоит за Cloudflare, и программному клиенту
 * приходит «Just a moment…» вместо страницы. Подробности и что с этим
 * делать — в `COLLECTOR_PAGES`. По нему работает расширение: браузер агента
 * проходит проверку сам, потому что он и есть браузер.
 *
 * Список пустеет сам, если из `COLLECTOR_PAGES` убрать площадку: `readLists`
 * вернёт пусто, и прогон её просто не заметит.
 */
export function collectorSources(): CollectorSource[] {
  return [
    {
      source: 'SS_GE',
      readLists: () => readLists('SS_GE'),
      /*
       * Единственное место, где сборщик открывает страницу объявления.
       * Читаются три величины: тип продавца, счётчик просмотров и дата
       * публикации. Телефон, который лежит на той же странице ещё до нажатия
       * «показать номер», не разбирается и никуда не уходит: лента — не база,
       * номер попадает в систему только после разговора и согласия
       * (правила 0 и 11).
       */
      readListing: (listingUrl: string) => fetchListingSignals(listingUrl),
    },
  ];
}
