import { listFollowUps } from '@cleekto/core';

import { handle, requireAuth } from '../../_lib/handler';

export const dynamic = 'force-dynamic';

/**
 * Объявления с наступившей датой перезвона.
 *
 * Объекта у них ещё нет: агент договорился перезвонить, а не получил
 * согласие. Поэтому список строится по состоянию объявления, а не по воронке
 * (инвариант 10).
 */
export async function GET(request: Request) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    return listFollowUps(ctx);
  });
}
