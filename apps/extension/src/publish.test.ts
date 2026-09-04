import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  PUBLISH_ADAPTERS,
  captureField,
  publishAdapterFor,
  setControlValue,
} from '@kleekto/adapters';
import type { FormControl, FormSnapshot, ListingPublishAdapter } from '@kleekto/adapters';
import { listingPublishDraftSchema } from '@kleekto/contracts';
import { LOCALES, translate, translator } from '@kleekto/i18n';
import type { FillResult, ListingPublishDraft } from '@kleekto/contracts';
import { parseHTML } from 'linkedom';
import { describe, expect, it, vi } from 'vitest';

import { Ui } from './content/ui';
import { publishAvailability, runClear, runFill } from './core/publish-manager';
import type { DraftResponse, PublishDeps } from './core/publish-manager';

/**
 * ФАЗА 6Б, часть без адаптеров площадок.
 *
 * Адаптеров заполнения нет и не может быть: селекторы формы размещения
 * и словари значений составляются только по реальным фикстурам формы
 * (§6А.5, правило 2), а их пока не прислали.
 *
 * Поэтому здесь проверяется всё, что от разметки площадки НЕ зависит:
 * оркестрация, «очистить форму», правило 12 и белый список черновика.
 * Там, где нужен адаптер, он собран вручную прямо в тесте — и это честная
 * проверка МОЕЙ логики, а не догадка о чужой вёрстке.
 */

const DRAFT: ListingPublishDraft = {
  propertyId: '11111111-1111-1111-1111-111111111111',
  targetSource: 'SS_GE',
  propertyType: 'APARTMENT',
  transactionType: 'SALE',
  price: 179000,
  currency: 'USD',
  area: 85,
  rooms: 2,
  floor: 7,
  totalFloors: 10,
  district: null,
  address: 'ბაგები',
  publicDescription: 'светлая квартира',
  publisher: { displayName: 'Гиорги', phone: '555000111' },
};

const FORM_HTML = `<!doctype html><html><body><form>
  <input id="price">
  <input id="area">
  <select id="type"><option value="">—</option><option value="flat">квартира</option></select>
  <input id="send" type="submit" value="Опубликовать">
</form></body></html>`;

function formPage(): Document {
  return parseHTML(FORM_HTML).document as unknown as Document;
}

/**
 * Адаптер, собранный для теста.
 *
 * Он не изображает ss.ge и не претендует на знание её формы: поля здесь мои
 * собственные, из разметки выше. Проверяется оркестрация вокруг адаптера,
 * а не сам адаптер.
 */
function fakeAdapter(overrides: Partial<ListingPublishAdapter> = {}): ListingPublishAdapter {
  return {
    sourceId: 'SS_GE',
    formVersion: 'тест@0.0.0',
    canHandleForm: () => true,
    isNewListingForm: () => true,
    fill: (document, draft) => {
      const fields: FormSnapshot['fields'] = [];
      const filled: string[] = [];
      const unfilled: FillResult['unfilled'] = [];

      const put = (id: string, field: string, value: string | number | null): void => {
        const element = document.getElementById(id) as unknown as FormControl | null;
        if (element === null) {
          unfilled.push({ field, reason: 'field_not_found' });
          return;
        }
        if (value === null) {
          unfilled.push({ field, reason: 'no_value' });
          return;
        }

        const captured = captureField(field, element);
        if (!setControlValue(element, value)) {
          unfilled.push({ field, reason: 'no_mapping' });
          return;
        }
        captured.applied = String(value);
        fields.push(captured);
        filled.push(field);
      };

      put('price', 'price', draft.price);
      put('area', 'area', draft.area);
      // Соответствия для APARTMENT в этом списке нет — поле обязано остаться
      // пустым и уйти в `unfilled`, а не получить «ближайшее похожее».
      put('type', 'propertyType', draft.propertyType);
      put('district', 'district', draft.district);

      return {
        result: { snapshotId: 'snap-1', formVersion: 'тест@0.0.0', filled, unfilled },
        snapshot: { id: 'snap-1', takenAt: 0, fields },
      };
    },
    detectPublished: () => null,
    ...overrides,
  };
}

