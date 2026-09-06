import { describe, expect, it } from 'vitest';

import type { MessageKey } from './index';
import {
  LOCALES,
  MARKET_UTC_OFFSET,
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
  //
  // Ключ здесь заведомо несуществующий, а не «тот, что пока не переведён».
  // Прежняя версия теста держалась за `health.databaseUnavailable` и упала
  // ровно в тот день, когда эту строку перевели на грузинский: тест ломался
  // на успехе. Проверять надо механизм, а не текущее состояние словарей —
  // тем более что все три сейчас полны.
  it('непереведённый ключ виден как дыра, а не откатывается на английский', () => {
    const absent = 'common.keyThatDoesNotExist' as MessageKey;

    for (const locale of LOCALES) {
      expect(translate(locale, absent)).toBe(missingMarker(absent));
    }
  });

  it('все три словаря переведены полностью', () => {
    // Состояние на фазе 6. Если строка не переведена — это видно здесь,
    // а не на экране у грузинского агента.
    for (const locale of LOCALES) {
      expect(coverage(locale).missing, locale).toEqual([]);
    }
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

describe('часовой пояс рынка', () => {
  /*
   * Продукт сделан для Грузии, и день у него грузинский. Сервер в облаке
   * живёт по UTC, разница ровно четыре часа и приходится на начало суток —
   * значит, всё, что заведено ночью, без явного пояса уезжало бы во вчера.
   */
  it('полночь по Тбилиси показывается шестым числом, а не пятым', () => {
    // 5 сентября 20:00 UTC = 6 сентября 00:00 в Тбилиси.
    const midnightInTbilisi = new Date('2026-09-05T20:00:00Z');
    expect(formatDate('ru', midnightInTbilisi)).toContain('6');
    expect(formatDate('ru', midnightInTbilisi)).not.toContain('5 сент');
  });

  it('граница суток совпадает с той, что показана', () => {
    // Тот же момент, собранный из даты и смещения, — так фильтр доски
    // считает начало дня. Совпадение с показом здесь и проверяется:
    // фильтр, расходящийся с датой на экране, хуже обоих по отдельности.
    const boundary = new Date(`2026-09-06T00:00:00.000${MARKET_UTC_OFFSET}`);
    expect(boundary.toISOString()).toBe('2026-09-05T20:00:00.000Z');
  });

  it('вечер по Тбилиси не уезжает в следующий день', () => {
    // 6 сентября 23:00 Тбилиси = 6 сентября 19:00 UTC — то же число.
    const evening = new Date('2026-09-06T19:00:00Z');
    expect(formatDate('ru', evening)).toContain('6');
  });
});
