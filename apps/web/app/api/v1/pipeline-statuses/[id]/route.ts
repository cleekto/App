import { z } from 'zod';

import { deletePipelineStatus, updatePipelineStatus } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../../_lib/handler';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * Имена по языкам. Передаются только те, что менялись.
 *
 * Пустая строка разрешена намеренно: она означает «перевода на этот язык
 * нет», и стадия вернётся к запасному имени. Запрещать её значило бы
 * заставлять агентство придумывать перевод там, где оно на этом языке
 * не работает.
 */
const updateSchema = z
  .object({
    names: z
      .object({
        ka: z.string().max(60).optional(),
        en: z.string().max(60).optional(),
        ru: z.string().max(60).optional(),
      })
      .strict()
      .optional(),
    colorToken: z.string().max(40).nullable().optional(),
  })
  .strict();

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    const body = await parseBody(request, updateSchema);
    return updatePipelineStatus(ctx, id, body);
  });
}

/**
 * Удаление стадии.
 *
 * Куда переносить объекты — в строке запроса, а не в теле: у DELETE тела
 * может не быть, и не всякий посредник его донесёт.
 */
export async function DELETE(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;

    const raw = new URL(request.url).searchParams.get('moveTo');

    // Параметра нет — стадия должна быть пуста, и сценарий это проверит.
    // Параметр есть, но не идентификатор — это ошибка запроса, и молча
    // сводить её к «переносить некуда» нельзя: сообщение было бы про другое.
    const moveToStatusId =
      raw === null ? undefined : z.string().uuid('Неверный идентификатор стадии').parse(raw);

    return deletePipelineStatus(ctx, id, { moveToStatusId });
  });
}
