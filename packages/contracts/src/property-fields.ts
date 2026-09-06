import { z } from 'zod';

/**
 * Поля объекта, которые заполняет человек.
 *
 * ОДИН СПИСОК НА ТРИ МЕСТА: заведение вручную, правка карточки и разбор
 * объявления. Пока списков было три, они расходились: характеристика
 * появлялась в импорте и не появлялась в форме — и агент не мог дописать
 * то, чего площадка не отдала.
 *
 * СОСТАВ ПОВТОРЯЕТ ФОРМЫ РАЗМЕЩЕНИЯ ss.ge И myhome.ge (решение владельца
 * 2026-09-06). Объект, заведённый руками, обязан годиться для публикации
 * без дозаполнения: иначе агент вводит данные дважды — сначала в CRM,
 * потом на площадке.
 *
 * Все поля необязательные, включая те, что кажутся обязательными. Частичное
 * заполнение — штатный режим (правило 14): объявление без кадастрового кода
 * это норма, а не сбой.
 */
export const propertyFactsShape = {
  rooms: z.number().int().min(0).max(50).nullable().optional(),
  /** Спален. Отдельно от комнат: площадки спрашивают и то, и другое. */
  bedrooms: z.number().int().min(0).max(50).nullable().optional(),
  areaTotal: z.number().positive().max(100_000).nullable().optional(),
  floor: z.number().int().min(-5).max(200).nullable().optional(),
  totalFloors: z.number().int().min(0).max(200).nullable().optional(),

  /** Санузел строкой: площадки пишут туда и «2», и «общий». */
  bathrooms: z.string().max(100).nullable().optional(),
  balconies: z.number().int().min(0).max(50).nullable().optional(),
  balconyArea: z.number().positive().max(10_000).nullable().optional(),
  /** Площадь дома и двора — для частных домов; у квартир пусты. */
  houseArea: z.number().positive().max(100_000).nullable().optional(),
  yardArea: z.number().positive().max(1_000_000).nullable().optional(),

  /** Состояние ремонта: «с новым ремонтом», «белый каркас». */
  condition: z.string().max(200).nullable().optional(),
  /** Статус здания: «новостройка», «старая постройка». */
  buildingStatus: z.string().max(200).nullable().optional(),
  /** Проект: «итальянский двор», «хрущёвка». */
  projectType: z.string().max(200).nullable().optional(),
  /** Кадастровый код — единственный внешний идентификатор объекта. */
  cadastralCode: z.string().max(100).nullable().optional(),
  /**
   * Кто подаёт: собственник или агентство. Знать до звонка, что говорить
   * придётся с посредником, — половина разговора.
   */
  sellerKind: z.enum(['owner', 'agency']).nullable().optional(),

  district: z.string().max(200).nullable().optional(),
  addressRaw: z.string().max(500).nullable().optional(),
  price: z.number().nonnegative().max(1_000_000_000).nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
} as const;

/** Вид сделки и тип недвижимости. На заведении обязательны, при правке — нет. */
export const propertyKindShape = {
  transactionType: z.enum(['SALE', 'RENT']),
  propertyType: z.enum(['APARTMENT', 'HOUSE', 'LAND', 'COMMERCIAL']),
} as const;

/** Разобранные значения фактов — то, что уходит в сценарий. */
export type PropertyFacts = z.infer<z.ZodObject<typeof propertyFactsShape>>;

/**
 * Имена полей списком — для показа и для тестов.
 *
 * Выведены из самой схемы, а не выписаны рядом: второй список разошёлся бы
 * с первым при первом же добавленном поле.
 */
export const PROPERTY_FACT_FIELDS = Object.keys(propertyFactsShape) as Array<
  keyof typeof propertyFactsShape
>;
