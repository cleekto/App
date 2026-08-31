import { applyMigration } from '@cleekto/core';

import { handle, requireAuth } from '../../../../_lib/handler';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    return applyMigration(ctx, id);
  });
}
