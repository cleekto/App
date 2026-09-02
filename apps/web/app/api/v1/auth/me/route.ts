import { currentUser } from '@kleekto/core';

import { handle, requireAuth } from '../../../_lib/handler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/auth/me — профиль, роль, команда, компания.
 *
 * Единственный источник роли для интерфейса. Сервер по нему ничего не решает:
 * у него есть контекст (правило 6).
 */
export async function GET(request: Request) {
  return handle(async () => currentUser(await requireAuth(request)));
}
