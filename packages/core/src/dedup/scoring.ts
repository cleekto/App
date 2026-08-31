import { dedupConfig, type DedupConfig, type SignalField } from './config';

/**
 * Оценка сходства двух объектов. Чистые функции: проверяются без базы,
 * поэтому калибровка весов не требует поднимать PostgreSQL.
 *
 * Устройство четырёх уровней — docs/architecture/duplicate-detection.md §2.
 * Уровни 1–3 детерминированы, уровень 4 вероятностный, итоговый вердикт —
 * наибольший из двух. Так сделано сознательно: правило «телефон + адрес →
 * STRONG» не всегда достижимо суммой весов, и подгонять веса под него
 * означало бы раздуть вес адреса — свободного текста без гарантии формата.
 */

export type Verdict = 'EXACT' | 'STRONG' | 'POSSIBLE' | 'NONE';

/** Признаки объекта в виде, пригодном для сравнения. */
export interface Facts {
  /** Нормализованные телефоны собственника, E.164. */
  phones: readonly string[];
  addressNormalized: string | null;
  area: number | null;
  rooms: number | null;
  floor: number | null;
  totalFloors: number | null;
  price: number | null;
  currency: string | null;
  propertyType: string | null;
  photos: readonly string[];
  /**
   * Район. В оценке НЕ участвует: он грубее адреса и с ним коррелирует,
   * так что отдельный вес был бы двойным счётом одного и того же.
   * Используется только для сужения набора кандидатов до полной оценки.
   */
  district: string | null;
}

export interface Reason {
  field: SignalField;
  weight: number;
  detail: string;
}

export interface Comparison {
  score: number;
  matched: SignalField[];
  /** Признаки, сравнимые у обеих сторон. */
  comparable: SignalField[];
  reasons: Reason[];
}

/**
 * Сравнивает два набора признаков.
 *
 * Признак, отсутствующий хотя бы у одной стороны, не участвует ни в сумме,
 * ни против неё: отсутствие данных — не доказательство различия.
 */
export function compare(a: Facts, b: Facts, config: DedupConfig = dedupConfig()): Comparison {
  const weights = config.weights;
  const matched: SignalField[] = [];
  const comparable: SignalField[] = [];
  const reasons: Reason[] = [];

  const record = (field: SignalField, isComparable: boolean, isMatch: boolean, detail: string) => {
    if (!isComparable) return;
    comparable.push(field);
    if (!isMatch) return;
    matched.push(field);
    reasons.push({ field, weight: weights[field], detail });
  };

  // Телефон — половина шкалы. Единственный признак, который на рынке
  // объявлений почти уникален (S§4.14).
  const sharedPhone = a.phones.find((phone) => b.phones.includes(phone));
  record(
    'ownerPhone',
    a.phones.length > 0 && b.phones.length > 0,
    sharedPhone !== undefined,
    'совпадает номер собственника',
  );

  const addressSimilarity = similarity(a.addressNormalized, b.addressNormalized);
  record(
    'address',
    a.addressNormalized !== null && b.addressNormalized !== null,
    addressSimilarity >= config.matching.addressTrigramThreshold,
    `адрес похож на ${Math.round(addressSimilarity * 100)}%`,
  );

  record(
    'area',
    a.area !== null && b.area !== null,
    closeEnough(
      a.area,
      b.area,
      config.matching.areaTolerancePercent,
      config.matching.areaToleranceAbsolute,
    ),
    `${a.area} м² ≈ ${b.area} м²`,
  );

  record(
    'rooms',
    a.rooms !== null && b.rooms !== null,
    a.rooms === b.rooms,
    `${a.rooms} = ${b.rooms}`,
  );

  // Совпавший URL фотографии означает буквально тот же файл на площадке —
  // сильный признак почти без затрат. Сравнения самих изображений в MVP нет.
  const sharedPhoto = a.photos.find((photo) => b.photos.includes(photo));
  record(
    'photos',
    a.photos.length > 0 && b.photos.length > 0,
    sharedPhoto !== undefined,
    'совпадает фотография',
  );

  record(
    'price',
    a.price !== null && b.price !== null && a.currency === b.currency,
    closeEnough(a.price, b.price, config.matching.priceTolerancePercent, 0),
    `цена отличается менее чем на ${config.matching.priceTolerancePercent}%`,
  );

  record('floor', a.floor !== null && b.floor !== null, a.floor === b.floor, `этаж ${a.floor}`);

  record(
    'propertyType',
    a.propertyType !== null && b.propertyType !== null,
    a.propertyType === b.propertyType,
    'тип недвижимости совпадает',
  );

  record(
    'totalFloors',
    a.totalFloors !== null && b.totalFloors !== null,
    a.totalFloors === b.totalFloors,
    `этажей в доме ${a.totalFloors}`,
  );

  const score = Math.min(
    1,
    matched.reduce((sum, field) => sum + weights[field], 0),
  );

  return { score, matched, comparable, reasons };
}

