import { z } from 'zod';

import { login } from '@cleekto/core';

import { handle, parseBody } from '../../../_lib/handler';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  /** Нужен, только если адрес заведён в нескольких компаниях. */
  companyId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseBody(request, schema);
    return login(body);
  });
}
