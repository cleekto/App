import { parseHTML } from 'linkedom';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  captureField,
  readControlValue,
  restoreSnapshot,
  setControlValue,
  type FormControl,
  type FormSnapshot,
} from './form-fill';

/**
 * Приёмы заполнения формы.
 *
 * Здесь нет ни одного селектора площадки: фикстур форм размещения нет, и
 * выдумывать их запрещено правилом 2. Проверяется техника — то, что одинаково
 * для любого сайта и что можно проверить на собранной вручную форме.
 */

const FORM = `<!doctype html><html><body><form>
  <input id="title" value="старое название">
  <textarea id="description">старое описание</textarea>
  <select id="type">
    <option value="">—</option>
    <option value="flat">квартира</option>
    <option value="house">дом</option>
  </select>
  <input id="agree" type="checkbox">
  <input id="token" type="hidden" value="служебное">
  <input id="photos" type="file">
  <input id="send" type="submit" value="Опубликовать">
</form></body></html>`;

let document: Document;

function control(id: string): FormControl {
  return document.getElementById(id) as unknown as FormControl;
}

beforeEach(() => {
  document = parseHTML(FORM).document as unknown as Document;
});

describe('запись значения в контрол', () => {
  /**
   * Главный приём §6А.5.
   *
   * React и Vue подменяют свойство `value`, чтобы следить за изменениями.
   * Простое присваивание пишет в их обёртку: на экране форма выглядит
   * заполненной, а для сайта она пуста. Агент нажмёт «Опубликовать»
   * и получит объявление без данных.
   */
  it('текстовое поле получает значение и события input и change', () => {
    const element = control('title');
    const seen: string[] = [];
    element.addEventListener('input', () => seen.push('input'));
    element.addEventListener('change', () => seen.push('change'));

    expect(setControlValue(element, 'новое название')).toBe(true);

    expect(element.value).toBe('новое название');
    expect(seen).toEqual(['input', 'change']);
  });

  it('многострочное поле заполняется так же', () => {
    expect(setControlValue(control('description'), 'новое описание')).toBe(true);
    expect(control('description').value).toBe('новое описание');
  });

  it('число приводится к строке, а не теряется', () => {
    expect(setControlValue(control('title'), 179000)).toBe(true);
    expect(control('title').value).toBe('179000');
  });

  it('список выбирает точное значение', () => {
    const element = control('type');
    const seen: string[] = [];
    element.addEventListener('change', () => seen.push('change'));

    expect(setControlValue(element, 'flat')).toBe(true);
    expect(element.value).toBe('flat');
    expect(seen).toEqual(['change']);
  });

  /**
   * ПРАВИЛО 14. Значения нет в списке площадки — поле остаётся пустым
   * и уходит в `unfilled`. «Ближайшее похожее» здесь запрещено: неверное
   * значение агент не заметит и опубликует, а пустое увидит сразу.
   */
  it('значения, которого нет в списке, не подменяет похожим', () => {
    const element = control('type');
    const before = element.value;

    expect(setControlValue(element, 'таунхаус')).toBe(false);
    expect(element.value).toBe(before);
  });

  it('галочка ставится', () => {
    const element = control('agree') as HTMLInputElement;
    expect(setControlValue(element, true)).toBe(true);
    expect(element.checked).toBe(true);
  });

  /**
   * §6А.5: расширение не пишет в скрытые поля и не подменяет служебные
   * параметры формы. Файловое поле программно не заполняется в принципе —
   * попытка выглядела бы как обход ограничения браузера.
   */
  it.each([
    ['token', 'скрытое служебное поле'],
    ['photos', 'загрузка файла'],
    ['send', 'кнопка отправки'],
  ])('в поле #%s (%s) не пишет', (id) => {
    const element = control(id);
    const before = element.value;

    expect(setControlValue(element, 'что угодно')).toBe(false);
    expect(element.value).toBe(before);
  });
});

describe('снимок и очистка формы', () => {
  function fill(): FormSnapshot {
    const captured = [
      captureField('title', control('title')),
      captureField('description', control('description')),
    ];

    for (const field of captured) {
      setControlValue(field.element, `заполнено ${field.field}`);
      field.applied = readControlValue(field.element);
    }

    return { id: 'snapshot-1', takenAt: 0, fields: captured };
  }

  it('возвращает поля в состояние до заполнения', () => {
    const snapshot = fill();
    expect(control('title').value).toBe('заполнено title');

    const { restored, editedByAgent } = restoreSnapshot(snapshot);

    expect(restored.sort()).toEqual(['description', 'title']);
    expect(editedByAgent).toEqual([]);
    expect(control('title').value).toBe('старое название');
    expect(control('description').value).toBe('старое описание');
  });

  /**
   * §6А.6. «Очистить» отменяет НАШЕ действие, а не чужую работу. Поле,
   * которого мы не касались, не входит в снимок и не трогается.
   */
  it('не трогает поля, заполненные агентом вручную', () => {
    const snapshot = fill();
    setControlValue(control('type'), 'house');

    restoreSnapshot(snapshot);

    expect(control('type').value).toBe('house');
  });

  /**
   * §6А.6: если агент правил заполненное поле руками, очистка предупреждает
   * до отката. Молча стереть его правку — худший исход: он этого не заметит.
   */
  it('правку агента в заполненном поле называет и по умолчанию не откатывает', () => {
    const snapshot = fill();
    setControlValue(control('title'), 'правка агента');

    const { restored, editedByAgent } = restoreSnapshot(snapshot);

    expect(editedByAgent).toEqual(['title']);
    expect(restored).toEqual(['description']);
    expect(control('title').value).toBe('правка агента');
  });

  it('по явному согласию откатывает и правку агента', () => {
    const snapshot = fill();
    setControlValue(control('title'), 'правка агента');

    const { restored } = restoreSnapshot(snapshot, { includeEdited: true });

    expect(restored.sort()).toEqual(['description', 'title']);
    expect(control('title').value).toBe('старое название');
  });
});
