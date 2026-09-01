/**
 * Приёмы заполнения формы, общие для любой площадки.
 *
 * Здесь нет ни одного селектора и ни одного значения из словаря конкретного
 * сайта — только техника: как записать значение так, чтобы сайт его увидел,
 * и как вернуть форму в состояние до заполнения.
 *
 * Правило 12 действует и здесь: ничто в этом файле не отправляет форму,
 * не нажимает кнопок и не ставит галочку согласия.
 */

/** Контролы, которые умеет заполнять расширение. */
export type FormControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export type FieldValue = string | number | boolean;

/**
 * Значение поля до заполнения и то, что мы туда записали.
 *
 * Хранится и то и другое: без «до» нечего восстанавливать, без «записали»
 * нельзя отличить правку агента от нашего же значения (§6А.6).
 */
export interface CapturedField {
  field: string;
  element: FormControl;
  before: string | boolean;
  applied: string | boolean;
}

/**
 * Снимок формы до заполнения.
 *
 * Живёт в расширении, а не на сервере: он про конкретную вкладку конкретного
 * агента и умирает вместе с ней. Отправлять его на сервер значило бы обещать
 * восстановление там, где вкладки уже нет.
 */
export interface FormSnapshot {
  id: string;
  takenAt: number;
  fields: CapturedField[];
}

/**
 * Событие в том окне, которому принадлежит элемент.
 *
 * Не глобальный `Event`: в браузере он тот же самый, а в тестовой реализации
 * DOM — чужой, и обработчики его не примут. Опора на окно документа верна
 * в обоих случаях.
 */
function makeEvent(element: FormControl, type: string): Event {
  const view = element.ownerDocument.defaultView as (Window & typeof globalThis) | null;
  const EventCtor = view?.Event ?? Event;
  return new EventCtor(type, { bubbles: true });
}

/**
 * Нативный сеттер свойства.
 *
 * ЗАЧЕМ ЭТО НУЖНО. React и Vue подменяют свойство `value` на элементе, чтобы
 * следить за изменениями. Простое присваивание `element.value = x` пишет
 * в их обёртку, состояние компонента не меняется, и на экране появляется
 * заполненная форма, которая для сайта пуста. Агент нажмёт «Опубликовать»
 * и получит объявление без данных.
 *
 * Поэтому значение пишется сеттером прототипа — тем, который framework обошёл, —
 * а затем вручную посылаются события, которых framework ждёт.
 */
function nativeSetter(
  element: FormControl,
  property: 'value' | 'checked',
): ((v: unknown) => void) | null {
  const view = element.ownerDocument.defaultView as unknown as Record<string, unknown> | null;

  const constructorName =
    element instanceof Object
      ? (Object.getPrototypeOf(element) as { constructor?: { name?: string } })?.constructor?.name
      : undefined;

  const fromWindow =
    view !== null && constructorName !== undefined
      ? (view[constructorName] as { prototype?: object } | undefined)?.prototype
      : undefined;

  const prototype = fromWindow ?? Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype as object, property);

  return typeof descriptor?.set === 'function' ? descriptor.set.bind(element) : null;
}

/**
 * Записывает свойство нативным сеттером, а если его нет — обычным присваиванием.
 *
 * Отсутствие сеттера на прототипе — НЕ повод считать поле незаполнимым.
 * Так ведут себя не только экзотические среды: у части контролов свойство
 * объявлено на самом элементе, а не на прототипе. Возвращать «не смог»
 * в этом случае значило бы записать в `unfilled` поле, которое прекрасно
 * заполняется, и отправить агента искать несуществующую проблему.
 */
function assign(element: FormControl, property: 'value' | 'checked', value: unknown): void {
  const setter = nativeSetter(element, property);
  if (setter !== null) {
    setter(value);
    return;
  }
  (element as unknown as Record<string, unknown>)[property] = value;
}

/**
 * Записывает значение в контрол так, чтобы сайт его увидел.
 *
 * Возвращает `false`, если тип контрола незнаком: §6А.5 требует пропустить
 * такое поле и отправить в `unfilled`, а не ломать форму попыткой записи.
 */
