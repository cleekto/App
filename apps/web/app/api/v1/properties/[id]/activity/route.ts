import { propertyActivity } from '@cleekto/core';

import { handle, requireAuth } from '../../../../_lib/handler';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** Лента активности объекта: смены статуса, задачи, комментарии (DESIGN §19). */
export async function GET(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    return propertyActivity(ctx, id);
  });
}
