import { z } from 'zod';

import { formatDateTime, type Locale } from '@kleekto/i18n';

import { chatVersion, listChatMessages, postChatMessage } from '@kleekto/core';

import { handle, parseBody, requireAuth } from '../../../../../_lib/handler';

export const dynamic = 'force-dynamic';

const postSchema = z
  .object({
    body: z.string().min(1).max(4000),
    /** На какое сообщение это ответ. Принадлежность проверяет ядро. */
    replyToId: z.string().uuid().optional(),
  })
  .strict();

/**
 * Тема берётся из АДРЕСА, а не из тела, — и это исправление настоящей ошибки.
 *
 * Первая версия читала тему из тела при отправке и из адреса при чтении.
 * Клиент присылал её только в адресе, и сообщение уходило мимо темы,
 * в общую ленту комнаты. Найдено проверкой в браузере: написал в тему,
 * счётчик темы не изменился.
 *
 * Теперь источник один на оба обработчика.
 */
function topicFrom(request: Request): string | undefined {
  return new URL(request.url).searchParams.get('topic') ?? undefined;
}

type Params = { params: Promise<{ id: string }> };

/**
 * Лента переписки — с дешёвым ответом «изменений нет».
 *
 * Браузер присылает отпечаток, который у него уже есть (`?since=`). Совпал —
 * сервер отвечает `304` без тела, и это самый частый ответ: чат опрашивается
 * каждые несколько секунд, а меняется он редко. Не совпал — уходит лента
 * целиком вместе с новым отпечатком.
 *
 * Отдавать «только новые сообщения» было бы заманчиво, но неверно: правка
 * и удаление старого сообщения новых не создают, и до собеседника они
 * бы не доехали.
 */
export async function GET(request: Request, { params }: Params) {
  const ctx = await requireAuth(request);
  const { id } = await params;

  const since = new URL(request.url).searchParams.get('since');
  const topicId = topicFrom(request);
  const target = { roomId: id, ...(topicId === undefined ? {} : { topicId }) };

  const version = await chatVersion(ctx, target);

  if (since !== null && since === version) {
    // 204, а не 304. `304` валиден только как ответ на УСЛОВНЫЙ запрос
    // (`If-None-Match`), и на обычный `fetch` браузер обрывает его как
    // ошибку протокола — проверено в живом браузере: `net::ERR_ABORTED`.
    // `204` — обычный успешный ответ без тела, ровно то, что нужно.
    return new Response(null, { status: 204 });
  }

  const raw = await listChatMessages(ctx, target);
  /*
   * Подпись времени считается ЗДЕСЬ, на сервере.
   *
   * Клиентскому компоненту звать `Intl` в этом проекте запрещено: у браузера
   * агента может не быть данных грузинской локали, и формат разошёлся бы
   * с серверным. Передать ему функцию форматирования тоже нельзя — сервер
   * не передаёт функции клиенту. Значит, лента уезжает уже с готовой строкой.
   */
  const messages = raw.map((message) => ({
    ...message,
    timeLabel: formatDateTime(ctx.locale as Locale, new Date(message.createdAt)),
  }));

  return Response.json({ version, messages });
}

export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const ctx = await requireAuth(request);
    const { id } = await params;
    const payload = await parseBody(request, postSchema);
    const topicId = topicFrom(request);

    return postChatMessage(
      ctx,
      { roomId: id, ...(topicId === undefined ? {} : { topicId }) },
      payload.body,
      payload.replyToId === undefined ? {} : { replyToId: payload.replyToId },
    );
  });
}
