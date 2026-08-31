import { describe, expect, it } from 'vitest';

import { normalizePhone } from '../phone';
import { sanitizePublicText } from './sanitize';

/**
 * ГЕЙТ ФАЗЫ 4Б. Требование: черновик не содержит номер собственника
 * НИ В ОДНОЙ НОРМАЛИЗАЦИИ (правило 13, риск R-25).
 *
 * Это единственное место проекта, где одна ошибка бьёт по третьему лицу:
 * номер собственника в публичном объявлении — спам собственнику,
 * потерянный эксклюзив агентства и инцидент с персональными данными
 * одновременно.
 */

const OWNER_PHONE = '+995555123456';

/** Все записи одного и того же номера, какие встречаются у людей. */
const WRITINGS = [
  '+995555123456',
  '+995 555 123 456',
  '+995 555 12 34 56',
  '+995-555-123-456',
  '995555123456',
  '995 555 123 456',
  '0555123456',
  '0555 12 34 56',
  '555123456',
  '555 12 34 56',
  '555-12-34-56',
  '(555) 123-456',
];

describe('телефон собственника не переживает очистку', () => {
  it.each(WRITINGS)('запись «%s» вырезается', (writing) => {
    const result = sanitizePublicText(`Продаётся квартира. Звоните: ${writing}, Гиорги.`, {
      ownerPhones: [OWNER_PHONE],
      ownerName: 'Гиорги',
    });

    // Ни одна из записей не должна остаться в тексте.
    expect(result.text).not.toContain(writing);
    // И нормализованный вид тоже не должен собираться из остатков цифр.
    const digitsLeft = result.text.replace(/\D/gu, '');
    expect(digitsLeft).not.toContain('555123456');
  });

  it('номер, которого нет в карточке контакта, тоже вырезается', () => {
    // Собственник вписал в текст второй номер. Карточка о нём не знает,
    // но на площадку он уйти не должен.
    const result = sanitizePublicText('Звонить на +995 577 98 76 54 после 18:00');

    expect(result.text).not.toContain('577');
    expect(result.removedPhones).toBeGreaterThan(0);
  });

  it('несколько номеров в одном тексте вырезаются все', () => {
    const result = sanitizePublicText(
      'Телефоны: +995 555 12 34 56 и 0577 98 76 54, звонить в любое время',
    );

    expect(result.text.replace(/\D/gu, '')).not.toContain('555123456');
    expect(result.text.replace(/\D/gu, '')).not.toContain('577987654');
    expect(result.removedPhones).toBeGreaterThanOrEqual(2);
  });

  it('имя собственника вырезается независимо от регистра', () => {
    const result = sanitizePublicText('Хозяин ГИОРГИ покажет квартиру. Гиорги на связи.', {
      ownerName: 'Гиорги',
    });

    expect(result.text.toLowerCase()).not.toContain('гиорги');
    expect(result.removedName).toBe(true);
  });
});

describe('очистка не портит объявление', () => {
  it('цена остаётся на месте', () => {
    // 145000 — шесть цифр, номер — девять. Вырезать цену значило бы
    // испортить объявление ради защиты, которая здесь не нужна.
    const result = sanitizePublicText('Цена 145000 USD, торг уместен');
    expect(result.text).toContain('145000');
  });

  it('цена с разделителями остаётся на месте', () => {
    const result = sanitizePublicText('Цена 1 450 000 лари');
    expect(result.text).toContain('1 450 000');
  });

  it('площадь, этаж и год не считаются телефонами', () => {
    const result = sanitizePublicText('78 м², 5 этаж из 12, дом 2019 года');
    expect(result.text).toContain('78');
    expect(result.text).toContain('2019');
    expect(result.removedPhones).toBe(0);
  });

  it('текст без номеров не меняется по существу', () => {
    const source = 'Светлая квартира в Сабуртало, рядом метро, свежий ремонт.';
    expect(sanitizePublicText(source).text).toBe(source);
  });

  it('пустой текст не ломает очистку', () => {
    expect(sanitizePublicText(null).text).toBe('');
    expect(sanitizePublicText('').text).toBe('');
    expect(sanitizePublicText('   ').text).toBe('');
  });

  it('короткое имя не вырезается', () => {
    // Имя из двух букв встретилось бы в каждом слове.
    const result = sanitizePublicText('Ремонт от застройщика', { ownerName: 'Ан' });
    expect(result.text).toContain('Ремонт');
    expect(result.removedName).toBe(false);
  });
});

describe('согласованность с нормализатором', () => {
  it('всё, что нормализатор считает номером, очистка вырезает', () => {
    // Два слоя защиты обязаны опираться на одно определение телефона.
    // Если нормализатор научится новому формату, очистка обязана научиться
    // тому же автоматически — иначе появится формат, который проходит.
    for (const writing of WRITINGS) {
      expect(() => normalizePhone(writing)).not.toThrow();

      const result = sanitizePublicText(`Контакт ${writing}`);
      expect(result.removedPhones).toBeGreaterThan(0);
    }
  });
});