/**
 * Вердикт по результату сравнения.
 *
 * Уровень 2: телефон сам по себе даёт не ниже POSSIBLE — у одного собственника
 * бывает несколько квартир, и это норма, а не аномалия.
 *
 * Уровень 3: телефон И (адрес ИЛИ (площадь И комнаты)) → STRONG,
 * детерминированно, независимо от суммы весов.
 *
 * Уровень 4: балл против порогов.
 */
export function verdictFor(comparison: Comparison, config: DedupConfig = dedupConfig()): Verdict {
  const has = (field: SignalField) => comparison.matched.includes(field);

  if (has('ownerPhone') && (has('address') || (has('area') && has('rooms')))) {
    return 'STRONG';
  }

  const byScore = scoreVerdict(comparison, config);

  // Телефон совпал, но параметров не хватило на STRONG — это кандидат,
  // а не «ничего».
  if (has('ownerPhone') && byScore === 'NONE') return 'POSSIBLE';

  return byScore;
}

function scoreVerdict(comparison: Comparison, config: DedupConfig): Verdict {
  const { score, comparable } = comparison;

  if (score >= config.thresholds.strong) {
    // Защита от ложного STRONG на бедных данных: два совпавших признака
    // из двух сравнимых и два из девяти — разные ситуации.
    return comparable.length >= config.matching.minComparableFieldsForStrong
      ? 'STRONG'
      : 'POSSIBLE';
  }

  if (score >= config.thresholds.possible) return 'POSSIBLE';

  return 'NONE';
}

/** Человеческая формулировка причины. Балл без объяснения агенты игнорируют. */
export function reasonHuman(comparison: Comparison): string {
  if (comparison.reasons.length === 0) return 'Совпадений не найдено';

  const parts = comparison.reasons.slice(0, 3).map((reason) => {
    switch (reason.field) {
      case 'ownerPhone':
        return 'номер собственника';
      case 'address':
        return 'адрес';
      case 'area':
        return 'площадь';
      case 'rooms':
        return 'число комнат';
      case 'photos':
        return 'фотография';
      case 'price':
        return 'цена';
      case 'floor':
        return 'этаж';
      case 'propertyType':
        return 'тип недвижимости';
      case 'totalFloors':
        return 'этажность';
    }
  });

  const head = parts[0] ?? '';
  const capitalized = head.charAt(0).toUpperCase() + head.slice(1);

  return parts.length === 1
    ? `Совпадает ${head}`
    : `${capitalized} и ещё: ${parts.slice(1).join(', ')}`;
}

// ── Вспомогательное ──────────────────────────────────────────────────────────

function closeEnough(
  a: number | null,
  b: number | null,
  tolerancePercent: number,
  toleranceAbsolute: number,
): boolean {
  if (a === null || b === null) return false;

  const difference = Math.abs(a - b);
  const allowed = Math.max(
    (Math.max(Math.abs(a), Math.abs(b)) * tolerancePercent) / 100,
    toleranceAbsolute,
  );

  return difference <= allowed;
}

/**
 * Сходство строк по триграммам — та же мера, что у `pg_trgm.similarity`.
 *
 * Реализована здесь, чтобы сравнение работало и в чистых тестах, где базы нет.
 * Отбор кандидатов при этом делает Postgres по индексу: считать сходство
 * в приложении для всей базы было бы линейным перебором (риск R-10).
 */
export function similarity(a: string | null, b: string | null): number {
  if (a === null || b === null) return 0;
  if (a === b) return 1;

  const left = trigrams(a);
  const right = trigrams(b);
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared += 1;

  return shared / (left.size + right.size - shared);
}

function trigrams(value: string): Set<string> {
  const padded = `  ${value.trim().replace(/\s+/gu, ' ')} `;
  const result = new Set<string>();
  for (let i = 0; i + 3 <= padded.length; i += 1) result.add(padded.slice(i, i + 3));
  return result;
}
