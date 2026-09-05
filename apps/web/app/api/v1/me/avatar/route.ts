import { z } from 'zod';

import { setOwnAvatar } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../../_lib/handler';

export const dynamic = 'force-dynamic';

/**
 * Своя аватарка.
 *
 * Только своя: `userId` берётся из сессии, в теле его нет и быть не может
 * (правило 5). Поставить фотографию коллеге нельзя — это не то же самое,
 * что править его карточку.
 *
 * `null` убирает фотографию: снова рисуются инициалы.
 */
const schema = z.object({ avatarKey: z.string().min(1).max(400).nullable() }).strict();

export async function PUT(request: Request) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const body = await parseBody(request, schema);
    return setOwnAvatar(ctx, body.avatarKey);
  });
}
