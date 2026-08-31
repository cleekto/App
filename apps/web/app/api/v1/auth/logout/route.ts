import { z } from 'zod';

import { logout } from '@cleekto/core';

import { handle, parseBody } from '../../../_lib/handler';

const schema = z.object({ refreshToken: z.string().min(1) });

export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseBody(request, schema);
    await logout(body.refreshToken);
    return { ok: true };
  });
}
