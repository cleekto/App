import { previewMigration } from '@cleekto/core';

import { handle, requireAuth } from '../../../../_lib/handler';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * Предпросмотр до записи. В ответе есть поле written: false —
 * агентство должно видеть прямо, что в базе ещё ничего нет.
 */
export async function GET(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    return previewMigration(ctx, id);
  });
}
