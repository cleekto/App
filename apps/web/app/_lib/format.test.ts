import { LOCALES } from '@kleekto/i18n';
import { describe, expect, it } from 'vitest';

import { statusLabel } from './format';

/**
 * Название стадии воронки.
 *
 * Раньше оно переводилось по коду, и главным здесь было «грузинский агент
 * не должен видеть In base». Теперь имя лежит в данных — по одному
 * на каждый язык, — и главным стало другое: правка одного языка не должна
 * задевать остальные.
 */
describe('название стадии', () => {
  it('на каждом языке показывается своё имя', () => {
    const status = {
      name: 'In base',
      names: { ka: 'ბაზაში', en: 'In base', ru: 'В базе' },
    };

    expect(statusLabel('ka', status)).toBe('ბაზაში');
    expect(statusLabel('en', status)).toBe('In base');
    expect(statusLabel('ru', status)).toBe('В базе');
  });

  /**
   * ГЛАВНОЕ В ЭТОМ ПОДХОДЕ.
   *
   * Стадию заводят на одном языке, а работают на трёх. Пока перевода нет,
   * показывается то, что напечатал человек: стадия остаётся читаемой всем.
   * Пустое место было бы хуже — по нему нельзя работать.
   */
  it('без перевода показывается запасное имя, а не пустота', () => {
    const status = {
      name: 'Показ назначен',
      names: { ka: null, en: null, ru: 'Показ назначен' },
    };

    for (const locale of LOCALES) {
      expect(statusLabel(locale, status), locale).toBe('Показ назначен');
    }
  });

  /**
   * РЕГРЕССИЯ НА ТО, РАДИ ЧЕГО ВСЁ И ПЕРЕДЕЛЫВАЛОСЬ.
   *
   * Имя было одно на всех: переименовал по-русски — грузинский агент видел
   * русское слово посреди грузинского интерфейса. Правка одного языка
   * обязана оставаться в нём одном.
   */
  it('правка одного языка не задевает остальные', () => {
    const before = {
      name: 'В базе',
      names: { ka: 'ბაზაში', en: 'In base', ru: 'В базе' },
    };

    const afterRussianEdit = {
      ...before,
      names: { ...before.names, ru: 'Собственник согласился' },
    };

    expect(statusLabel('ru', afterRussianEdit)).toBe('Собственник согласился');
    expect(statusLabel('ka', afterRussianEdit)).toBe('ბაზაში');
    expect(statusLabel('en', afterRussianEdit)).toBe('In base');
  });

  it('пустая строка равнозначна отсутствию перевода', () => {
    // Сценарий записывает пустое имя как `null`, но экран не обязан знать
    // об этом различии: обе формы означают «своего имени на этом языке нет».
    const status = { name: 'Запасное', names: { ka: '', en: null, ru: 'Своё' } };

    expect(statusLabel('ka', status)).toBe('Запасное');
    expect(statusLabel('en', status)).toBe('Запасное');
    expect(statusLabel('ru', status)).toBe('Своё');
  });
});
