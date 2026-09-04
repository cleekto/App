import type {
  FillResult,
  ListingPublishDraft,
  PrefilledField,
  PublishedRef,
  UnfilledField,
} from '@kleekto/contracts';

import {
  captureField,
  setControlValue,
  type CapturedField,
  type FormControl,
  type FormSnapshot,
} from './form-fill';
import type { FillOutcome, ListingPublishAdapter } from './publish-types';
import { externalIdFromUrl, metaContent } from './shared';
import { nextData } from './payload';

/**
 * Адаптер заполнения формы размещения ss.ge.
 *
 * Основан на живой форме, прочитанной 2026-09-04; снимок структуры —
 * `docs/fixtures/ss-ge/form/structure-anonymous-2026-09-04.json`, разбор —
 * `docs/analysis/publish-forms.md`.
 *
 * ЧТО ЭТОТ АДАПТЕР НЕ ДЕЛАЕТ НИКОГДА (правило 12): не отправляет форму,
 * не нажимает «Опубликовать», не ставит галочку согласия, не решает капчу,
 * не работает в фоне. Кнопку нажимает агент.
 *
 * ПОЧЕМУ ЗАПОЛНЯЕТСЯ НЕ ВСЁ. Форма ss.ge собрана на styled-components: классы
 * вида `sc-9e0391b6-0 yrPxb` меняются при каждой сборке площадки, и селектор
 * по ним сломается на первом же их деплое — молча, оставив агенту форму,
 * заполненную мимо полей. Поэтому опора здесь ровно одна: атрибут `name`,
 * который у части полей есть и от языка не зависит. Всё остальное честно
 * уходит агенту списком (правило 14). Пустое поле дешевле неверного: неверное
 * агент не заметит и опубликует.
 */

/**
 * Поля формы, у которых есть `name`.
 *
 * Проверено на живой форме: во всей странице их восемь, и шесть из них
 * заполнимы. `choose-city` и `choose-street` сюда не входят намеренно —
 * см. `MANUAL_ONLY` ниже.
 */
const FIELD_AREA = 'totalArea';
const FIELD_FLOOR = 'floor';
const FIELD_TOTAL_FLOORS = 'floors';

/**
 * Поля, которые заполняет человек, и почему.
 *
 * Список не «пока не сделано», а решение. Каждая строка — цена ошибки, если
 * бы адаптер полез туда сам.
 */
const MANUAL_ONLY: readonly string[] = [
  // Город и улица — `react-select`: значение живёт в состоянии компонента,
  // а видимое поле лишь показывает выбранное. Рядом лежит `input[type=hidden]`
  // с именем `choose-city`, но писать в скрытые поля запрещено (§6А.5) и
  // бессмысленно: компонент перепишет их из своего состояния.
  'district',
  // Адрес приходит одной строкой («ნ. ჟვანიას ქ. 5»), а форма ждёт улицу
  // и номер дома порознь. Разделить их можно только угадыванием, а угаданный
  // номер дома — это неверный адрес в объявлении (правило 14).
  'address',
  // Комнаты, статус, проект, санузел выбираются плитками на классах
  // styled-components. Текст плитки зависит от языка формы, а числа
  // повторяются в нескольких разделах сразу.
  'rooms',
  // Тип недвижимости и тип сделки — первая ступень мастера: без них поля
  // не появляются вовсе. Их выбирает агент, и это правильно: он видит
  // объект целиком.
  'propertyType',
  'transactionType',
  // Валюта — переключатель ₾/$ рядом с ценой, отдельного поля нет.
  'currency',
  // Телефон публикатора площадка подтверждает кодом из SMS. Подставить номер
  // мы можем, подтвердить — нет, и подставленный неподтверждённый номер
  // выглядел бы как готовое поле.
  'publisher.phone',
  // Фотографии: значение файлового поля браузер программно ставить не даёт.
  'photos',
];

/**
 * Что на форме можно ПРОЧИТАТЬ, чтобы понять, пусто ли поле.
 *
 * Чтение — не запись: скрытые поля `react-select` писать нельзя, а вот
 * посмотреть, не лежит ли там город от прошлого объекта, можно и нужно.
 *
 * Плиток здесь нет: комнаты и статус выбираются кликом по элементам
 * с генерируемыми классами, и отличить выбранную от невыбранной надёжно
 * не выйдет. Врать, что форма чиста, мы не станем — про них честно сказано
 * в `PREFILL_BLIND`.
 */
