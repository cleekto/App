import { z } from 'zod';

import { createPublicationDraft, listPublications } from '@cleekto/core';

import { handle, parseBody, requireAuth } from '../../../../_lib/handler';

export const dynamic = 'force-dynamic';

const createSchema = z
  .object({
    targetSource: z.enum(['SS_GE', 'MYHOME_GE']),
    /** Не указан — берётся профиль по умолчанию, без диалога (P4). */
    publishProfileId: z.string().uuid().nullable().optional(),
  })
  .strict();

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    return listPublications(ctx, id);
  });
}

/**
 * POST /api/v1/properties/:id/publications — черновик публикации.
 *
 * Черновик собирается на сервере по белому списку полей. Расширение
 * не получает контактов собственника, потому что их нет в ответе, —
 * это и есть способ обеспечить правило 13.
 */
export async function POST(request: Request, { params }: Params) {
  return handle(
    async () => {
      const ctx = await requireAuth(request);
      const { id } = await params;
      const body = await parseBody(request, createSchema);
      return createPublicationDraft(ctx, id, body);
    },
    { status: 201 },
  );
}
