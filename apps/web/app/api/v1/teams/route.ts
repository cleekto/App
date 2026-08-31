import { z } from 'zod';

import { createTeam, listTeams } from '@cleekto/core';

import { handle, parseBody, requireAuth } from '../../_lib/handler';

export const dynamic = 'force-dynamic';

const createSchema = z.object({ name: z.string().min(1) });

export async function GET(request: Request) {
  return handle(async () => listTeams(await requireAuth(request)));
}

export async function POST(request: Request) {
  return handle(
    async () => {
      const ctx = await requireAuth(request);
      const body = await parseBody(request, createSchema);
      return createTeam(ctx, body.name);
    },
    { status: 201 },
  );
}