const READABLE: ReadonlyArray<{ field: string; name: string }> = [
  { field: 'district', name: 'choose-city' },
  { field: 'address', name: 'choose-street' },
  { field: 'address.houseNumber', name: 'house-number' },
  { field: 'cadastralCode', name: 'cadastral-code-1' },
  { field: 'area', name: FIELD_AREA },
  { field: 'kitchenArea', name: 'kitchenArea' },
  { field: 'floor', name: FIELD_FLOOR },
  { field: 'totalFloors', name: FIELD_TOTAL_FLOORS },
];

/**
 * Поля, про которые мы НЕ можем сказать, пусты ли они.
 *
 * Названы явно, а не умолчаны: «предупреждений нет» и «проверить нечем» —
 * разные вещи, и агент имеет право знать, где именно наша слепота.
 */
export const PREFILL_BLIND: readonly string[] = ['rooms', 'propertyType', 'transactionType'];

export class SsGeFormAdapter implements ListingPublishAdapter {
  readonly sourceId = 'SS_GE' as const;

  /**
   * Версия заполнения. ОТДЕЛЬНАЯ от `parserVersion`: страница объявления
   * и форма размещения ломаются независимо (инвариант 9).
   */
  readonly formVersion = 'ss.ge-form@1.0.0';

  canHandleForm(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (!/(^|\.)ss\.ge$/u.test(parsed.hostname)) return false;

      // Путь локализован: `/ka/udzravi-qoneba/create`, `/en/...`. Language
      // segment не проверяется — важен хвост.
      return parsed.pathname.endsWith('/create');
    } catch {
      return false;
    }
  }

  /**
   * Мы на форме СОЗДАНИЯ, а не редактирования.
   *
   * Признак — маршрут приложения из данных страницы (`/real-estate/create`),
   * а не адрес и не разметка: адрес локализован и может смениться, разметка
   * на генерируемых классах. Проверено на живой форме.
   *
   * Если данных страницы нет, ответ — «нет». Форму редактирования чужого
   * объявления заполнить значило бы молча переписать его данные, и здесь
   * догадка стоит слишком дорого.
   */
  isNewListingForm(document: Document): boolean {
    const root = nextData(document);
    if (root === null) return false;

    const page = root['page'];
    return typeof page === 'string' && page.endsWith('/create');
  }

  fill(document: Document, draft: ListingPublishDraft): FillOutcome {
    const filled: string[] = [];
    const unfilled: UnfilledField[] = [];
    const captured: CapturedField[] = [];

    // СНАЧАЛА смотрим, что уже лежит в форме, и только потом пишем.
    // После записи отличить своё значение от чужого будет нечем.
    const wasFilled = occupiedFields(document);

    /**
     * Заполняет одно поле и записывает, что с ним стало.
     *
     * Причина в `unfilled` различима намеренно: «нет значения в CRM» и «поля
     * на форме нет» — разные проблемы. Первую решает агент, заполнив карточку;
     * вторая означает, что площадка сменила форму, и это уже наша поломка.
     */
    const put = (field: string, value: number | string | null, byName: string): void => {
      if (value === null) {
        unfilled.push({ field, reason: 'no_value' });
        return;
      }

      const element = namedControl(document, byName);
      if (element === null) {
        unfilled.push({ field, reason: 'field_not_found' });
        return;
      }

      const capture = captureField(field, element);
      if (!setControlValue(element, value)) {
        unfilled.push({ field, reason: 'field_not_found' });
        return;
      }

      capture.applied = element.value;
      captured.push(capture);
      filled.push(field);
    };

    put('area', draft.area, FIELD_AREA);
    put('floor', draft.floor, FIELD_FLOOR);
    put('totalFloors', draft.totalFloors, FIELD_TOTAL_FLOORS);

    // Описание и цена имени не имеют, но в форме они в единственном числе:
    // один `textarea` и одно поле `type="number"`. Опора слабее `name`,
    // поэтому при любой неоднозначности поле пропускается, а не заполняется
    // наугад — второй textarea означает, что форма изменилась.
    fillSingleton(
      document,
      'publicDescription',
      draft.publicDescription,
      'textarea',
      filled,
      unfilled,
      captured,
    );
    fillSingleton(
      document,
      'price',
      draft.price,
      'input[type="number"]',
      filled,
      unfilled,
      captured,
    );

    for (const field of MANUAL_ONLY) {
      unfilled.push({ field, reason: 'manual_only' });
    }

    const snapshot: FormSnapshot = {
      id: `ss-ge-${String(Date.now())}`,
      takenAt: Date.now(),
      fields: captured,
    };

    /*
     * Чужое значение делится на два случая, и опасен только второй.
     * `overwritten` — мы записали поверх, там теперь наши данные.
     * `kept` — поле заполняет человек, и данные прошлого объекта остались
     * на месте. Заметить это, кроме агента, некому.
     */
    const prefilled: PrefilledField[] = [...wasFilled].map((field) => ({
      field,
      outcome: filled.includes(field) ? ('overwritten' as const) : ('kept' as const),
    }));

    const result: FillResult = {
      snapshotId: snapshot.id,
      formVersion: this.formVersion,
      filled,
      unfilled,
      prefilled,
    };

    return { result, snapshot };
  }

  /**
   * Опубликованное объявление (§6А.7).
   *
   * После публикации агент оказывается на странице созданного объявления.
   * Признак — что это уже НЕ форма: у формы маршрут `/create`. Идентификатор
   * берётся из адреса тем же разбором, что и при чтении, — иначе один и тот же
   * номер объявления назывался бы в двух местах по-разному.
   *
   * Подтверждает публикацию человек: адаптер только распознаёт.
   */
  detectPublished(document: Document, url: string): PublishedRef | null {
    if (this.isNewListingForm(document)) return null;

    const canonical = metaContent(document, 'og:url') ?? url;
    const externalId = externalIdFromUrl(canonical);
    if (externalId === null) return null;

    return { externalId, externalUrl: canonical };
  }
}

