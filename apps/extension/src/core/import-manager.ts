import { adapterFor } from '@cleekto/adapters';
import type { ExtractionResult, ListingImportPayload } from '@cleekto/contracts';

/**
 * Оркестрация импорта: определить сайт → извлечь → проверить телефон → отправить.
 *
 * ЗДЕСЬ НЕТ НИ CHROME, НИ DOM-ГЛОБАЛОВ, НИ FETCH. Всё внешнее приходит
 * аргументом: `document` — параметром, сеть — через `deps.send`. Сделано ровно
 * ради одного: обязательный тест фазы 6 («телефон не раскрыт → запрос не ушёл»)
 * должен выполняться в Node, а не в браузере с ручной проверкой глазами.
 *
 * Логики, привязанной к конкретной площадке, тут нет и быть не может —
 * она вся в `packages/adapters` (инвариант 6).
 */

export type CallOutcome = 'consent' | 'refused' | 'no_answer' | 'callback';

/**
 * Тело запроса `POST /api/v1/import/listing`.
 *
 * Схема на сервере объявлена `.strict()`: лишнее поле — не «проигнорируется»,
 * а вернёт 400. Поэтому набор здесь ровно тот, что принимает сервер.
 *
 * ПОЛЕЙ companyId, teamId И assignedUserId ЗДЕСЬ НЕТ (правило 5): расширению
 * их взять неоткуда и не нужно — сервер берёт их из сессии.
 *
 * `bedrooms` не отправляется, хотя адаптер ss.ge его извлекает: этого поля нет
 * ни в `Property`, ни в схеме импорта. Отправка уронила бы запрос целиком.
 * Расхождение зафиксировано как находка фазы 6, молча оно не теряется.
 */
export interface ImportRequestBody {
  source: string;
  sourceUrl: string;
  externalId?: string | null;

  title?: string | null;
  propertyType?: string | null;
  transactionType?: string | null;

  price?: number | null;
  currency?: string | null;

  area?: number | null;
  rooms?: number | null;
  floor?: number | null;
  totalFloors?: number | null;

  district?: string | null;
  address?: string | null;
  description?: string | null;
  photos?: string[];

  owner: { name?: string | null; phone: string };

  parserVersion: string;
  missingFields?: string[];

  outcome: CallOutcome;
  callbackAt?: string | null;
  doNotCallCompanyWide?: boolean;
  note?: string | null;
  acknowledgedDuplicateOf?: string[];
}

/** Ответ сервера. Форма — `ImportResult` из ядра. */
export interface ImportResponse {
  result:
    | 'created'
    | 'duplicate_blocked'
    | 'duplicate_warning'
    | 'linked_to_existing'
    | 'observation_recorded';
  verdict: string;
  propertyId: string | null;
  sourceListingId: string | null;
  observationId: string;
  matches: unknown[];
  otherTeamMatches: unknown[];
  reasonHuman: string | null;
}

/** То, что показывается агенту до отправки. Без описания и фотографий. */
export interface ListingPreview {
  title: string | null;
  price: number | null;
  currency: string | null;
  area: number | null;
  rooms: number | null;
  address: string | null;
  district: string | null;
  phone: string | null;
  missingFields: string[];
}

export interface ImportOptions {
  outcome: CallOutcome;
  callbackAt?: string | null;
  doNotCallCompanyWide?: boolean;
  note?: string | null;
  acknowledgedDuplicateOf?: string[];
}

export type ImportFlowResult =
  /** Страница не объявление ss.ge или myhome.ge. Не ошибка. */
  | { kind: 'unsupported' }
  /** ПРАВИЛО 11. Запрос не отправлен. */
  | { kind: 'phone_not_revealed'; preview: ListingPreview }
  | { kind: 'sent'; response: ImportResponse; preview: ListingPreview }
  | { kind: 'failed'; error: 'network' | 'session' | 'unknown'; preview: ListingPreview };

export interface ImportDeps {
  /**
   * Единственный выход расширения в сеть.
   *
   * Отдельной зависимостью — чтобы тест мог доказать, что при нераскрытом
   * телефоне сюда не приходят вообще: не «пришёл пустой запрос», а не пришло
   * ничего. Проверить это, дёргая настоящий `fetch`, нельзя.
   */
  send(body: ImportRequestBody): Promise<ImportResponse>;
}

/**
 * Номер, годный для отправки, либо `null`.
 *
 * ВТОРАЯ ЛИНИЯ ПРАВИЛА 11, намеренно дублирующая адаптер. Промпт §6.2 требует
 * считать номер нераскрытым, если строка «содержит маску (звёздочки, точки,
 * „показать“, „show“ и подобное) или не проходит проверку на телефон после
 * нормализации». Адаптер это уже делает — но `isPhoneRevealed()` объявлен
 * частью интерфейса именно затем, чтобы требование не потерялось при
 * добавлении третьего источника. Значит, полагаться на один адаптер нельзя:
 * автор третьего может ошибиться, а цена ошибки — испорченная дедупликация
 * всей команды.
 */
