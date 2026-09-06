import { z } from 'zod';

import { harvestSearchResults } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../../_lib/handler';

export const dynamic = 'force-dynamic';

/**
 * Сколько карточек принимаем за раз.
 *
 * Страница выдачи показывает десятки; сотня — это уже не «то, что агент
 * увидел», а чей-то самодельный обход. Ограничение стоит на входе, чтобы
 * такой запрос отклонялся до базы, а не нагружал её.
 */
const MAX_CARDS = 100;

/**
 * Схема входа. Строгая: незнакомые поля отвергаются, а не проглатываются.
 *
 * ПОЛЕЙ companyId, teamId И userId ЗДЕСЬ НЕТ И НЕ БУДЕТ — они из сессии
 * (правило 5).
 *
 * ПОЛЯ «ТЕЛЕФОН» ЗДЕСЬ ТОЖЕ НЕТ, И ЭТО ГЛАВНОЕ. В выдаче площадка номера
 * не показывает, а на странице объявления он лежит в данных ещё до нажатия
 * «показать номер». Приняв здесь телефон, мы получили бы базу номеров
 * собственников без единого разговора — ровно то, что запрещает правило 11.
 * Номер приходит только маршрутом импорта, после того как агент раскрыл его
 * сам, и схема — вторая линия этой защиты после расширения.
 */
const cardSchema = z
  .object({
    externalId: z.string().min(1).max(64),
    url: z.string().url(),

    price: z.number().positive().nullable().optional(),
    currency: z.string().length(3).nullable().optional(),
    area: z.number().positive().nullable().optional(),
    rooms: z.number().int().nonnegative().nullable().optional(),
    floor: z.number().int().nullable().optional(),
    totalFloors: z.number().int().positive().nullable().optional(),
    district: z.string().max(200).nullable().optional(),

    propertyType: z
      .enum(['APARTMENT', 'HOUSE', 'LAND', 'COMMERCIAL', 'COUNTRY_HOUSE', 'HOTEL'])
      .nullable()
      .optional(),
    transactionType: z.enum(['SALE', 'RENT', 'PLEDGE', 'DAILY_RENT']).nullable().optional(),

    thumbnailUrl: z.string().url().nullable().optional(),

    sellerExternalId: z.string().min(1).max(64).nullable().optional(),
    sellerName: z.string().max(200).nullable().optional(),
    sellerKind: z.enum(['owner', 'agency']).nullable().optional(),
  })
  .strict();

const batchSchema = z
  .object({
    source: z.enum(['SS_GE', 'MYHOME_GE']),
    cards: z.array(cardSchema).max(MAX_CARDS),
  })
  .strict();

/**
 * POST /api/v1/observations/batch
 *
 * Приём объявлений, которые агент увидел на странице выдачи. Ничего не
 * создаёт в воронке: объект появляется только по «Согласен» (правило 0),
 * а этот маршрут наполняет общий справочный индекс (инвариант 17).
 */
export async function POST(request: Request) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const body = await parseBody(request, batchSchema);
    return harvestSearchResults(ctx, body.source, body.cards);
  });
}
