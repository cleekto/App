import type { ListingPublishDraft } from '@kleekto/contracts';
import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';

import { SsGeFormAdapter, publishAdapterFor } from './index';

/**
 * Форма размещения ss.ge.
 *
 * Разметка ниже — не выдумка: она повторяет то, что прочитано на живой форме
 * 2026-09-04 (`docs/fixtures/ss-ge/form/structure-anonymous-2026-09-04.json`).
 * Взяты именно те опоры, на которых стоит адаптер: атрибут `name` у части
 * полей, единственные на форме `textarea` и `input[type=number]`, скрытые
 * поля `react-select` под именами `choose-city` и `choose-street`, и маршрут
 * приложения в данных страницы.
 *
 * Классы вида `sc-9e0391b6-0` намеренно оставлены в разметке: они меняются
 * при каждой сборке площадки, и ни один тест не должен от них зависеть.
 */
function createFormDocument(options: { page?: string; extraTextarea?: boolean } = {}): Document {
  const page = options.page ?? '/real-estate/create';
  const nextData = { page, props: { pageProps: {} } };

  const { document } = parseHTML(
    `<html><head><meta property="og:url" content="https://home.ss.ge/ka/udzravi-qoneba/create"></head>
     <body>
       <div class="sc-e8a87f7a-3 gdEkZl">
         <input type="hidden" name="choose-city" value="">
         <input type="hidden" name="choose-street" value="">
         <input name="house-number" placeholder="სახლის ნომერი">
         <input name="cadastral-code-1" placeholder="საკადასტრო კოდი">
         <input name="totalArea" placeholder="საერთო ფართი">
         <input name="kitchenArea" placeholder="სამზარეულოს ფართი">
         <input name="floor" placeholder="სართული">
         <input name="floors" placeholder="სართულიანობა">
         <div class="sc-9e0391b6-0 yrPxb"><p>3</p></div>
         <textarea class="sc-c53627f6-1 qLDuD" placeholder="ჩაწერე აქ..."></textarea>
         ${options.extraTextarea === true ? '<textarea></textarea>' : ''}
         <input type="number">
       </div>
       <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script>
     </body></html>`,
  );

  return document as unknown as Document;
}

function draftWith(overrides: Partial<ListingPublishDraft> = {}): ListingPublishDraft {
  return {
    propertyId: '00000000-0000-0000-0000-000000000001',
    targetSource: 'SS_GE',
    propertyType: 'APARTMENT',
    transactionType: 'SALE',
    price: 198000,
    currency: 'USD',
    area: 81,
    rooms: 3,
    floor: 6,
    totalFloors: 8,
    district: 'ვაკე',
    address: 'ნ. ჟვანიას ქ. 5',
    publicDescription: 'Светлая квартира с ремонтом.',
    publisher: { displayName: 'Нино Абашидзе', phone: '555111222' },
    ...overrides,
  };
}

const adapter = new SsGeFormAdapter();

