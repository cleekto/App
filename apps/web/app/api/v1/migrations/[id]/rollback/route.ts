import { rollbackMigration } from '@kleekto/core';

import { handle, requireAuth } from '../../../../_lib/handler';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * Отмена импорта целиком одной операцией (L9).
 *
 * Без неё агентство, заметившее ошибку сопоставления на четырёхсотой строке,
 * не имеет пути назад — и первая миграция становится последним, что оно нам
 * доверит.
 */
export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    return rollbackMigration(ctx, id);
  });
}
