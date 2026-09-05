import { unreadCounts } from '@kleekto/core';

import { handle, requireAuth } from '../../../_lib/handler';

export const dynamic = 'force-dynamic';

/**
 * Сколько непрочитанного у текущего человека.
 *
 * Отдельный маршрут нужен потому, что значок обязан обновляться, пока агент
 * работает, а оболочка приложения между переходами не перерисовывается:
 * посчитанное при загрузке число застыло бы до следующей полной загрузки
 * страницы. Проверено на живой сборке — именно так и было.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    return unreadCounts(ctx);
  });
}
