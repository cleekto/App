import { z } from 'zod';

import { changeLocale } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../../_lib/handler';
import { setSessionCookies } from '../../../_lib/session-cookies';

export const dynamic = 'force-dynamic';

const schema = z.object({ locale: z.enum(['ka', 'en', 'ru']) }).strict();

/**
 * POST /api/v1/auth/locale — сменить язык интерфейса.
 *
 * Возвращает новую пару токенов и кладёт её в cookie. Перевыпуск обязателен:
 * язык лежит в подписанном access-токене, и без него интерфейс остался бы
 * на прежнем языке до пятнадцати минут после нажатия — человек решил бы,
 * что переключатель сломан.
 */
export async function POST(request: Request) {
  return handle(
    async () => {
      const ctx = await requireAuth(request);
      const body = await parseBody(request, schema);
      return changeLocale(ctx, body.locale);
    },
    { onResponse: (response, tokens) => setSessionCookies(response, tokens) },
  );
}
