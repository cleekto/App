import { publishAdapterFor, restoreSnapshot } from '@kleekto/adapters';
import type { FormSnapshot, ListingPublishAdapter } from '@kleekto/adapters';
import type { FillResult, ListingPublishDraft } from '@kleekto/contracts';

/**
 * Оркестрация заполнения формы размещения (§6А).
 *
 * Как и импорт, живёт отдельно от Chrome: страница приходит аргументом, сеть —
 * зависимостью. Ради того же самого — чтобы правило 12 («публикует человек»)
 * проверялось тестом, а не осмотром.
 *
 * ЗДЕСЬ НЕТ И НЕ БУДЕТ ОТПРАВКИ ФОРМЫ. Ни `submit`, ни клика по кнопке
 * публикации, ни галочки согласия. Проверяется структурным тестом.
 */

export type Unavailable =
  /** Площадка не поддерживается либо адаптеров заполнения ещё нет. */
  | 'no_adapter'
  /** Страница не является формой создания объявления. */
  | 'not_new_listing_form';

export type PublishAvailability =
  | { kind: 'unavailable'; reason: Unavailable }
  | { kind: 'available'; adapter: ListingPublishAdapter };

/**
 * Доступен ли пункт «Заполнить» на этой странице.
 *
 * Требование фазы: страница не форма создания объявления → пункт недоступен.
 * Недоступен, а не «нажимается и ничего не делает»: кнопка, которая молчит,
 * учит агента, что расширение ненадёжно.
 */
export function publishAvailability(
  document: Document,
  url: string,
  resolve: (url: string) => ListingPublishAdapter | null = publishAdapterFor,
): PublishAvailability {
  const adapter = resolve(url);
  if (adapter === null) return { kind: 'unavailable', reason: 'no_adapter' };

  if (!adapter.isNewListingForm(document)) {
    return { kind: 'unavailable', reason: 'not_new_listing_form' };
  }

  return { kind: 'available', adapter };
}

/** Черновик и всё, что сервер сообщает вместе с ним. */
export interface DraftResponse {
  publicationId: string;
  draft: ListingPublishDraft;
  manualOnly: string[];
}

export interface PublishDeps {
  /** Просит сервер собрать черновик. Единственный источник данных для формы. */
  requestDraft(propertyId: string, targetSource: string): Promise<DraftResponse>;
  /** Отчёт о заполнении. Он же — сигнал метрики `fill failure rate`. */
  reportFilled(publicationId: string, result: FillResult): Promise<void>;
  resolveAdapter?: (url: string) => ListingPublishAdapter | null;
}

export type FillFlowResult =
  | { kind: 'unavailable'; reason: Unavailable }
  | {
      kind: 'filled';
      publicationId: string;
      result: FillResult;
      snapshot: FormSnapshot;
      publisher: ListingPublishDraft['publisher'];
      /** Поля, которые агент заполняет руками. Названы сервером заранее. */
      manualOnly: string[];
    }
  | { kind: 'failed'; error: 'network' | 'session' | 'unknown' };

/**
 * Полный путь заполнения.
 *
 * ЧЕРНОВИК ПРИХОДИТ С СЕРВЕРА, а не собирается здесь. Это и есть способ
 * обеспечить правило 13: расширение физически не получает контактов
 * собственника, поэтому не может их вписать даже по ошибке.
 */
export async function runFill(
  deps: PublishDeps,
  document: Document,
  url: string,
  propertyId: string,
): Promise<FillFlowResult> {
  const availability = publishAvailability(document, url, deps.resolveAdapter ?? publishAdapterFor);
  if (availability.kind === 'unavailable') return availability;

  const { adapter } = availability;

  try {
    const { publicationId, draft, manualOnly } = await deps.requestDraft(
      propertyId,
      adapter.sourceId,
    );

    const { result, snapshot } = adapter.fill(document, draft);

    // Отчёт уходит и при полном успехе, и при частичном заполнении: без него
    // о смене вёрстки формы мы узнаем от агента, а не из метрики (§6.5).
    await deps.reportFilled(publicationId, result);

    return {
      kind: 'filled',
      publicationId,
      result,
      snapshot,
      publisher: draft.publisher,
      manualOnly,
    };
  } catch (error) {
    return { kind: 'failed', error: classify(error) };
  }
}

export interface ClearOutcome {
  restored: string[];
  /**
   * Поля, которые агент правил уже после заполнения.
   *
   * По умолчанию они не откатываются: там его работа, а не наша подстановка.
   * §6А.6 требует предупредить об этом до отката, а не молча стереть.
   */
  editedByAgent: string[];
}

/**
 * «Очистить форму» (§6А.6).
 *
 * Возвращаются только поля из снимка — те, что трогали мы. Поля, заполненные
 * агентом вручную, не трогаются: «очистить» отменяет наше действие, а не
 * чужую работу.
 */
export function runClear(snapshot: FormSnapshot, includeEdited = false): ClearOutcome {
  return restoreSnapshot(snapshot, { includeEdited });
}

function classify(error: unknown): 'network' | 'session' | 'unknown' {
  if (error instanceof Error && error.name === 'UnauthenticatedError') return 'session';
  if (error instanceof TypeError) return 'network';
  return 'unknown';
}
