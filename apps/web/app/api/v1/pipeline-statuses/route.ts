import { listPipelineStatuses } from '@cleekto/core';

import { handle, requireAuth } from '../../_lib/handler';

export const dynamic = 'force-dynamic';

/** Инвариант 4: статусы читаются из базы, а не из константы в коде. */
export async function GET(request: Request) {
  return handle(async () => listPipelineStatuses(await requireAuth(request)));
}
