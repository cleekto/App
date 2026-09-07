import { describe, expect, it } from 'vitest';

import { LOCALES } from '@kleekto/i18n';

import { listingText, listingTexts, type ListingFacts } from './listing-text';

/**
 * Текст объявления для формы площадки.
 *
 * Проверяется главное: в объявление, которое агент разместит под своим
 * именем, не попадает ничего выдуманного, и все три языка получаются
 * настоящими, а не копией русского.
 */

function facts(over: Partial<ListingFacts> = {}): ListingFacts {
  return {
    propertyType: 'APARTMENT',
    transactionType: 'SALE',
    rooms: 3,
    bedrooms: null,
    areaTotal: 72,
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
    ...over,
  };
}

describe('текст объявления', () => {
  it('собирается на всех трёх языках', () => {
    const texts = listingTexts(facts());

    expect(texts.map((one) => one.locale).sort()).toEqual([...LOCALES].sort());
    for (const one of texts) expect(one.text.length).toBeGreaterThan(0);
  });

  it('на разных языках получается РАЗНЫЙ текст', () => {
    /*
     * Иначе перевод только притворялся бы работающим: агент вставил бы
     * во все три поля myhome одно и то же, и площадка показала бы русский
     * текст грузинскому покупателю.
     */
    const [ka, en, ru] = ['ka', 'en', 'ru'].map((locale) =>
      listingText(locale as 'ka', facts({ condition: 'newly_renovated' })),
    );

    expect(ka).not.toBe(en);
    expect(en).not.toBe(ru);
    expect(ka).not.toBe(ru);
  });

  it('НЕ ПРИДУМЫВАЕТ того, чего нет (правило 14)', () => {
    // Пустое поле не превращается в «не указано»: такая строка в живом
    // объявлении хуже, чем её отсутствие.
    const text = listingText('ru', facts());

    expect(text).not.toMatch(/не указан|—|null|undefined/iu);
    expect(text).not.toContain('состояни');
    expect(text).not.toContain('роект');
  });

  it('заполненные характеристики попадают, каждая своей строкой', () => {
    const text = listingText('ru', facts({ condition: 'newly_renovated', projectType: 'czech' }));

    expect(text).toContain('Недавно отремонтированный');
    expect(text).toContain('Чешский');
  });

  it('незнакомое значение площадки выводится как есть, а не теряется', () => {
    /*
     * У площадок свои справочники, и наши покрывают не всё. Выбросить
     * было бы тише, но агент не узнал бы, что потерял то, что стояло
     * в объявлении.
     */
    const text = listingText('ru', facts({ condition: 'euro-remont-2024' }));

    expect(text).toContain('euro-remont-2024');
  });

  it('своё описание агента идёт первым', () => {
    // Перечень характеристик дополняет его текст, а не наоборот.
    const text = listingText('ru', facts({ publicDescription: 'Тихий двор, окна во двор.' }));

    expect(text.startsWith('Тихий двор, окна во двор.')).toBe(true);
  });

  it('нулевой этаж без дома не показывается', () => {
    // У участков площадка присылает `0` и ни одного этажа в доме.
    const text = listingText('ru', facts({ propertyType: 'LAND', floor: 0, totalFloors: null }));

    expect(text).not.toMatch(/\b0\b/u);
  });

  it('этаж показывается вместе с этажностью дома', () => {
    expect(listingText('ru', facts())).toContain('3/9');
  });
});
