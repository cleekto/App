import { describe, expect, it } from 'vitest';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { COLLECTOR_PAGES, harvestHtml, sellerKindFromListingHtml } from './collector';
import { FIXTURE_ROOT } from './fixtures';

/**
 * Сборщик: чтение страниц площадок с сервера.
 *
 * Разбирается та же разметка, что приходит по сети, — сохранённые страницы
 * и есть её точная копия. Сети в этих проверках нет: `fetch` подменяется,
 * а разбор проверяется на настоящих файлах.
 */

function saved(site: 'ss-ge' | 'myhome-ge', folder: 'search' | 'listings'): string[] {
  try {
    const dir = join(FIXTURE_ROOT, site, folder);
    return readdirSync(dir)
      .filter((name) => name.endsWith('.html'))
      .map((name) => readFileSync(join(dir, name), 'utf8'));
  } catch {
    return [];
  }
}

describe('адреса, которые читает сборщик', () => {
  it('только списки, только известные площадки', () => {
    expect(COLLECTOR_PAGES.length).toBeGreaterThan(0);

    for (const page of COLLECTOR_PAGES) {
      const url = new URL(page.url);

      expect(['home.ss.ge']).toContain(url.hostname);
      expect(url.protocol).toBe('https:');

      /*
       * Страниц объявлений в этом списке быть не должно: сборщик открывает
       * карточку только ради типа продавца и только по очереди опознания,
       * а не пачкой по расписанию.
       */
      expect(url.pathname).toMatch(/\/l\/|\/udzravi-qoneba\/(iyideba|qiravdeba)\//u);
    }
  });

  it('myhome сюда не входит: он за Cloudflare, и долбить заслон незачем', () => {
    /*
     * Проверено прогоном: программному клиенту myhome отдаёт «Just a moment…»
     * и 403, три страницы из трёх. Настойчивый клиент, который бьётся
     * в проверку каждый час, — первое, что площадка блокирует насовсем.
     * По myhome работает расширение: браузер агента проходит проверку сам.
     *
     * Проверка стоит здесь, чтобы адреса myhome не вернулись в расписание
     * незаметно — вернуть их можно осознанно, когда появится доступ к API.
     */
    const sources = new Set(COLLECTOR_PAGES.map((page) => page.source));

    expect(sources).toContain('SS_GE');
    expect(sources).not.toContain('MYHOME_GE');
  });
});

describe('разбор скачанной разметки', () => {
  it('пустая строка и мусор не роняют разбор', () => {
    expect(harvestHtml('')).toBeNull();
    expect(harvestHtml('<html><body>ничего</body></html>')).toBeNull();
    expect(harvestHtml('<script id="__NEXT_DATA__">{сломано</script>')).toBeNull();
  });

  it('разметка без блока данных — не находка, а тишина', () => {
    // Площадка сменила устройство страницы. Молчим и ждём следующего
    // прогона: падать посреди ночи из-за чужой правки незачем.
    expect(harvestHtml('<script id="OTHER">{"props":{}}</script>')).toBeNull();
  });
});

const ssSearch = saved('ss-ge', 'search');
const myhomeSearch = saved('myhome-ge', 'search');

describe.runIf(ssSearch.length + myhomeSearch.length > 0)(
  'разбор настоящих страниц без DOM',
  () => {
    it('в сохранённых страницах находятся списки обеих площадок', () => {
      const sources = new Set(
        [...ssSearch, ...myhomeSearch]
          .map((html) => harvestHtml(html))
          .filter((one) => one !== null)
          .map((one) => one.source),
      );

      expect(sources).toContain('SS_GE');
      expect(sources).toContain('MYHOME_GE');
    });

    it('у карточек есть дата публикации — ради неё сборщик и нужен', () => {
      /*
       * Сам ss.ge сортирует выдачу по времени «поднятия»: на сохранённой
       * странице третьим шло объявление, созданное в 2023 году. Порядок
       * по настоящей дате публикации — то, чего сайт не показывает,
       * а лента показывает.
       */
      const cards = [...ssSearch, ...myhomeSearch].flatMap(
        (html) => harvestHtml(html)?.cards ?? [],
      );
      expect(cards.length).toBeGreaterThan(0);

      const dated = cards.filter((one) => one.publishedAt !== null);
      expect(dated.length).toBeGreaterThan(0);

      for (const one of dated) {
        expect(Number.isNaN(new Date(one.publishedAt as string).getTime())).toBe(false);
      }
    });

    it('ТЕЛЕФОНОВ В СОБРАННОМ НЕТ НИ ОДНОГО', () => {
      // Лента — не база. Номер собственника появляется в системе только
      // после того, как агент раскрыл его сам и получил согласие
      // (правила 0 и 11). Сборщик к номерам не прикасается вовсе.
      const cards = [...ssSearch, ...myhomeSearch].flatMap(
        (html) => harvestHtml(html)?.cards ?? [],
      );

      for (const one of cards) {
        expect(JSON.stringify(one)).not.toMatch(/(?:\+?995)?5\d{8}/u);
      }
    });
  },
);

/**
 * Страницы объявлений ss.ge, где площадка называет тип продавца.
 *
 * Берутся отовсюду, где они могут лежать, и дополняются снимками данных:
 * маршрут страниц ss.ge однажды уже сменился, и часть старых сохранённых
 * файлов `applicationData` больше не содержит. Привязываться к одной папке
 * значило бы получить набор, который «проходит», ничего не проверив.
 */
const ssListings = (() => {
  const html = [...saved('ss-ge', 'listings'), ...saved('ss-ge', 'search')];

  try {
    const dir = join(FIXTURE_ROOT, 'ss-ge', 'payload');
    const snapshots = readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => {
        const data = readFileSync(join(dir, name), 'utf8');
        return `<script id="__NEXT_DATA__">${JSON.stringify({
          props: { pageProps: { applicationData: JSON.parse(data) as unknown } },
        })}</script>`;
      });

    return [...html, ...snapshots];
  } catch {
    return html;
  }
})();

describe.runIf(ssListings.length > 0)('опознание продавца по странице объявления', () => {
  it('возвращает тип и НИЧЕГО КРОМЕ ТИПА', () => {
    /*
     * САМОЕ ЧУВСТВИТЕЛЬНОЕ МЕСТО СБОРЩИКА. На странице объявления ss.ge
     * телефон лежит в данных ДО того, как человек нажал «показать номер».
     * Функция читает одно поле и по устройству не может вернуть ничего
     * другого — эта проверка утверждает именно это, а не намерение.
     */
    const kinds = ssListings.map((html) => sellerKindFromListingHtml(html));

    expect(kinds.some((kind) => kind !== null)).toBe(true);

    for (const kind of kinds) {
      expect([null, 'owner', 'agency']).toContain(kind);
    }
  });

  it('чужая разметка не опознаётся молча как собственник', () => {
    // «Не знаю» и «собственник» — разные вещи, и ошибка в эту сторону
    // стоит агенту звонка посреднику.
    expect(sellerKindFromListingHtml('<html></html>')).toBeNull();
    expect(
      sellerKindFromListingHtml('<script id="__NEXT_DATA__">{"props":{}}</script>'),
    ).toBeNull();
  });
});