describe('ss.ge: заполнение формы размещения', () => {
  it('адаптер выбирается по адресу формы', () => {
    expect(publishAdapterFor('https://home.ss.ge/ka/udzravi-qoneba/create')).toBeInstanceOf(
      SsGeFormAdapter,
    );
    expect(publishAdapterFor('https://home.ss.ge/en/real-estate/create')).toBeInstanceOf(
      SsGeFormAdapter,
    );

    // Страница объявления — не форма.
    expect(publishAdapterFor('https://home.ss.ge/ka/udzravi-qoneba/x-36555806')).toBeNull();
    // Чужая площадка.
    expect(publishAdapterFor('https://www.myhome.ge/ka/statement/create')).toBeNull();
  });

  it('форма создания отличается от формы редактирования', () => {
    expect(adapter.isNewListingForm(createFormDocument())).toBe(true);

    // Другой маршрут приложения — не форма создания. Заполнить форму
    // редактирования чужого объявления значило бы переписать его данные.
    expect(adapter.isNewListingForm(createFormDocument({ page: '/real-estate/edit' }))).toBe(false);

    // Данных страницы нет — ответ «нет», а не догадка.
    const { document } = parseHTML('<html><body><input name="totalArea"></body></html>');
    expect(adapter.isNewListingForm(document as unknown as Document)).toBe(false);
  });

  it('заполняет поля, у которых есть имя', () => {
    const document = createFormDocument();
    const { result } = adapter.fill(document, draftWith());

    expect(result.filled).toContain('area');
    expect(result.filled).toContain('floor');
    expect(result.filled).toContain('totalFloors');

    expect(document.querySelector<HTMLInputElement>('[name="totalArea"]')?.value).toBe('81');
    expect(document.querySelector<HTMLInputElement>('[name="floor"]')?.value).toBe('6');
    expect(document.querySelector<HTMLInputElement>('[name="floors"]')?.value).toBe('8');
  });

  it('заполняет описание и цену — они на форме в единственном числе', () => {
    const document = createFormDocument();
    const { result } = adapter.fill(document, draftWith());

    expect(result.filled).toContain('publicDescription');
    expect(result.filled).toContain('price');

    expect(document.querySelector('textarea')?.value).toBe('Светлая квартира с ремонтом.');
    expect(document.querySelector<HTMLInputElement>('input[type="number"]')?.value).toBe('198000');
  });

  it('второй textarea на форме означает «не заполнять», а не «взять первый»', () => {
    const document = createFormDocument({ extraTextarea: true });
    const { result } = adapter.fill(document, draftWith());

    // Форма изменилась — попадём не туда. Пустое поле дешевле неверного.
    expect(result.unfilled).toContainEqual({
      field: 'publicDescription',
      reason: 'field_not_found',
    });
    expect(document.querySelector('textarea')?.value).toBe('');
  });

  /**
   * ГЛАВНОЕ В ЭТОМ НАБОРЕ.
   *
   * Под именами `choose-city` и `choose-street` у ss.ge лежат скрытые поля
   * `react-select`: значение живёт в состоянии компонента, а не в поле.
   * Записать туда строку — значит получить форму, которая выглядит
   * заполненной и уходит на площадку пустой.
   */
  it('в скрытые поля react-select не пишет ничего', () => {
    const document = createFormDocument();
    adapter.fill(document, draftWith());

    expect(document.querySelector<HTMLInputElement>('[name="choose-city"]')?.value).toBe('');
    expect(document.querySelector<HTMLInputElement>('[name="choose-street"]')?.value).toBe('');
  });

  it('незаполненное перечисляется с причиной, а не молчит', () => {
    const document = createFormDocument();
    const { result } = adapter.fill(document, draftWith());

    const reasonOf = (field: string): string | undefined =>
      result.unfilled.find((item) => item.field === field)?.reason;

    // Человеку — то, что адаптеру не по силам.
    expect(reasonOf('district')).toBe('manual_only');
    expect(reasonOf('address')).toBe('manual_only');
    expect(reasonOf('rooms')).toBe('manual_only');
    expect(reasonOf('propertyType')).toBe('manual_only');
    expect(reasonOf('publisher.phone')).toBe('manual_only');
    expect(reasonOf('photos')).toBe('manual_only');

    // Ни одно поле не пропало молча: каждое либо заполнено, либо названо.
    for (const field of ['area', 'floor', 'totalFloors', 'price', 'publicDescription']) {
      const known = result.filled.includes(field) || reasonOf(field) !== undefined;
      expect(known, field).toBe(true);
    }
  });

  it('пустое значение в CRM отличается от пропавшего поля', () => {
    const document = createFormDocument();
    const { result } = adapter.fill(document, draftWith({ area: null }));

    // Разные проблемы с разной ценой: первую решает агент, заполнив карточку,
    // вторая означает, что площадка сменила форму.
    expect(result.unfilled).toContainEqual({ field: 'area', reason: 'no_value' });
  });

  it('снимок хранит состояние до заполнения — иначе нечего откатывать', () => {
    const document = createFormDocument();
    const { snapshot } = adapter.fill(document, draftWith());

    const area = snapshot.fields.find((field) => field.field === 'area');
    expect(area?.before).toBe('');
    expect(area?.applied).toBe('81');
  });

  it('распознаёт опубликованное объявление и не путает его с формой', () => {
    // На самой форме публикации ещё нет.
    expect(
      adapter.detectPublished(createFormDocument(), 'https://home.ss.ge/ka/udzravi-qoneba/create'),
    ).toBeNull();

    const { document } = parseHTML(
      '<html><head><meta property="og:url" content="https://home.ss.ge/ka/udzravi-qoneba/x-36555806"></head><body></body></html>',
    );

    expect(
      adapter.detectPublished(document as unknown as Document, 'https://home.ss.ge/x'),
    ).toEqual({
      externalId: '36555806',
      externalUrl: 'https://home.ss.ge/ka/udzravi-qoneba/x-36555806',
    });
  });

  /**
   * ПРАВИЛО 12. Адаптер не отправляет форму и не ставит согласий.
   *
   * Проверяется по исходнику: перечислить все способы нажать кнопку в тесте
   * нельзя, а вот убедиться, что их нет в коде, — можно.
   */
  it('не нажимает кнопок и не ставит галочек', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const source = readFileSync(join(import.meta.dirname, 'ss-ge-form.ts'), 'utf8');

    for (const forbidden of ['.click(', '.submit(', 'requestSubmit', 'checked = true']) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });
});
