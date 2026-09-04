import { z } from 'zod';

import { reportPublicationFilled } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../../../_lib/handler';

export const dynamic = 'force-dynamic';

const schema = z
  .object({
    formVersion: z.string().min(1),
    filled: z.array(z.string()),
    unfilled: z.array(
      z.object({
        field: z.string(),
        reason: z.enum(['no_value', 'no_mapping', 'field_not_found', 'manual_only']),
      }),
    ),
    /**
     * Поля, в которых уже что-то было до заполнения. Только имена, без
     * значений: в них данные другого объекта.
     *
     * Схема строгая — забыть здесь поле значит уронить весь отчёт целиком,
     * а не потерять одну строку.
     */
    prefilled: z
      .array(
        z.object({
          field: z.string(),
          outcome: z.enum(['overwritten', 'kept']),
        }),
      )
      .optional(),
    /** Снимок формы до заполнения — для «Очистить». Хранит расширение. */
    snapshotId: z.string().optional(),
  })
  .strict();

type Params = { params: Promise<{ id: string }> };

/**
 * Отчёт о заполнении формы.
 *
 * ЗДЕСЬ объект переходит в «Принято в работу», а не при подтверждении (J13):
 * расширение не знает, нажал ли агент «Опубликовать» (инвариант 13).
 */
export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    const body = await parseBody(request, schema);
    return reportPublicationFilled(ctx, id, body);
  });
}
