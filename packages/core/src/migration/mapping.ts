/**
 * Сопоставление колонок файла с полями системы.
 *
 * Заголовки в реальных выгрузках написаны на трёх языках вперемешку, часто
 * сокращённо и с опечатками. Автоматическое предложение экономит агентству
 * время, но НИКОГДА не применяется молча: последнее слово за человеком
 * на экране сопоставления (§6Г.2).
 */

/** Поля, в которые можно сопоставить колонку. */
export const TARGET_FIELDS = [
  'address',
  'district',
  'price',
  'currency',
  'area',
  'rooms',
  'floor',
  'totalFloors',
  'propertyType',
  'transactionType',
  'ownerName',
  'ownerPhone',
  'description',
] as const;

export type TargetField = (typeof TARGET_FIELDS)[number];

/** Явный отказ от колонки. Не то же самое, что её отсутствие. */
export const SKIP = 'skip' as const;

export type MappingValue = TargetField | typeof SKIP;
export type ColumnMapping = Record<string, MappingValue>;

/**
 * Слова, по которым узнаётся колонка. Русский, английский, грузинский.
 *
 * Список заведомо неполон и таким останется: сколько бы вариантов сюда
 * ни вписать, следующее агентство назовёт колонку иначе. Поэтому предложение
 * — это подсказка, а не решение.
 */
const ALIASES: Record<TargetField, readonly string[]> = {
  address: ['адрес', 'улица', 'address', 'street', 'მისამართი', 'ქუჩა'],
  district: ['район', 'district', 'area name', 'რაიონი', 'უბანი'],
  price: ['цена', 'стоимость', 'price', 'cost', 'ფასი', 'ღირებულება'],
  currency: ['валюта', 'currency', 'ვალუტა'],
  area: ['площадь', 'кв м', 'кв.м', 'м2', 'area', 'size', 'sqm', 'ფართობი', 'ფართი'],
  rooms: ['комнат', 'комнаты', 'комн', 'rooms', 'room', 'ოთახი', 'ოთახები'],
  floor: ['этаж', 'floor', 'სართული'],
  totalFloors: ['этажность', 'этажей', 'всего этажей', 'total floors', 'floors', 'სართულიანობა'],
  propertyType: ['тип', 'тип недвижимости', 'type', 'property type', 'ტიპი'],
  transactionType: ['сделка', 'операция', 'продажа аренда', 'deal', 'transaction', 'გარიგება'],
  ownerName: ['имя', 'собственник', 'хозяин', 'владелец', 'name', 'owner', 'სახელი', 'მფლობელი'],
  ownerPhone: ['телефон', 'тел', 'номер', 'phone', 'mobile', 'tel', 'ტელეფონი', 'ნომერი'],
  description: [
    'описание',
    'примечание',
    'комментарий',
    'description',
    'notes',
    'comment',
    'აღწერა',
  ],
};

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[.,;:()"'«»№#]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * Предлагает сопоставление по заголовкам.
 *
 * Колонки, которые узнать не удалось, помечаются `skip` — и это нормальный
 * исход, а не ошибка. Молча выброшенная колонка — та, про которую потом
 * будут спорить, была ли она в файле.
 */
export function suggestMapping(columns: readonly string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const taken = new Set<TargetField>();

  // Два прохода: сначала точные совпадения, потом вхождения. Иначе колонка
  // «Этажность» перехватила бы поле floor у колонки «Этаж».
  for (const pass of ['exact', 'partial'] as const) {
    for (const column of columns) {
      if (column in mapping && mapping[column] !== SKIP) continue;

      const header = normalizeHeader(column);
      if (header === '') {
        mapping[column] = SKIP;
        continue;
      }

      const field = matchField(header, taken, pass);
      if (field !== null) {
        mapping[column] = field;
        taken.add(field);
      } else if (!(column in mapping)) {
        mapping[column] = SKIP;
      }
    }
  }

  return mapping;
}

function matchField(
  header: string,
  taken: ReadonlySet<TargetField>,
  pass: 'exact' | 'partial',
): TargetField | null {
  // Длинные псевдонимы проверяются раньше коротких: «всего этажей» должно
  // выиграть у «этаж».
  const candidates: Array<{ field: TargetField; alias: string }> = [];

  for (const field of TARGET_FIELDS) {
    if (taken.has(field)) continue;
    for (const alias of ALIASES[field]) candidates.push({ field, alias });
  }

  candidates.sort((a, b) => b.alias.length - a.alias.length);

  for (const { field, alias } of candidates) {
    if (pass === 'exact' ? header === alias : header.includes(alias)) return field;
  }

  return null;
}

// ── Приведение значений ──────────────────────────────────────────────────────

export interface Money {
  amount: number | null;
  currency: string | null;
}

const CURRENCY_MARKERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\$|usd|долл|დოლარი/iu, 'USD'],
  [/€|eur|евро|ევრო/iu, 'EUR'],
  [/₾|gel|лари|ლარი/iu, 'GEL'],
];

