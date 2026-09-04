/**
 * Данные объявления из самой страницы.
 *
 * ПОЧЕМУ НЕ ИЗ РАЗМЕТКИ. Обе площадки — приложения на Next.js: страница
 * приходит с сервера вместе со скриптом `__NEXT_DATA__`, в котором лежит
 * весь объект объявления, а разметку браузер рисует из него уже потом.
 *
 * Чтение разметки проигрывает этому по трём причинам сразу:
 *
 * 1. ОНО НЕПОЛНОЕ. В данных около сотни полей — состояние ремонта, лифт,
 *    отопление, кадастровый код, — а на экран попадает часть, и то
 *    вперемешку с оформлением.
 * 2. ОНО ГОНЯЕТСЯ С ОТРИСОВКОЙ. Расширение читает страницу по
 *    `document_idle`, а приложение к этому моменту может ещё ничего
 *    не нарисовать: на живой странице в теле было 782 символа — одна
 *    навигация.
 * 3. ОНО ЛОМАЕТСЯ ОТ ПЕРЕВЁРСТКИ. Класс поменяли — адаптер ослеп. Ключ
 *    в данных живёт дольше вёрстки.
 *
 * Это не обход защиты и не обращение к внутренним адресам площадки:
 * скрипт приходит в том же ответе, что и страница, любому читателю.
 *
 * ФОРМА ДАННЫХ У ПЛОЩАДОК РАЗНАЯ, и меняется она без предупреждения:
 * фикстуры ss.ge от 2026-08-31 сохранены с маршрутом `/real-estate`
 * и объекта объявления не содержат вовсе, а через неделю на живой странице
 * маршрут уже `/real-estate/[slug]`. Поэтому здесь только доставание
 * и никакого знания о конкретных полях — оно в адаптерах.
 */

/** Разобранный `__NEXT_DATA__` либо `null`, если его на странице нет. */
export function nextData(document: Document): Record<string, unknown> | null {
  const script = document.getElementById('__NEXT_DATA__');
  if (script === null) return null;

  const raw = script.textContent;
  if (raw === null || raw.trim() === '') return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    // Испорченный JSON — это отсутствие данных, а не повод падать:
    // адаптер вернётся к разбору разметки.
    return null;
  }
}

/**
 * Значение по пути. `pageProps.applicationData` вместо лестницы проверок.
 *
 * Каждый шаг может отсутствовать — форма данных площадки не наш контракт,
 * и обращаться к ней надо как к чужой.
 */
export function at(source: unknown, path: readonly string[]): unknown {
  let current = source;

  for (const key of path) {
    if (!isRecord(current)) return null;
    current = current[key];
  }

  return current ?? null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Строка или `null`. Пустая строка — это отсутствие значения, а не значение. */
export function text(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * Число или `null`.
 *
 * Площадки отдают числа то числом, то строкой, то пустой строкой —
 * `areaOfYard: ""` на живой странице. Ноль тоже отбрасывается: «0 балконов»
 * и «про балконы не сказано» на этих площадках неразличимы, а показывать
 * агенту выдуманный ноль хуже, чем прочерк.
 */
export function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0 ? value : null;

  if (typeof value === 'string') {
    const trimmed = value.trim().replace(',', '.');
    if (trimmed === '') return null;

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
  }

  return null;
}

/** Целое неотрицательное или `null`. */
export function int(value: unknown): number | null {
  const parsed = num(value);
  return parsed === null ? null : Math.trunc(parsed);
}

/** Логическое, но только явное: `undefined` и `null` остаются `null`. */
export function flag(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

/**
 * Расшифровка кода по справочнику самой площадки.
 *
 * myhome.ge отдаёт тип проекта и санузел числами, а словарь значений кладёт
 * в ту же страницу, по языкам. Брать имя оттуда — единственный честный
 * способ: придумывать, что «8» это «нестандартный», нельзя (правило 2),
 * а показывать агенту цифру бессмысленно.
 */
export function fromDictionary(dictionary: unknown, code: unknown): string | null {
  if (!isRecord(dictionary)) return null;

  const key = text(code);
  if (key === null) return null;

  return text(dictionary[key]);
}
