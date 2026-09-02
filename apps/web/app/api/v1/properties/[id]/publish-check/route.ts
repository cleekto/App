import { ValidationError, publishCheck } from '@kleekto/core';

import { handle, requireAuth } from '../../../../_lib/handler';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * Предупреждение «объект уже размещён» ДО заполнения формы (I22, P9).
 * Область проверки — компания, не команда: разместить могла соседняя команда.
 */
export async function GET(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;

    const source = new URL(request.url).searchParams.get('source');
    if (source !== 'SS_GE' && source !== 'MYHOME_GE') {
      throw new ValidationError('Параметр source обязателен', { fields: ['source'] });
    }

    return publishCheck(ctx, id, source);
  });
}
