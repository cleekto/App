import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * СХЕМА ПРИЁМА ОБЯЗАНА ЗНАТЬ ВСЕ ПОЛЯ КАРТОЧКИ.
 *
 * Так эта проверка появилась. Поле `publishedAt` добавили в карточку выдачи
 * уже после того, как схема маршрута была написана. Схема объявлена
 * `.strict()` — и стала отвергать КАЖДУЮ пачку от расширения как невалидную.
 *
 * Заметить было неоткуда. Сбор задуман тихим: агент не просил собирать,
 * он просто смотрел выдачу, и сообщение об ошибке там было бы шумом.
 * Поэтому `feed.ts` глотает отказ — и глотал его несколько дней, пока лента
 * по myhome оставалась пустой. Серверный сборщик ss.ge работал: он зовёт
 * сценарий напрямую, минуя HTTP и эту схему.
 *
 * Набор читает ИСХОДНИКИ, а не запускает запрос: одна сторона живёт
 * в адаптерах, другая в маршруте, и общего места, где ошибка вылезла бы
 * сама, у них нет.
 */

const ROOT = join(import.meta.dirname, '..');

const card = readFileSync(join(ROOT, 'packages/adapters/src/search-results.ts'), 'utf8');
const route = readFileSync(join(ROOT, 'apps/web/app/api/v1/observations/batch/route.ts'), 'utf8');

/** Поля `SearchCard` — то, что расширение действительно отправляет. */
function cardFields(): string[] {
  const start = card.indexOf('export interface SearchCard {');
  expect(start).toBeGreaterThan(-1);

  const body = card.slice(start, card.indexOf('\n}', start));

  return [...body.matchAll(/^\s{2}(\w+):/gmu)].map((match) => match[1] as string);
}

/**
 * Поля, объявленные в схеме маршрута.
 *
 * Границей взята закрывающая скобка объекта, а НЕ первое вхождение
 * `.strict()`: комментарии в схеме упоминают его словами, и разбор
 * обрывался на середине — проверка находила «пропажу» там, где всё
 * было на месте. Проверка, которая врёт, хуже отсутствующей.
 */
function schemaFields(): string[] {
  const start = route.indexOf('const cardSchema');
  expect(start).toBeGreaterThan(-1);

  const end = route.indexOf('\n  })', start);
  expect(end).toBeGreaterThan(start);

  return [...route.slice(start, end).matchAll(/^\s{4}(\w+):/gmu)].map(
    (match) => match[1] as string,
  );
}

describe('приём карточек выдачи', () => {
  it('схема знает каждое поле карточки', () => {
    const missing = cardFields().filter((field) => !schemaFields().includes(field));

    // Каждое лишнее поле в теле запроса — не «поле проигнорировано»,
    // а отказ всей пачки: схема строгая.
    expect(missing).toEqual([]);
  });

  it('схема не выдумывает полей, которых в карточке нет', () => {
    // Обратная сторона: поле в схеме, которого никто не шлёт, — след
    // переименования, и через месяц никто не вспомнит, зачем оно.
    const extra = schemaFields().filter((field) => !cardFields().includes(field));

    expect(extra).toEqual([]);
  });

  it('схема остаётся строгой', () => {
    /*
     * Соблазн при этой поломке — снять `.strict()`. Нельзя: строгость здесь
     * и есть защита. Незнакомое поле в теле запроса означает, что расширение
     * и сервер разошлись, и узнать об этом лучше отказом, чем молчаливым
     * проглатыванием половины данных.
     */
    expect(route).toContain('.strict()');
  });
});
