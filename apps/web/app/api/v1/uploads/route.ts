import { z } from 'zod';

import { createUploadUrl } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../_lib/handler';

export const dynamic = 'force-dynamic';

/**
 * Ссылка для загрузки файла прямо в хранилище.
 *
 * Файл через этот маршрут НЕ ИДЁТ: он уходит в хранилище напрямую по
 * подписанной ссылке. Пропускать его через функцию значило бы упереться
 * в предел размера тела запроса — фотография с телефона легко больше, —
 * и платить за время функции, потраченное на перекладывание байтов.
 *
 * Ключ файла собирает сервер: имя, пришедшее снаружи, — это адрес записи,
 * и доверять ему нельзя.
 */
const schema = z
  .object({
    kind: z.enum(['avatar', 'property', 'chat']),
    contentType: z.string().min(1).max(100),
    sizeBytes: z.number().int().positive(),
  })
  .strict();

export async function POST(request: Request) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const body = await parseBody(request, schema);
    return createUploadUrl(ctx, body);
  });
}