/**
 * Контрол по атрибуту `name`.
 *
 * Скрытые поля отсеиваются здесь, а не полагаются на проверку внутри записи:
 * у ss.ge под именами `choose-city` и `choose-street` лежат именно скрытые
 * поля от `react-select`, и найти их «почти получилось» — худший исход.
 */
function namedControl(document: Document, name: string): FormControl | null {
  const element = document.querySelector(`input[name="${name}"], textarea[name="${name}"]`);
  if (element === null) return null;

  const control = element as FormControl;
  if ('type' in control && control.type === 'hidden') return null;

  return control;
}

/**
 * Поле, у которого нет имени, но которое на форме одно.
 *
 * Если селектор нашёл больше одного — форма изменилась, и заполнять наугад
 * нельзя: попадём не туда. Это `field_not_found`, а не «взять первое».
 */
function fillSingleton(
  document: Document,
  field: string,
  value: number | string | null,
  selector: string,
  filled: string[],
  unfilled: UnfilledField[],
  captured: CapturedField[],
): void {
  if (value === null) {
    unfilled.push({ field, reason: 'no_value' });
    return;
  }

  const found = document.querySelectorAll(selector);
  if (found.length !== 1) {
    unfilled.push({ field, reason: 'field_not_found' });
    return;
  }

  const element = found[0] as FormControl;
  const capture = captureField(field, element);

  if (!setControlValue(element, value)) {
    unfilled.push({ field, reason: 'field_not_found' });
    return;
  }

  capture.applied = element.value;
  captured.push(capture);
  filled.push(field);
}

/**
 * Поля формы, в которых уже что-то есть.
 *
 * Форма ss.ge сохраняет черновик у себя: значения переживают перезагрузку
 * страницы (проверено 2026-09-04). Поэтому непустое поле — это не «агент
 * начал вручную», а чаще всего остаток прошлого объекта.
 *
 * Значения не возвращаются, только имена полей: в них данные другого
 * объекта, и передавать их дальше незачем.
 */
function occupiedFields(document: Document): Set<string> {
  const occupied = new Set<string>();

  for (const entry of READABLE) {
    // Именно `querySelector`, а не `namedControl`: тот отсеивает скрытые
    // поля, потому что в них нельзя ПИСАТЬ. Читать их можно.
    const element = document.querySelector<HTMLInputElement>(`input[name="${entry.name}"]`);
    if (element !== null && element.value.trim() !== '') occupied.add(entry.field);
  }

  const textareas = document.querySelectorAll('textarea');
  if (textareas.length === 1 && (textareas[0]?.value ?? '').trim() !== '') {
    occupied.add('publicDescription');
  }

  const numbers = document.querySelectorAll<HTMLInputElement>('input[type="number"]');
  if (numbers.length === 1 && (numbers[0]?.value ?? '').trim() !== '') {
    occupied.add('price');
  }

  const file = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (file !== null && (file.files?.length ?? 0) > 0) occupied.add('photos');

  return occupied;
}