export function setControlValue(element: FormControl, value: FieldValue): boolean {
  if (isCheckbox(element)) {
    assign(element, 'checked', Boolean(value));
    element.dispatchEvent(makeEvent(element, 'input'));
    element.dispatchEvent(makeEvent(element, 'change'));
    return true;
  }

  if (isSelect(element)) {
    const wanted = String(value);
    // Значения, которого нет в списке, площадка не примет. Молча выбрать
    // «ближайшее похожее» запрещено правилом 14 — поле остаётся пустым.
    const options = [...element.options];
    const target = options.find((option) => option.value === wanted);
    if (target === undefined) return false;

    // Выбор меняется через сам `option`, а не присваиванием `select.value`.
    // Механизм тот же стандартный, но он не зависит от того, объявлено ли
    // `value` у списка доступным для записи, — а объявлено оно так не везде.
    //
    // У одиночного списка снимать выбор с остальных не нужно и вредно:
    // браузер делает это сам, а явное «снять со всех» на долю секунды
    // оставляет список без выбранного пункта. У множественного — нужно.
    if (element.multiple === true) {
      for (const option of options) option.selected = false;
    }
    target.selected = true;

    element.dispatchEvent(makeEvent(element, 'change'));
    return true;
  }

  if (isTextual(element)) {
    assign(element, 'value', String(value));
    element.dispatchEvent(makeEvent(element, 'input'));
    element.dispatchEvent(makeEvent(element, 'change'));
    return true;
  }

  return false;
}

/** Текущее значение контрола — в той же форме, в какой оно попадает в снимок. */
export function readControlValue(element: FormControl): string | boolean {
  return isCheckbox(element) ? element.checked : element.value;
}

export function captureField(field: string, element: FormControl): CapturedField {
  const before = readControlValue(element);
  return { field, element, before, applied: before };
}

/**
 * Возврат формы в состояние до заполнения (§6А.6).
 *
 * Возвращаются ТОЛЬКО поля из снимка. Всё, что агент заполнил руками, мы
 * не трогали и трогать не имеем права: «очистить форму» — это отмена нашего
 * действия, а не очистка чужой работы.
 *
 * Поля, которые агент правил уже ПОСЛЕ заполнения, перечисляются отдельно
 * и по умолчанию не откатываются: там его правка, а не наша подстановка.
 */
export function restoreSnapshot(
  snapshot: FormSnapshot,
  options: { includeEdited?: boolean } = {},
): { restored: string[]; editedByAgent: string[] } {
  const restored: string[] = [];
  const editedByAgent: string[] = [];

  for (const captured of snapshot.fields) {
    const current = readControlValue(captured.element);
    const untouched = current === captured.applied;

    if (!untouched) {
      editedByAgent.push(captured.field);
      if (options.includeEdited !== true) continue;
    }

    if (setControlValue(captured.element, captured.before)) {
      restored.push(captured.field);
    }
  }

  return { restored, editedByAgent };
}

function isCheckbox(element: FormControl): element is HTMLInputElement {
  return 'type' in element && (element.type === 'checkbox' || element.type === 'radio');
}

/**
 * Список.
 *
 * По тегу, а не по набору свойств: `selectedIndex` есть не во всякой
 * реализации DOM, и проверка по нему тихо роняла список в «незнакомый
 * тип контрола».
 */
function isSelect(element: FormControl): element is HTMLSelectElement {
  return element.tagName === 'SELECT';
}

/**
 * Текстовое поле.
 *
 * Скрытые поля исключены намеренно: §6А.5 запрещает писать в них и подменять
 * служебные параметры формы. Файловые — тоже: их значение браузер программно
 * поставить не даёт, и попытка выглядела бы как обход ограничения.
 */
function isTextual(element: FormControl): boolean {
  if (!('value' in element)) return false;
  if (!('type' in element)) return true;

  return !['hidden', 'file', 'submit', 'button', 'image', 'reset'].includes(element.type);
}
