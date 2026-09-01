import type { ExtractionResult, SourceId } from '@cleekto/contracts';

/**
 * Общий интерфейс адаптера чтения (промпт §6.3).
 *
 * Ни строчки логики, привязанной к конкретному сайту, вне адаптера
 * (инвариант 6). Ядро об ss.ge и myhome.ge не знает ничего.
 */
export interface ListingSourceAdapter {
  readonly sourceId: SourceId;

  /**
   * Версия чтения. ОТДЕЛЬНАЯ от `formVersion`: разметка страницы объявления
   * и форма размещения ломаются независимо друг от друга (I9).
   *
   * Увеличивается при любой правке селекторов — по ней в метрике видно,
   * какая версия перестала читать площадку.
   */
  readonly parserVersion: string;

  canHandle(url: string): boolean;

  /**
   * Раскрыт ли телефон на странице.
   *
   * ЧАСТЬ ИНТЕРФЕЙСА, А НЕ ДЕТАЛЬ РЕАЛИЗАЦИИ (правило 11, промпт §6.3).
   * Так требование нельзя потерять при добавлении третьего источника.
   * Реализация, всегда возвращающая `true`, — это провал ревью.
   */
  isPhoneRevealed(document: Document): boolean;

  extract(document: Document, url: string): ExtractionResult;
}

/** Поля, отсутствие которых попадает в `missingFields`. */
export const TRACKED_FIELDS = [
  'externalId',
  'title',
  'propertyType',
  'transactionType',
  'price',
  'currency',
  'area',
  'rooms',
  'bedrooms',
  'floor',
  'totalFloors',
  'district',
  'address',
  'description',
  'photos',
  'ownerPhone',
] as const;

export type TrackedField = (typeof TRACKED_FIELDS)[number];