function deps(overrides: Partial<PublishDeps> = {}): PublishDeps & {
  requestDraft: ReturnType<typeof vi.fn>;
  reportFilled: ReturnType<typeof vi.fn>;
} {
  const requestDraft = vi.fn<(p: string, s: string) => Promise<DraftResponse>>(async () => ({
    publicationId: 'pub-1',
    draft: DRAFT,
    manualOnly: ['photos', 'mapLocation'],
  }));
  const reportFilled = vi.fn<(id: string, r: FillResult) => Promise<void>>(async () => undefined);

  return {
    requestDraft,
    reportFilled,
    resolveAdapter: () => fakeAdapter(),
    ...overrides,
  } as never;
}

// ── Доступность «Заполнить» ──────────────────────────────────────────────────

describe('доступность заполнения', () => {
  /**
   * Площадка, форму которой мы заполнять не умеем, — нормальный исход,
   * а не поломка. Пункт «Заполнить» агенту не показывается: это лучше
   * кнопки, которая нажимается и ничего не делает.
   *
   * Сейчас так с myhome.ge: во всей её форме один атрибут `name`, и тот
   * у `<meta viewport>`, а идентификаторы полей меняются между сборками
   * (`docs/analysis/publish-forms.md`).
   */
  it('без адаптера для площадки пункт недоступен', () => {
    expect(publishAdapterFor('https://www.myhome.ge/ka/statement/create')).toBeNull();

    expect(publishAvailability(formPage(), 'https://www.myhome.ge/ka/statement/create')).toEqual({
      kind: 'unavailable',
      reason: 'no_adapter',
    });
  });

  /**
   * Обратная сторона: там, где адаптер есть, пункт обязан появляться.
   * Иначе работа по разбору формы не доходит до агента.
   */
  it('на форме ss.ge адаптер находится', () => {
    expect(PUBLISH_ADAPTERS.length).toBeGreaterThan(0);
    expect(publishAdapterFor('https://home.ss.ge/ka/udzravi-qoneba/create')).not.toBeNull();
  });

  /**
   * Требование фазы: страница не форма создания объявления → недоступно.
   *
   * Разница дорогая: заполнить форму РЕДАКТИРОВАНИЯ чужого объявления значит
   * молча переписать его данные.
   */
  it('на форме редактирования пункт недоступен', () => {
    const availability = publishAvailability(formPage(), 'https://home.ss.ge/ka/edit/123', () =>
      fakeAdapter({ isNewListingForm: () => false }),
    );

    expect(availability).toEqual({ kind: 'unavailable', reason: 'not_new_listing_form' });
  });

  /**
   * И черновик при этом не запрашивается.
   *
   * Проверяется отдельно: запрос черновика создаёт на сервере запись
   * `Publication`. Создать её на странице редактирования значило бы завести
   * публикацию, которой не было.
   */
  it('на неподходящей странице черновик не запрашивается', async () => {
    const d = deps({ resolveAdapter: () => fakeAdapter({ isNewListingForm: () => false }) });

    const result = await runFill(d, formPage(), 'https://home.ss.ge/ka/edit/123', DRAFT.propertyId);

    expect(result).toEqual({ kind: 'unavailable', reason: 'not_new_listing_form' });
    expect(d.requestDraft).not.toHaveBeenCalled();
    expect(d.reportFilled).not.toHaveBeenCalled();
  });
});

// ── Заполнение ───────────────────────────────────────────────────────────────

