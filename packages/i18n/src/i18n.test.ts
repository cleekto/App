import { describe, expect, it } from 'vitest';

import {
  LOCALES,
  coverage,
  formatDate,
  formatMoney,
  formatNumber,
  missingMarker,
  referenceKeys,
  translate,
  translator,
} from './index';

describe('словари', () => {
  it('все три языка объявлены', () => {
    expect([...LOCALES].sort()).toEqual(['en', 'ka', 'ru']);
  });

  it('опорный словарь не пуст', () => {
    expect(referenceKeys().length).toBeGreaterThan(0);
  });

  // Это единственная проверка словарей, которая ДОЛЖНА ронять сборку.
  // Неизвестный ключ — всегда дефект: опечатка либо остаток после
  // переименования в опорном словаре, который забыли применить к переводу.
  it.each([...LOCALES])('в языке %s нет ключей, отсутствующих в опорном словаре', (locale) => {
    expect(coverage(locale).unknown).toEqual([]);
  });

  // Неполнота грузинского на фазе 2 — ожидаемое состояние, а не ошибка,
  // поэтому тест её фиксирует, но не проваливает (ADR-0008).
  it('английский переведён полностью', () => {
    expect(coverage('en').missing).toEqual([]);
  });

  it('покрытие каждого языка измеримо', () => {
    for (const locale of LOCALES) {
      const c = coverage(locale);
      expect(c.ratio).toBeGreaterThanOrEqual(0);
      expect(c.ratio).toBeLessThanOrEqual(1);
      expect(c.translated.length + c.missing.length).toBe(referenceKeys().length);
    }
  });
});

describe('перевод', () => {
  it('возвращает строку языка, когда она есть', () => {
    expect(translate('ru', 'common.cancel')).toBe('Отмена');
    expect(translate('ka', 'common.cancel')).toBe('გაუქმება');
  });

  // Главное поведение всего пакета: непереведённое видно, а не подменяется.
  it('непереведённый ключ виден как дыра, а не откатывается на английский', () => {
    const value = translate('ka', 'health.databaseUnavailable');

    expect(value).toBe(missingMarker('health.databaseUnavailable'));
    expect(value).not.toBe(translate('en', 'health.databaseUnavailable'));
  });

  it('translator привязывает язык', () => {
    const t = translator('ru');
    expect(t('common.save')).toBe('Сохранить');
  });
});

describe('форматтеры', () => {
  it('число форматируется по локали', () => {
    // Разделители разрядов различаются между языками — именно поэтому
    // склейка строк в компоненте запрещена.
    const formatted = LOCALES.map((l) => formatNumber(l, 1234567));
    for (const value of formatted) {
      expect(value).toMatch(/1\D?234\D?567/u);
    }
  });

  it('валюта передаётся явно и не выводится из языка', () => {
    // Грузинский интерфейс, объект в долларах — норма для Тбилиси (Q13).
    expect(formatMoney('ka', 145000, 'USD')).toContain('145');
    expect(formatMoney('ru', 145000, 'USD')).toContain('145');
  });

  it('дата форматируется без падения на всех трёх языках', () => {
    const date = new Date('2026-08-31T10:00:00Z');
    for (const locale of LOCALES) {
      expect(formatDate(locale, date)).toMatch(/2026/u);
    }
  });
});
