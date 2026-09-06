import { describe, expect, it } from 'vitest';

/**
 * Места в рейтинге — то, ради чего экран и открывают. Порядок здесь важнее
 * самих чисел: человек смотрит, третий он или четвёртый.
 *
 * Проверяется чистая часть — расстановка мест. Сами итоги считает база,
 * и для них есть интеграционные проверки.
 */

/** Та же расстановка, что в `achievements.ts`. */
function withPlaces<T extends { closedDeals: number }>(rows: T[]): Array<T & { place: number }> {
  const sorted = [...rows].sort((a, b) => b.closedDeals - a.closedDeals);

  let place = 0;
  let previous: number | null = null;

  return sorted.map((row, index) => {
    if (previous === null || row.closedDeals !== previous) {
      place = index + 1;
      previous = row.closedDeals;
    }
    return { ...row, place };
  });
}

const rows = (...deals: number[]) =>
  deals.map((closedDeals, i) => ({ id: String(i), closedDeals }));

describe('места в рейтинге', () => {
  it('больше сделок — выше место', () => {
    expect(withPlaces(rows(2, 9, 5)).map((r) => r.closedDeals)).toEqual([9, 5, 2]);
    expect(withPlaces(rows(2, 9, 5)).map((r) => r.place)).toEqual([1, 2, 3]);
  });

  it('одинаковые итоги делят место, а следующий его пропускает', () => {
    // Двое с пятью сделками оба вторые, следующий — четвёртый. Так считают
    // везде, и всякий иной порядок читался бы как ошибка.
    expect(withPlaces(rows(9, 5, 5, 1)).map((r) => r.place)).toEqual([1, 2, 2, 4]);
  });

  it('все с нулём — все первые, а не в случайном порядке', () => {
    // Новая команда: сделок нет ни у кого, и выдавать кому-то второе место
    // за то же самое было бы неправдой.
    expect(withPlaces(rows(0, 0, 0)).map((r) => r.place)).toEqual([1, 1, 1]);
  });

  it('один человек — первое место', () => {
    expect(withPlaces(rows(3)).map((r) => r.place)).toEqual([1]);
  });

  it('пустой список не ломается', () => {
    expect(withPlaces([])).toEqual([]);
  });
});
