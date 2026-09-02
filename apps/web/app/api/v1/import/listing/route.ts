import { z } from 'zod';

import { importListing } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../../_lib/handler';

export const dynamic = 'force-dynamic';

/**
 * Схема входа. Строгая: `.strict()` отвергает незнакомые поля вместо того,
 * чтобы молча их проглотить.
 *
 * ПОЛЕЙ companyId, teamId И assignedUserId ЗДЕСЬ НЕТ И НЕ БУДЕТ.
 * Они берутся из сессии (правило 5). Появление любого из них — дефект,
 * и это проверяется отдельным тестом, читающим исходники маршрутов.
 */
const importSchema = z
  .object({
    source: z.enum(['SS_GE', 'MYHOME_GE']),
    sourceUrl: z.string().url(),
    externalId: z.string().min(1).nullable().optional(),

    title: z.string().nullable().optional(),
    propertyType: z.enum(['APARTMENT', 'HOUSE', 'LAND', 'COMMERCIAL']).nullable().optional(),
    transactionType: z.enum(['SALE', 'RENT']).nullable().optional(),

    price: z.number().positive().nullable().optional(),
    currency: z.string().length(3).nullable().optional(),

    area: z.number().positive().nullable().optional(),
    rooms: z.number().int().nonnegative().nullable().optional(),
    floor: z.number().int().nullable().optional(),
    totalFloors: z.number().int().positive().nullable().optional(),

    district: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    photos: z.array(z.string().url()).optional(),

    owner: z.object({
      name: z.string().nullable().optional(),
      // Обязателен. Правило 11: без раскрытого номера расширение
      // запрос не отправляет, сервер — вторая линия.
      phone: z.string().min(1),
    }),

    parserVersion: z.string().min(1),
    missingFields: z.array(z.string()).optional(),

    /**
     * Результат разговора. ГЛАВНАЯ РАЗВИЛКА ПРОДУКТА: объект создаётся только
     * при `consent`, остальные три помечают объявление (правило R14).
     */
    outcome: z.enum(['consent', 'refused', 'no_answer', 'callback']),
    callbackAt: z.string().datetime().nullable().optional(),
    doNotCallCompanyWide: z.boolean().optional(),
    note: z.string().nullable().optional(),

    acknowledgedDuplicateOf: z.array(z.string().uuid()).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.outcome !== 'callback' || (value.callbackAt !== null && value.callbackAt !== undefined),
    {
      message: 'Для исхода «перезвонить» нужна дата',
      path: ['callbackAt'],
    },
  );

/**
 * POST /api/v1/import/listing
 *
 * Единый эндпоинт: расширение всегда шлёт одно и то же извлечение плюс выбор
 * агента. Разделять импорт и отметку состояния на два маршрута значило бы
 * заставить расширение решать, куда отправлять, — а это решение принимает
 * агент пунктом меню.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const body = await parseBody(request, importSchema);
    return importListing(ctx, body);
  });
}
