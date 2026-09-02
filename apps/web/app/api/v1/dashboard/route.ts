import { dashboard } from '@kleekto/core';

import { handle, requireAuth } from '../../_lib/handler';

export const dynamic = 'force-dynamic';

/**
 * Дашборд.
 *
 * Область не параметр: её задаёт роль. Администратор видит компанию,
 * менеджер и агент — свою команду. Показатель, область которого выбирает
 * клиент, — это утечка, оформленная как удобство.
 */
export async function GET(request: Request) {
  return handle(async () => dashboard(await requireAuth(request)));
}
