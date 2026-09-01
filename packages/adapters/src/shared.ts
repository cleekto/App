/**
 * Приёмы, общие для обеих площадок.
 *
 * Здесь нет ничего, что знает про ss.ge или myhome.ge конкретно, — только
 * работа с разметкой, одинаковая для любого сайта.
 */

/**
 * Разделители разрядов, какими их пишут площадки: обычный пробел,
 * неразрывный и запятая.
 *
 * Неразрывный записан escape-последовательностью, а не самим символом.
 * числа как «7&nbsp;849», и учитывать это нужно — но невидимый пробел
 * в исходнике это ровно та правка, которую следующий человек сотрёт,
 * не заметив, что сломал разбор чисел.
 */
const SEPARATORS = '\\s\\u00A0,';

/** Содержимое мета-тега по `property` или `name`. */
export function metaContent(document: Document, key: string): string | null {
  const element =
    document.querySelector(`meta[property="${key}"]`) ??
    document.querySelector(`meta[name="${key}"]`);

  const value = element?.getAttribute('content')?.trim();
  return value === undefined || value === '' ? null : value;
}

/**
 * Номера телефонов со страницы.
 *
 * Опора — ссылки `tel:`, а не текст. Текст номера площадки форматируют
 * по-разному и меняют оформление; ссылка `tel:` — часть смысла страницы,
 * а не её оформления, и меняется куда реже.
 */
export function telLinks(document: Document): string[] {
  const found = [...document.querySelectorAll('a[href^="tel:"]')]
    .map((link) => link.getAttribute('href') ?? '')
    .map((href) => href.slice('tel:'.length).trim())
    .filter((value) => value !== '');

  return [...new Set(found)];
}

/**
 * Грузинский мобильный: девять цифр, первая — пятёрка.
 *
 * Городские номера начинаются с нуля и кода города. У обеих площадок
 * собственная линия поддержки — именно городская, и без этой проверки
 * телефон площадки попал бы в поле собственника.
 */
export function isGeorgianMobile(raw: string): boolean {
  const digits = raw.replace(/\D/gu, '');
  const national = digits.startsWith('995') ? digits.slice(3) : digits;
  return national.length === 9 && national.startsWith('5');
}

/** Целое из строки вида «85 კვ.მ», «7/10», «118 000». */
export function firstInteger(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;

  const match = new RegExp(`-?\\d[\\d${SEPARATORS}]*`, 'u').exec(value);
  if (match === null) return null;

  const digits = match[0].replace(new RegExp(`[${SEPARATORS}]`, 'gu'), '');
  const number = Number.parseInt(digits, 10);
  return Number.isFinite(number) ? number : null;
}

/** Дробное из строки: «64,5» и «64.5» дают одно и то же. */
export function firstDecimal(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;

  const match = new RegExp(`\\d[\\d\\s\\u00A0]*(?:[.,]\\d+)?`, 'u').exec(value);
  if (match === null) return null;

  const cleaned = match[0].replace(new RegExp(`[${SEPARATORS}]`, 'gu'), '').replace(',', '.');
  const number = Number.parseFloat(cleaned);
  return Number.isFinite(number) ? number : null;
}

/** «7/10» и «8 / 12» → этаж и этажность. */
export function parseFloorPair(value: string | null): {
  floor: number | null;
  totalFloors: number | null;
} {
  if (value === null) return { floor: null, totalFloors: null };

  const match = /(\d+)\s*\/\s*(\d+)/u.exec(value);
  if (match === null) return { floor: firstInteger(value), totalFloors: null };

  return {
    floor: Number.parseInt(match[1] as string, 10),
    totalFloors: Number.parseInt(match[2] as string, 10),
  };
}

const CURRENCY_SIGNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\$|usd/iu, 'USD'],
  [/€|eur/iu, 'EUR'],
  [/₾|gel|lari/iu, 'GEL'],
  // Грузинское «ლარი» проверяется отдельным шаблоном: латинское `lari`
  // выше его не покрывает.
  [/ლარი/u, 'GEL'],
];

export function detectCurrency(value: string | null): string | null {
  if (value === null) return null;
  for (const [pattern, code] of CURRENCY_SIGNS) {
    if (pattern.test(value)) return code;
  }
  return null;
}

/**
 * Последнее число в пути адреса — внешний идентификатор объявления.
 *
 * У обеих площадок он стоит в конце пути и повторяется в заголовке страницы.
 * Может отсутствовать в принципе (риск R-08), поэтому возвращается `null`,
 * а не выдуманное значение.
 */
export function externalIdFromUrl(url: string | null): string | null {
  if (url === null) return null;

  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    path = url;
  }

  const match = /(\d{5,})\/?$/u.exec(path.replace(/\/+$/u, ''));
  return match === null ? null : (match[1] as string);
}

/** Приводит относительную ссылку к абсолютной, если возможно. */
export function absoluteUrl(src: string | null, base: string): string | null {
  if (src === null || src.trim() === '') return null;
  try {
    return new URL(src, base).toString();
  } catch {
    return null;
  }
}

/**
 * Фотографии, принадлежащие именно этому объявлению.
 *
 * ЗАЧЕМ ПРОВЕРКА ВЛАДЕЛЬЦА. Страница объявления на обеих площадках несёт
 * карточки похожих предложений, и картинки в них лежат на том же CDN.
 * Отбор «всё с CDN» давал чужие снимки: на фикстуре участка myhome
 * (25880360) все 32 «фотографии галереи» принадлежали соседним участкам
 * на том же Лиси, на квартире ss.ge — 19 миниатюр из чужих карточек.
 *
 * Цена ошибки выше, чем кажется на первый взгляд: фотографии — один из
 * признаков дедупликации, и снимки соседнего похожего объекта тянут
 * оценку к ложному вердикту «дубль».
 *
 * Правило: снимок чужой, если лежит внутри ссылки на другое объявление.
 * Картинки вне ссылок считаются своими — так устроена галерея.
 */
export function ownImages(document: Document, base: string, cdn: RegExp): string[] {
  const ownId = externalIdFromUrl(base);

  const found: string[] = [];
  for (const img of document.querySelectorAll('img')) {
    const src = absoluteUrl(img.getAttribute('src'), base);
    if (src === null || !cdn.test(src)) continue;

    const href = img.closest('a')?.getAttribute('href') ?? null;
    if (href !== null && ownId !== null) {
      const targetId = externalIdFromUrl(absoluteUrl(href, base));
      if (targetId !== null && targetId !== ownId) continue;
    }
    found.push(src);
  }
  return found;
}
