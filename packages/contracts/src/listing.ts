import { z } from 'zod';

/**
 * Нормализованное извлечение объявления.
 *
 * Общая форма для адаптера и для API: адаптер её производит, сервер принимает.
 * Живёт в контрактах, а не в ядре, потому что адаптеры о ядре не знают
 * (инвариант 6, ADR-0001).
 */

export const sourceSchema = z.enum(['SS_GE', 'MYHOME_GE']);
export type SourceId = z.infer<typeof sourceSchema>;

export const listingImportPayloadSchema = z.object({
  source: sourceSchema,
  sourceUrl: z.string().url(),
  externalId: z.string().min(1).nullable(),

  title: z.string().nullable(),
  propertyType: z.enum(['APARTMENT', 'HOUSE', 'LAND', 'COMMERCIAL']).nullable(),
  transactionType: z.enum(['SALE', 'RENT']).nullable(),

  price: z.number().positive().nullable(),
  currency: z.string().length(3).nullable(),

  area: z.number().positive().nullable(),
  rooms: z.number().int().nonnegative().nullable(),
  bedrooms: z.number().int().nonnegative().nullable(),
  floor: z.number().int().nullable(),
  totalFloors: z.number().int().positive().nullable(),

  district: z.string().nullable(),
  address: z.string().nullable(),
  description: z.string().nullable(),
  photos: z.array(z.string()),

  owner: z.object({
    name: z.string().nullable(),
    /** Все найденные номера собственника. Пустой массив — телефона нет. */
    phones: z.array(z.string()),
  }),
});

export type ListingImportPayload = z.infer<typeof listingImportPayloadSchema>;

/**
 * Результат работы адаптера чтения.
 *
 * `missingFields` заполняется ВСЕГДА, когда поле не удалось прочитать —
 * честно, а не молча (требование D9). Придуманных значений не бывает:
 * поле, которого нет, остаётся `null` и попадает в этот список.
 */
export interface ExtractionResult {
  payload: ListingImportPayload;
  missingFields: string[];
  parserVersion: string;
}
