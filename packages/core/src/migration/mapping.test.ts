import { describe, expect, it } from 'vitest';

import {
  SKIP,
  applyMapping,
  parseDecimal,
  parseMoney,
  parsePropertyType,
  parseTransactionType,
  suggestMapping,
} from './mapping';

/**
 * Заголовки в реальных выгрузках агентств написаны на трёх языках вперемешку,
 * часто сокращённо. Автоматическое предложение экономит время, но остаётся
 * подсказкой: решение принимает человек на экране сопоставления (§6Г.2).
 */

describe('предложение сопоставления', () => {
  it('узнаёт колонки на трёх языках в одном файле', () => {
    const columns = ['ფართობი', 'Цена $', 'тел', 'Address', 'Комн.', 'რაიონი'];
    const mapping = suggestMapping(columns);

    expect(mapping['ფართობი']).toBe('area');
    expect(mapping['Цена $']).toBe('price');
    expect(mapping['тел']).toBe('ownerPhone');
    expect(mapping['Address']).toBe('address');
    expect(mapping['Комн.']).toBe('rooms');
    expect(mapping['რაიონი']).toBe('district');
  });

  it('«всего этажей» не перехватывает поле у «этаж»', () => {
    // Длинный псевдоним должен выигрывать у короткого, иначе колонка
    // «Этажность» заберёт floor и настоящий этаж останется без поля.
    const mapping = suggestMapping(['Этаж', 'Всего этажей']);

    expect(mapping['Этаж']).toBe('floor');
    expect(mapping['Всего этажей']).toBe('totalFloors');
  });

  it('одно поле не достаётся двум колонкам', () => {
    const mapping = suggestMapping(['Телефон', 'Телефон 2']);
    const values = Object.values(mapping).filter((value) => value === 'ownerPhone');
    expect(values).toHaveLength(1);
  });

  it('неузнанная колонка помечается пропуском, а не исчезает', () => {
    // Молча выброшенная колонка — та, про которую потом будут спорить,
    // была ли она в файле.
    const mapping = suggestMapping(['Внутренний код объекта', 'Ответственный менеджер']);

    expect(mapping['Внутренний код объекта']).toBe(SKIP);
    expect(mapping['Ответственный менеджер']).toBe(SKIP);
    expect(Object.keys(mapping)).toHaveLength(2);
  });

  it('пустой заголовок не ломает предложение', () => {
    const mapping = suggestMapping(['', '  ', 'Цена']);
    expect(mapping['']).toBe(SKIP);
    expect(mapping['Цена']).toBe('price');
  });
});

describe('цена и валюта в одной колонке', () => {
  // «Лари и доллары в одной колонке» — прямая цитата из §6Г.2.
  it.each([
    ['145 000 $', 145000, 'USD'],
    ['$145000', 145000, 'USD'],
    ['145000 USD', 145000, 'USD'],
    ['1 450 000 ₾', 1450000, 'GEL'],
    ['1450000 лари', 1450000, 'GEL'],
    ['3 200 €', 3200, 'EUR'],
  ])('«%s» → %s %s', (input, amount, currency) => {
    const money = parseMoney(input);
    expect(money.amount).toBe(amount);
    expect(money.currency).toBe(currency);
  });

  it('валюта из соседней колонки применяется, когда в цене её нет', () => {
    expect(parseMoney('145000', 'USD')).toEqual({ amount: 145000, currency: 'USD' });
  });

  it('валюта рядом с числом важнее колонки «Валюта»', () => {
    // В файле колонка валюты может быть заполнена наспех, а знак у числа
    // ставят осознанно.
    expect(parseMoney('1450000 ₾', 'USD').currency).toBe('GEL');
  });

  it('пустая цена не превращается в ноль', () => {
    expect(parseMoney('')).toEqual({ amount: null, currency: null });
    expect(parseMoney('договорная').amount).toBeNull();
  });
});

describe('числа, записанные как угодно', () => {
  it.each([
    ['1 450 000', 1450000],
    ['1,450,000', 1450000],
    ['1.450.000', 1450000],
    ['78,5', 78.5],
    ['78.5', 78.5],
    ['78', 78],
    ['  120  ', 120],
  ])('«%s» → %s', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });

  it('нечисло даёт null, а не ноль', () => {
    // Ноль в базе выглядел бы как настоящее значение.
    expect(parseDecimal('нет данных')).toBeNull();
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('—')).toBeNull();
  });
});

describe('типы недвижимости и сделки', () => {
  it.each([
    ['Квартира', 'APARTMENT'],
    ['квартира 3-комн', 'APARTMENT'],
    ['Дом', 'HOUSE'],
    ['земельный участок', 'LAND'],
    ['Офис', 'COMMERCIAL'],
    ['ბინა', 'APARTMENT'],
  ])('«%s» → %s', (input, expected) => {
    expect(parsePropertyType(input)).toBe(expected);
  });

  it.each([
    ['Продажа', 'SALE'],
    ['аренда', 'RENT'],
    ['Rent', 'RENT'],
    ['ქირა', 'RENT'],
  ])('«%s» → %s', (input, expected) => {
    expect(parseTransactionType(input)).toBe(expected);
  });

  it('незнакомое значение даёт null, а не «ближайшее похожее»', () => {
    // Придуманных значений не бывает — то же правило, что и в форме
    // размещения (правило 14).
    expect(parsePropertyType('склад-ангар особого типа')).toBeNull();
  });
});

describe('применение сопоставления к строке', () => {
  const columns = ['Улица', 'Дом', 'Цена', 'Мусор'];

  it('несколько колонок в одно поле склеиваются, а не затирают друг друга', () => {
    // Адрес в выгрузках часто разнесён на «улица» и «дом».
    const mapped = applyMapping(columns, ['Чавчавадзе', '30', '145000', 'x'], {
      Улица: 'address',
      Дом: 'address',
      Цена: 'price',
      Мусор: SKIP,
    });

    expect(mapped.address).toBe('Чавчавадзе 30');
    expect(mapped.price).toBe('145000');
  });

  it('пропущенная колонка в результат не попадает', () => {
    const mapped = applyMapping(columns, ['a', 'b', 'c', 'секрет'], {
      Улица: SKIP,
      Дом: SKIP,
      Цена: SKIP,
      Мусор: SKIP,
    });

    expect(Object.keys(mapped)).toHaveLength(0);
  });

  it('пустая ячейка не создаёт пустое поле', () => {
    const mapped = applyMapping(columns, ['', '', '145000', ''], {
      Улица: 'address',
      Дом: 'address',
      Цена: 'price',
      Мусор: SKIP,
    });

    expect(mapped.address).toBeUndefined();
    expect(mapped.price).toBe('145000');
  });
});