describe('заполнение формы', () => {
  it('заполняет что может и честно перечисляет остальное', async () => {
    const d = deps();
    const document = formPage();

    const result = await runFill(d, document, 'https://home.ss.ge/ka/create', DRAFT.propertyId);

    expect(result.kind).toBe('filled');
    if (result.kind !== 'filled') return;

    expect(result.result.filled.sort()).toEqual(['area', 'price']);

    // Частичное заполнение — штатный режим (правило 14), а не сбой.
    expect(result.result.unfilled).toEqual([
      { field: 'propertyType', reason: 'no_mapping' },
      { field: 'district', reason: 'field_not_found' },
    ]);

    expect((document.getElementById('price') as unknown as FormControl).value).toBe('179000');
  });

  /**
   * ПРАВИЛО 14 в самом опасном месте.
   *
   * `APARTMENT` в списке площадки соответствия не имеет. Поле обязано
   * остаться пустым: неверное значение агент не заметит и опубликует,
   * пустое — увидит в списке незаполненного.
   */
  it('значение без соответствия оставляет поле пустым', async () => {
    const document = formPage();
    await runFill(deps(), document, 'https://home.ss.ge/ka/create', DRAFT.propertyId);

    const select = document.getElementById('type') as unknown as HTMLSelectElement;

    // Опасность здесь конкретная: `flat` — то самое «ближайшее похожее»
    // к APARTMENT, которое так и просится подставить. Его в форме быть
    // не должно, и ни один пункт не должен оказаться выбранным.
    expect(select.value).not.toBe('flat');
    expect([...select.options].some((option) => option.selected)).toBe(false);
  });

  it('профиль публикации виден в отчёте', async () => {
    // §6А.7: заполнение идёт профилем по умолчанию без диалога, но какой
    // профиль применён, агент обязан видеть — это публичное лицо агентства.
    const result = await runFill(
      deps(),
      formPage(),
      'https://home.ss.ge/ka/create',
      DRAFT.propertyId,
    );

    expect(result.kind).toBe('filled');
    if (result.kind !== 'filled') return;
    expect(result.publisher).toEqual({ displayName: 'Гиорги', phone: '555000111' });
  });

  it('отчёт о заполнении уходит на сервер', async () => {
    // Он же сигнал метрики `fill failure rate`: о смене вёрстки формы мы
    // должны узнавать из метрики, а не от разозлённого агента.
    const d = deps();
    await runFill(d, formPage(), 'https://home.ss.ge/ka/create', DRAFT.propertyId);

    expect(d.reportFilled).toHaveBeenCalledTimes(1);
    const [publicationId, report] = d.reportFilled.mock.calls[0] as [string, FillResult];

    expect(publicationId).toBe('pub-1');
    expect(report.formVersion).toBe('тест@0.0.0');
    expect(report.unfilled.length).toBeGreaterThan(0);
  });

  it('неудача при запросе черновика не порождает отчёта', async () => {
    const d = deps({
      requestDraft: vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))) as never,
    });

    const result = await runFill(d, formPage(), 'https://home.ss.ge/ka/create', DRAFT.propertyId);

    expect(result).toEqual({ kind: 'failed', error: 'network' });
    expect(d.reportFilled).not.toHaveBeenCalled();
  });
});

// ── «Очистить форму» ─────────────────────────────────────────────────────────

describe('очистить форму', () => {
  async function fillPage(): Promise<{ document: Document; snapshot: FormSnapshot }> {
    const document = formPage();
    const result = await runFill(
      deps(),
      document,
      'https://home.ss.ge/ka/create',
      DRAFT.propertyId,
    );
    if (result.kind !== 'filled') throw new Error('заполнение не состоялось');
    return { document, snapshot: result.snapshot };
  }

  it('возвращает заполненные поля в исходное состояние', async () => {
    const { document, snapshot } = await fillPage();
    expect((document.getElementById('price') as unknown as FormControl).value).toBe('179000');

    const { restored } = runClear(snapshot);

    expect(restored.sort()).toEqual(['area', 'price']);
    expect((document.getElementById('price') as unknown as FormControl).value).toBe('');
  });

  it('не трогает поля, которые агент заполнил сам', async () => {
    const { document, snapshot } = await fillPage();
    // Поле `type` мы не заполнили — соответствия не нашлось. Агент выбрал сам.
    setControlValue(document.getElementById('type') as unknown as FormControl, 'flat');

    runClear(snapshot);

    expect((document.getElementById('type') as unknown as FormControl).value).toBe('flat');
  });

  it('правку агента в заполненном поле называет и не стирает', async () => {
    const { document, snapshot } = await fillPage();
    setControlValue(document.getElementById('price') as unknown as FormControl, '200000');

    const { restored, editedByAgent } = runClear(snapshot);

    expect(editedByAgent).toEqual(['price']);
    expect(restored).toEqual(['area']);
    expect((document.getElementById('price') as unknown as FormControl).value).toBe('200000');
  });
});

