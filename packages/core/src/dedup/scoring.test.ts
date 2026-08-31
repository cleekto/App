import { describe, expect, it } from 'vitest';

import { compare, similarity, verdictFor, type Facts } from './scoring';

/**
 * Сверка с docs/architecture/duplicate-detection.md §3.
 *
 * Таблица «Проверка совпадений с примером из промпта» в документе обязана
 * воспроизводиться этими тестами точно. Если они разойдутся, разошлись
 * документ и код — и увидеть это надо здесь.
 */

const EMPTY: Facts = {
  phones: [],
  addressNormalized: null,
  area: null,
  rooms: null,
  floor: null,
  totalFloors: null,
  price: null,
  currency: null,
  propertyType: null,
  photos: [],
  district: null,
};

const facts = (over: Partial<Facts>): Facts => ({ ...EMPTY, ...over });

describe('веса и вердикты — сверка с документом', () => {
  it('телефон сам по себе даёт 0.50 и POSSIBLE', () => {
    // У одного собственника бывает несколько квартир — это норма,
    // а не аномалия, поэтому телефон один STRONG не даёт.
    const comparison = compare(
      facts({ phones: ['+995555123456'] }),
      facts({ phones: ['+995555123456'] }),
    );

    expect(comparison.score).toBeCloseTo(0.5, 2);
    expect(verdictFor(comparison)).toBe('POSSIBLE');
  });

  it('телефон + площадь + комнаты даёт 0.86 и STRONG', () => {
    // Ровно пример из промпта §5.3: 0.50 + 0.20 + 0.16.
    const a = facts({ phones: ['+995555123456'], area: 78, rooms: 3 });
    const b = facts({ phones: ['+995555123456'], area: 78, rooms: 3 });
    const comparison = compare(a, b);

    expect(comparison.score).toBeCloseTo(0.86, 2);
    expect(verdictFor(comparison)).toBe('STRONG');
  });

  it('телефон + адрес даёт STRONG правилом, хотя балл ниже порога', () => {
    const a = facts({ phones: ['+995555123456'], addressNormalized: 'ул вашлованская 12' });
    const b = facts({ phones: ['+995555123456'], addressNormalized: 'ул вашлованская 12' });
    const comparison = compare(a, b);

    expect(comparison.score).toBeCloseTo(0.7, 2);
    // Балл 0.70 ниже порога STRONG 0.80 — вердикт даёт правило уровня 3.
    expect(verdictFor(comparison)).toBe('STRONG');
  });

  it('все параметры без телефона дают 0.82 и STRONG', () => {
    const shape = {
      addressNormalized: 'ул вашлованская 12',
      area: 78,
      rooms: 3,
      floor: 5,
      totalFloors: 12,
      price: 145000,
      currency: 'USD',
      propertyType: 'APARTMENT',
      photos: ['https://ss.ge/photo/1.jpg'],
    };
    const comparison = compare(facts(shape), facts(shape));

    expect(comparison.score).toBeCloseTo(0.82, 2);
    expect(verdictFor(comparison)).toBe('STRONG');
  });

  it('площадь и комнаты без прочего дают 0.36 и NONE', () => {
    const comparison = compare(facts({ area: 78, rooms: 3 }), facts({ area: 78, rooms: 3 }));

    expect(comparison.score).toBeCloseTo(0.36, 2);
    expect(verdictFor(comparison)).toBe('NONE');
  });
});

describe('отсутствие данных', () => {
  it('признак, которого нет у одной стороны, не считается ни за, ни против', () => {
    const a = facts({ phones: ['+995555123456'], area: 78 });
    const b = facts({ phones: ['+995555123456'] });
    const comparison = compare(a, b);

    expect(comparison.comparable).toEqual(['ownerPhone']);
    expect(comparison.score).toBeCloseTo(0.5, 2);
  });

  it('два пустых набора не совпадают ни в чём', () => {
    const comparison = compare(EMPTY, EMPTY);

    expect(comparison.score).toBe(0);
    expect(comparison.comparable).toEqual([]);
    expect(verdictFor(comparison)).toBe('NONE');
  });

  it('число сравнимых признаков возвращается наружу', () => {
    // Два совпавших из двух сравнимых и два из девяти — разные ситуации,
    // и агент должен видеть разницу.
    const rich = facts({ phones: ['+995555123456'], area: 78, rooms: 3, floor: 5 });
    const comparison = compare(rich, rich);

    expect(comparison.comparable.length).toBe(4);
  });
});

describe('защита от ложного STRONG на бедных данных', () => {
  it('высокий балл при двух сравнимых признаках не поднимается выше POSSIBLE', () => {
    // Телефон и фото дают 0.62 — ниже порога, но проверим границу явно
    // на признаках, дающих 0.80+ при малом числе сравнимых.
    const a = facts({ addressNormalized: 'ул вашлованская 12', area: 78 });
    const b = facts({ addressNormalized: 'ул вашлованская 12', area: 78 });
    const comparison = compare(a, b);

    expect(comparison.comparable.length).toBe(2);
    expect(verdictFor(comparison)).not.toBe('STRONG');
  });
});

describe('допуски', () => {
  it('площадь в пределах двух процентов считается совпавшей', () => {
    const comparison = compare(
      facts({ phones: ['+995555123456'], area: 78, rooms: 3 }),
      facts({ phones: ['+995555123456'], area: 79, rooms: 3 }),
    );
    expect(comparison.matched).toContain('area');
  });

  it('площадь, отличающаяся на десять процентов, не совпадает', () => {
    const comparison = compare(facts({ area: 78 }), facts({ area: 86 }));
    expect(comparison.matched).not.toContain('area');
  });

  it('цена в разных валютах не сравнивается вовсе', () => {
    // Сравнивать 145000 USD с 145000 GEL бессмысленно, и «не совпало»
    // здесь было бы такой же ошибкой, как «совпало».
    const comparison = compare(
      facts({ price: 145000, currency: 'USD' }),
      facts({ price: 145000, currency: 'GEL' }),
    );
    expect(comparison.comparable).not.toContain('price');
  });
});

describe('сходство строк', () => {
  it('одинаковые строки дают единицу', () => {
    expect(similarity('ул вашлованская 12', 'ул вашлованская 12')).toBe(1);
  });

  it('запись с опечаткой остаётся похожей', () => {
    expect(similarity('ул вашлованская 12', 'ул вашлаванская 12')).toBeGreaterThan(0.6);
  });

  it('разные адреса не похожи', () => {
    expect(similarity('ул вашлованская 12', 'пр руставели 45')).toBeLessThan(0.3);
  });

  it('отсутствующий адрес даёт ноль, а не исключение', () => {
    expect(similarity(null, 'ул вашлованская 12')).toBe(0);
  });
});
