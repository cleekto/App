/**
 * Нормализация адресов и URL.
 *
 * Оба приведения существуют ради одного: сравнение должно давать одинаковый
 * результат для одной и той же вещи, записанной по-разному. Ошибка здесь
 * ломает дедупликацию молча — всё выглядит рабочим, а совпадения не находятся
 * (риск R-06).
 *
 * ЧТО ЗДЕСЬ ПРЕДПОЛОЖЕНИЕ. Как именно площадки пишут адреса, неизвестно:
 * фикстуры фазы 5 ещё не собраны (правило R2). Ниже — приведение, разумное
 * для трёх языков рынка; по фикстурам оно будет уточнено, и тогда набор
 * сокращений станет фактом, а не догадкой.
 */

/**
 * Сокращения, которые люди пишут по-разному. Ключ — что встречается,
 * значение — к чему приводим.
 *
 * Русский, английский и грузинский: адрес на площадке может быть на любом
 * из трёх, и один и тот же дом пишут то так, то эдак.
 */
const ABBREVIATIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bулица\b|\bулиц\b|\bул\b/gu, 'ул'],
  [/\bпроспект\b|\bпросп\b|\bпр-?кт\b/gu, 'пр'],
  [/\bпереулок\b|\bпер\b/gu, 'пер'],
  [/\bдом\b|\bд\b/gu, 'д'],
  [/\bкорпус\b|\bкорп\b|\bк\b/gu, 'к'],
  [/\bstreet\b|\bstr\b|\bst\b/gu, 'ул'],
  [/\bavenue\b|\bave\b|\bav\b/gu, 'пр'],
  [/\bქუჩა\b/gu, 'ул'],
  [/\bგამზირი\b/gu, 'пр'],
];

/**
 * Приводит адрес к сопоставимому виду.
 *
 * Пустой результат означает, что сравнивать нечего, и возвращается `null`:
 * пустая строка в индексе притворялась бы значением.
 */
export function normalizeAddress(input: string | null | undefined): string | null {
  if (input === null || input === undefined) return null;

  let value = input.toLowerCase();

  // Пунктуация — оформление, а не содержание адреса.
  value = value.replace(/[.,;:()"'«»]/gu, ' ');

  for (const [pattern, replacement] of ABBREVIATIONS) {
    value = value.replace(pattern, replacement);
  }

  // Схлопывание пробелов делается последним: замены выше могли их наплодить.
  value = value.replace(/\s+/gu, ' ').trim();

  return value === '' ? null : value;
}

/**
 * Метки, которые не относятся к самому объявлению: откуда пришёл переход,
 * какая была рекламная кампания, что подсветить на странице.
 */
const TRACKING_PARAMS = [
  /^utm_/u,
  /^fbclid$/u,
  /^gclid$/u,
  /^yclid$/u,
  /^ref$/u,
  /^referrer$/u,
  /^_openstat$/u,
];

/**
 * Канонический адрес объявления.
 *
 * Без канонизации одно и то же объявление, открытое из поиска и из закладки,
 * даёт два разных ключа — и уровень 1 дедупликации перестаёт работать там,
 * где у площадки нет внешнего идентификатора (риск R-08).
 *
 * Неразбираемый адрес возвращается как есть, приведённый к нижнему регистру:
 * пусть лучше ключ будет грубым, чем импорт упадёт.
 */
export function canonicalizeUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return input.trim().toLowerCase();
  }

  url.hash = '';
  url.protocol = 'https:';
  url.host = url.host.toLowerCase().replace(/^www\./u, '');

  const kept: Array<[string, string]> = [];
  for (const [key, value] of url.searchParams.entries()) {
    const lower = key.toLowerCase();
    if (TRACKING_PARAMS.some((pattern) => pattern.test(lower))) continue;
    kept.push([lower, value]);
  }

  // Порядок параметров в ссылке ничего не значит, а в строке — значит.
  kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  url.search = '';
  for (const [key, value] of kept) url.searchParams.append(key, value);

  let result = url.toString();
  // Завершающий слэш — та же страница.
  if (result.endsWith('/') && url.pathname !== '/') result = result.slice(0, -1);

  return result;
}