// ── Правило 13 и правило 12 ──────────────────────────────────────────────────

describe('черновик публикации', () => {
  /**
   * ПРАВИЛО 13. Контакты собственника на площадку не уходят.
   *
   * Проверяется устройство типа, а не поведение кода: блока `owner` в схеме
   * нет вовсе. Чтобы контакт собственника попал в форму, придётся дописать
   * поле — забыть проверку недостаточно.
   */
  it('в схеме черновика нет блока owner', () => {
    const keys = Object.keys(listingPublishDraftSchema.shape);

    expect(keys).not.toContain('owner');
    expect(keys).not.toContain('ownerContact');
    expect(keys).not.toContain('ownerPhone');
    expect(keys).toContain('publisher');
  });

  it('лишние поля в черновике не доезжают до адаптера', () => {
    // Схема отбрасывает неизвестные ключи. Если сервер однажды начнёт слать
    // контакт собственника, до формы он всё равно не дойдёт.
    const parsed = listingPublishDraftSchema.parse({
      ...DRAFT,
      owner: { name: 'собственник', phone: '555999888' },
    });

    expect(Object.keys(parsed)).not.toContain('owner');
  });
});

describe('правило 12: публикует человек', () => {
  const read = (relative: string): string =>
    readFileSync(join(import.meta.dirname, relative), 'utf8').replace(/\/\*[\s\S]*?\*\//gu, '');

  it.each(['core/publish-manager.ts', 'content/content.ts', 'content/ui.ts'])(
    '%s не отправляет форму и не нажимает кнопок',
    (file) => {
      const code = read(file).replace(/\/\/.*$/gmu, '');

      expect(code).not.toMatch(/\.submit\s*\(/u);
      expect(code).not.toContain('requestSubmit');
      expect(code).not.toMatch(/\.click\s*\(\s*\)/u);
      expect(code).not.toContain("'submit'");
    },
  );

  it('приёмы заполнения не отправляют форму', () => {
    const code = readFileSync(
      join(import.meta.dirname, '../../../packages/adapters/src/form-fill.ts'),
      'utf8',
    )
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .replace(/\/\/.*$/gmu, '');

    expect(code).not.toMatch(/\.submit\s*\(/u);
    expect(code).not.toMatch(/\.click\s*\(/u);
    // Запись в кнопку отправки запрещена отдельно: заполнить `value` кнопки
    // значит переименовать её у агента на глазах.
    expect(code).toContain("'submit'");
  });
});

// ── Отчёт о заполнении на экране ─────────────────────────────────────────────

describe('интерфейс заполнения', () => {
  function withDom<T>(run: () => T): T {
    const { document: dom } = parseHTML('<!doctype html><html><body></body></html>') as unknown as {
      document: Document;
    };
    const globals = globalThis as unknown as Record<string, unknown>;
    const saved = globals.document;
    globals.document = dom;
    try {
      return run();
    } finally {
      globals.document = saved;
    }
  }

  const PUBLISHER = { displayName: 'Гиорги', phone: '555000111' };

  it.each(LOCALES)('отчёт говорит на языке %s', (locale) => {
    const text = withDom(() => {
      const ui = new Ui(locale, () => undefined);
      ui.fillResult(PUBLISHER, ['price', 'area'], ['photos']);
      return ui.content.textContent ?? '';
    });

    const t = translator(locale);
    expect(text).toContain(t('extension.fill.publishingAs'));
    expect(text).toContain(t('extension.fill.leftForYou'));
    expect(text).toContain(t('extension.fill.clearForm'));
    expect(text).not.toContain('⟦');
  });

  it('профиль публикации виден в отчёте', () => {
    // §6А.7: заполнение идёт профилем по умолчанию без диалога, но от чьего
    // имени публикуется объявление, агент обязан видеть.
    const text = withDom(() => {
      const ui = new Ui('ru', () => undefined);
      ui.fillResult(PUBLISHER, ['price'], []);
      return ui.content.textContent ?? '';
    });

    expect(text).toContain('Гиорги');
    expect(text).toContain('555000111');
  });

  it('оставшиеся поля перечислены поимённо', () => {
    const text = withDom(() => {
      const ui = new Ui('ru', () => undefined);
      ui.fillResult(PUBLISHER, ['price'], ['photos', 'mapLocation']);
      return ui.content.textContent ?? '';
    });

    expect(text).toContain('photos');
    expect(text).toContain('mapLocation');
  });

  /**
   * ПРАВИЛО 12 в интерфейсе.
   *
   * DESIGN §25.2: «в kleekTo нет элемента, который можно было бы принять
   * за кнопку публикации». Проверяется на всех трёх языках — по-английски
   * «publish» легко проскользнёт мимо русского глаза.
   */
  it.each(LOCALES)('на языке %s ни одна кнопка не похожа на «опубликовать»', (locale) => {
    // Проверяются подписи КНОПОК, а не весь текст панели: строка
    // «Publishing as: Гиорги» содержит `publish`, но принять её за кнопку
    // публикации невозможно — это подпись, и она как раз обязана быть.
    const labels = withDom(() => {
      const ui = new Ui(locale, () => undefined);
      ui.fillResult(PUBLISHER, ['price'], ['photos']);
      return [...ui.content.querySelectorAll('button')].map((b) =>
        (b.textContent ?? '').toLowerCase(),
      );
    });

    for (const label of labels) {
      for (const word of ['опубликов', 'publish', 'submit', 'გამოქვეყ', 'отправ']) {
        expect(label, `${label} / ${word}`).not.toContain(word);
      }
    }
  });

  it('в отчёте нет кнопок отправки формы', () => {
    const buttons = withDom(() => {
      const ui = new Ui('ru', () => undefined);
      ui.fillResult(PUBLISHER, ['price'], []);
      return [...ui.content.querySelectorAll('button')].map((b) => b.getAttribute('type'));
    });

    // Все кнопки объявлены `type="button"`: кнопка без типа внутри формы
    // площадки отправила бы её при нажатии.
    expect(buttons.every((type) => type === 'button')).toBe(true);
  });

  it('после очистки правки агента названы, а не стёрты молча', () => {
    const text = withDom(() => {
      const ui = new Ui('ru', () => undefined);
      ui.formCleared(['price']);
      return ui.content.textContent ?? '';
    });

    expect(text).toContain(translate('ru', 'extension.fill.cleared'));
    expect(text).toContain(translate('ru', 'extension.fill.editedWarning'));
    expect(text).toContain('price');
    // Откат правки — только вторым, явным действием.
    expect(text).toContain(translate('ru', 'extension.fill.clearAnyway'));
  });

  it('без правок агента лишнего не показывает', () => {
    const text = withDom(() => {
      const ui = new Ui('ru', () => undefined);
      ui.formCleared([]);
      return ui.content.textContent ?? '';
    });

    expect(text).toContain(translate('ru', 'extension.fill.cleared'));
    expect(text).not.toContain(translate('ru', 'extension.fill.clearAnyway'));
  });
});