export function usablePhone(phones: readonly string[]): string | null {
  for (const raw of phones) {
    const value = raw.trim();
    if (value === '') continue;

    // Маска: всё, чем площадки закрывают неразвёрнутый номер.
    if (/[*•·]|\.{2,}|show|показать|ნახვა/iu.test(value)) continue;

    const digits = value.replace(/\D/gu, '');
    const national = digits.startsWith('995') ? digits.slice(3) : digits;
    if (national.length !== 9 || !national.startsWith('5')) continue;

    return value;
  }
  return null;
}

function toPreview(payload: ListingImportPayload, missingFields: string[]): ListingPreview {
  return {
    title: payload.title,
    price: payload.price,
    currency: payload.currency,
    area: payload.area,
    rooms: payload.rooms,
    address: payload.address,
    district: payload.district,
    phone: usablePhone(payload.owner.phones),
    missingFields,
  };
}

/**
 * Тело запроса из извлечения. Отдельной функцией — её проверяет тест
 * на отсутствие лишних полей, которые уронила бы строгая схема сервера.
 */
export function toRequestBody(
  extraction: ExtractionResult,
  phone: string,
  options: ImportOptions,
): ImportRequestBody {
  const { payload } = extraction;

  const body: ImportRequestBody = {
    source: payload.source,
    sourceUrl: payload.sourceUrl,
    externalId: payload.externalId,
    title: payload.title,
    propertyType: payload.propertyType,
    transactionType: payload.transactionType,
    price: payload.price,
    currency: payload.currency,
    area: payload.area,
    rooms: payload.rooms,
    floor: payload.floor,
    totalFloors: payload.totalFloors,
    district: payload.district,
    address: payload.address,
    description: payload.description,
    photos: payload.photos,
    owner: { name: payload.owner.name, phone },
    parserVersion: extraction.parserVersion,
    missingFields: extraction.missingFields,
    outcome: options.outcome,
  };

  // Необязательные поля добавляются, только когда они есть: строгая схема
  // отвергает `callbackAt: undefined` не хуже, чем лишний ключ.
  if (options.callbackAt !== undefined && options.callbackAt !== null) {
    body.callbackAt = options.callbackAt;
  }
  if (options.doNotCallCompanyWide === true) {
    body.doNotCallCompanyWide = true;
  }
  if (options.note !== undefined && options.note !== null && options.note !== '') {
    body.note = options.note;
  }
  if (options.acknowledgedDuplicateOf !== undefined && options.acknowledgedDuplicateOf.length > 0) {
    body.acknowledgedDuplicateOf = options.acknowledgedDuplicateOf;
  }

  return body;
}

/**
 * Полный путь импорта.
 *
 * Все четыре исхода разговора идут здесь одной логикой (промпт §5Б.2):
 * различие только в поле `outcome`, а решение, создавать ли объект,
 * принимает сервер. Расширению незачем это знать, и знать оно не должно —
 * иначе правило R14 пришлось бы держать в двух местах.
 */
export async function runImport(
  deps: ImportDeps,
  document: Document,
  url: string,
  options: ImportOptions,
): Promise<ImportFlowResult> {
  const adapter = adapterFor(url);
  if (adapter === null) {
    return { kind: 'unsupported' };
  }

  const extraction = adapter.extract(document, url);
  const preview = toPreview(extraction.payload, extraction.missingFields);

  // ПРАВИЛО 11. Проверка стоит ДО формирования запроса, не после: так
  // физически некуда вставить отправку «на всякий случай».
  if (!adapter.isPhoneRevealed(document)) {
    return { kind: 'phone_not_revealed', preview };
  }

  const phone = usablePhone(extraction.payload.owner.phones);
  if (phone === null) {
    return { kind: 'phone_not_revealed', preview };
  }

  const body = toRequestBody(extraction, phone, options);

  try {
    const response = await deps.send(body);
    return { kind: 'sent', response, preview };
  } catch (error) {
    return { kind: 'failed', error: classify(error), preview };
  }
}

/**
 * Ошибка сети против истёкшей сессии.
 *
 * Различать обязательно: §6.5 требует предлагать вход заново вместо
 * молчаливого сбоя, а при обрыве сети — повтор с сохранением предпросмотра.
 */
function classify(error: unknown): 'network' | 'session' | 'unknown' {
  if (error instanceof Error && error.name === 'UnauthenticatedError') return 'session';
  if (error instanceof TypeError) return 'network';
  return 'unknown';
}