/**
 * Разбирает цену вместе с валютой.
 *
 * «Лари и доллары в одной колонке» — прямая цитата из §6Г.2, и это норма
 * для файлов агентств. Валюта, написанная рядом с числом, важнее колонки
 * «Валюта», которой в файле может не быть вовсе.
 */
export function parseMoney(value: string, fallbackCurrency?: string | null): Money {
  const text = value.trim();
  if (text === '') return { amount: null, currency: null };

  let currency: string | null = fallbackCurrency ?? null;
  for (const [pattern, code] of CURRENCY_MARKERS) {
    if (pattern.test(text)) {
      currency = code;
      break;
    }
  }

  const amount = parseDecimal(text);
  return { amount, currency: amount === null ? null : currency };
}

/**
 * Число из строки, написанной как угодно: «1 450 000», «1,450,000», «78,5».
 *
 * Разделитель дробной части в русской и грузинской раскладке — запятая,
 * а разделитель разрядов — пробел. В английской наоборот. Разобрать это
 * без догадок нельзя, поэтому правило простое: последний разделитель,
 * после которого стоит одна или две цифры, считается дробным.
 */
export function parseDecimal(value: string): number | null {
  const text = value.trim();
  if (text === '') return null;

  const cleaned = text.replace(/[^\d.,-]/gu, '');
  if (cleaned === '' || !/\d/u.test(cleaned)) return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  const lastSeparator = Math.max(lastComma, lastDot);

  let normalized: string;
  if (lastSeparator === -1) {
    normalized = cleaned;
  } else {
    const tail = cleaned.slice(lastSeparator + 1);
    if (tail.length >= 1 && tail.length <= 2 && /^\d+$/u.test(tail)) {
      // Дробная часть.
      normalized = `${cleaned.slice(0, lastSeparator).replace(/[.,]/gu, '')}.${tail}`;
    } else {
      // Разделитель разрядов.
      normalized = cleaned.replace(/[.,]/gu, '');
    }
  }

  const result = Number.parseFloat(normalized);
  return Number.isFinite(result) ? result : null;
}

export function parseInteger(value: string): number | null {
  const decimal = parseDecimal(value);
  return decimal === null ? null : Math.round(decimal);
}

const PROPERTY_TYPES: ReadonlyArray<readonly [RegExp, string]> = [
  [/кварт|apart|flat|ბინა/iu, 'APARTMENT'],
  [/дом|house|villa|სახლი/iu, 'HOUSE'],
  [/участ|land|plot|მიწა/iu, 'LAND'],
  [/коммер|офис|commercial|office|კომერც/iu, 'COMMERCIAL'],
];

export function parsePropertyType(value: string): string | null {
  for (const [pattern, code] of PROPERTY_TYPES) {
    if (pattern.test(value)) return code;
  }
  return null;
}

const TRANSACTION_TYPES: ReadonlyArray<readonly [RegExp, string]> = [
  [/аренд|rent|ქირა/iu, 'RENT'],
  [/прода|sale|sell|გაყიდვ/iu, 'SALE'],
];

export function parseTransactionType(value: string): string | null {
  for (const [pattern, code] of TRANSACTION_TYPES) {
    if (pattern.test(value)) return code;
  }
  return null;
}

/** Значения строки, разложенные по полям системы. */
export type MappedRow = Partial<Record<TargetField, string>>;

export function applyMapping(
  columns: readonly string[],
  row: readonly string[],
  mapping: ColumnMapping,
): MappedRow {
  const result: MappedRow = {};

  columns.forEach((column, index) => {
    const target = mapping[column];
    if (target === undefined || target === SKIP) return;

    const value = (row[index] ?? '').trim();
    if (value === '') return;

    // Несколько колонок в одно поле: склеиваем, а не затираем. Адрес
    // в выгрузках часто разнесён на «улица» и «дом».
    const existing = result[target];
    result[target] = existing === undefined ? value : `${existing} ${value}`;
  });

  return result;
}
