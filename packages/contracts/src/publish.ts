import { z } from 'zod';

import { sourceSchema } from './listing';

/**
 * Публикация: черновик и отчёт о заполнении формы.
 *
 * Тип живёт здесь, а не в ядре, по той же причине, что и извлечение объявления:
 * его нужен и серверу, который черновик собирает, и адаптеру заполнения,
 * которому ядро импортировать запрещено (инвариант 6).
 */

/**
 * Черновик публикации — БЕЛЫЙ СПИСОК ПОЛЕЙ (§6А.4, правило 13).
 *
 * БЛОКА `owner` В ЭТОМ ТИПЕ НЕТ И НЕ ПОЯВИТСЯ. Не «опционально», не «пустой» —
 * его нет в схеме. Чтобы контакт собственника попал на площадку, придётся
 * дописать поле, а не забыть проверку. Разница принципиальная: забыть
 * проверку можно случайно, дописать поле — только намеренно.
 *
 * Черновик собирается НА СЕРВЕРЕ. Расширение не получает данных, которые
 * могло бы вписать в форму, — это и есть способ обеспечить правило 13,
 * а не полагаться на дисциплину клиента.
 */
export const listingPublishDraftSchema = z.object({
  propertyId: z.string().uuid(),
  targetSource: sourceSchema,

  propertyType: z.enum(['APARTMENT', 'HOUSE', 'LAND', 'COMMERCIAL']).nullable(),
  transactionType: z.enum(['SALE', 'RENT']).nullable(),

  price: z.number().nullable(),
  currency: z.string().nullable(),

  area: z.number().nullable(),
  rooms: z.number().nullable(),
  floor: z.number().nullable(),
  totalFloors: z.number().nullable(),

  district: z.string().nullable(),
  address: z.string().nullable(),

  /** Очищено от телефонов и имени собственника. */
  publicDescription: z.string().nullable(),

  /** Контакт ПУБЛИКАТОРА — лицо агентства в объявлении. Никогда не собственник. */
  publisher: z.object({
    displayName: z.string(),
    phone: z.string(),
  }),
});

export type ListingPublishDraft = z.infer<typeof listingPublishDraftSchema>;

/**
 * Почему поле осталось пустым.
 *
 * Причина обязательна и различима: «нет значения в CRM» и «нет соответствия
 * в словаре площадки» — разные проблемы с разной ценой. Первая решается
 * заполнением карточки объекта, вторая означает, что словарь адаптера отстал
 * от площадки, и это уже наша поломка.
 */
export const unfilledReasonSchema = z.enum([
  /** В CRM этого значения нет. */
  'no_value',
  /** Значение есть, но соответствия в словаре площадки нет. */
  'no_mapping',
  /** Поле на форме не найдено — вероятно, площадка сменила разметку. */
  'field_not_found',
  /** Поле требует ручного действия: карта, загрузка файлов, автодополнение. */
  'manual_only',
]);

export type UnfilledReason = z.infer<typeof unfilledReasonSchema>;

export const unfilledFieldSchema = z.object({
  field: z.string(),
  reason: unfilledReasonSchema,
});

export type UnfilledField = z.infer<typeof unfilledFieldSchema>;

/**
 * Результат заполнения.
 *
 * `snapshotId` указывает на снимок состояния формы ДО заполнения. Снимок живёт
 * в расширении, а не на сервере: он про конкретную вкладку конкретного агента
 * и умирает вместе с ней.
 */
export const fillResultSchema = z.object({
  snapshotId: z.string(),
  formVersion: z.string(),
  filled: z.array(z.string()),
  unfilled: z.array(unfilledFieldSchema),
});

export type FillResult = z.infer<typeof fillResultSchema>;

/** Распознанное созданное объявление (§6А.7). Подтверждает публикацию человек. */
export interface PublishedRef {
  externalId: string | null;
  externalUrl: string;
}
