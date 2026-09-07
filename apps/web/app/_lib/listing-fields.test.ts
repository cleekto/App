import { describe, expect, it } from 'vitest';

import { listingFields } from './listing-fields';
import type { ListingFacts } from './listing-text';

/**
 * Значения для формы площадки.
 *
 * Главное здесь одно: то, что агент скопирует, форма должна принять.
 * Красивое число с разделителем разрядов она либо отвергнет, либо поймёт
 * неправильно — и заметить это в чужой форме почти невозможно.
 */

function facts(
  over: Partial<ListingFacts & { price: number | null; cadastralCode: string | null }> = {},
) {
  return {
    propertyType: 'APARTMENT',
    transactionType: 'SALE',
    rooms: 3,
    bedrooms: null,
    areaTotal: 72.5,
    floor: 3,
    totalFloors: 9,
    district: 'Ваке',
    addressRaw: null,
    bathrooms: null,
    balconies: null,
    balconyArea: null,
    houseArea: null,
    yardArea: null,
    condition: null,
    buildingStatus: null,
    projectType: null,
    publicDescription: null,
    price: 1200000,
    cadastralCode: null,
    ...over,
  };
}

describe('значения для формы', () => {
  it('ЧИСЛА БЕЗ РАЗДЕЛИТЕЛЕЙ И ВАЛЮТЫ', () => {
    /*
     * «1 200 000 US$» форма не примет. Хуже того, разделитель разрядов
     * в русской и грузинской раскладке — неразрывный пробел: глазом
     * его не видно, а поле ломается молча.
     */
    const price = listingFields('ru', facts()).find((f) => f.value.includes('1200000'));

    expect(price?.value).toBe('1200000');
    expect(price?.value).not.toMatch(/[\s\u00a0$]/u);
  });

  it('дробная площадь остаётся дробной, с точкой', () => {
    const area = listingFields('ru', facts()).find((f) => f.value === '72.5');
    expect(area).toBeDefined();
  });

  it('пустые поля не показываются вовсе', () => {
    // Строка «Кадастровый код: —» ничего не даёт: агент тянется скопировать
    // и обнаруживает пустоту.
    const labels = listingFields('ru', facts()).map((f) => f.label);

    expect(labels).not.toContain('Кадастровый код');
    expect(labels).not.toContain('Адрес');
  });

  it('порядок — тот, в каком спрашивает форма площадки', () => {
    // Место, цена, площадь, этажи. Свой порядок заставил бы агента искать
    // строку глазами при каждом переносе.
    const labels = listingFields('ru', facts({ addressRaw: 'ул. Чавчавадзе 5' })).map(
      (f) => f.label,
    );

    expect(labels.indexOf('Район')).toBeLessThan(labels.indexOf('Адрес'));
    expect(labels.indexOf('Адрес')).toBeLessThan(labels.indexOf('Цена'));
    expect(labels.indexOf('Цена')).toBeLessThan(labels.indexOf('Площадь, м²'));
    expect(labels.indexOf('Площадь, м²')).toBeLessThan(labels.indexOf('Этаж'));
  });

  it('подписи переводятся, значения — нет', () => {
    const ka = listingFields('ka', facts());
    const ru = listingFields('ru', facts());

    expect(ka.map((f) => f.label)).not.toEqual(ru.map((f) => f.label));
    expect(ka.map((f) => f.value)).toEqual(ru.map((f) => f.value));
  });
});
