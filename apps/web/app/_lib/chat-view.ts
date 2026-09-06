import { fileUrls, type ChatMessageView } from '@kleekto/core';
import { formatDateTime, type Locale } from '@kleekto/i18n';
import type { AuthContext } from '@kleekto/core';

/**
 * Сообщение, готовое к показу: со ссылками и с готовой подписью времени.
 *
 * ОДНА ПОДГОТОВКА НА ЧЕТЫРЕ МЕСТА — страница комнаты, страница переписки
 * и два маршрута живого опроса. Пока каждое готовило ленту само, они
 * разъезжались: страница отрисовывала аватарки подписанными, а первый же
 * тик опроса заменял ленту ответом без ссылок, и лица исчезали через три
 * секунды. Вложения повторили бы это в точности.
 *
 * ПОДПИСЬ ВРЕМЕНИ СЧИТАЕТСЯ ЗДЕСЬ, НА СЕРВЕРЕ. Клиентскому компоненту звать
 * `Intl` в этом проекте запрещено: у браузера агента может не быть данных
 * грузинской локали, и формат разошёлся бы с серверным. Передать функцию
 * форматирования тоже нельзя — сервер не передаёт клиенту функции.
 */

export interface ChatMessageForView extends Omit<ChatMessageView, 'attachments'> {
  timeLabel: string;
  authorAvatarUrl: string | null;
  attachments: Array<{
    id: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    /** Подписанная ссылка. Живёт час — потому и подписывается на каждый показ. */
    url: string | null;
  }>;
}

/**
 * Подписывает всё, что показывается ссылкой, и проставляет время.
 *
 * Ключи подписываются по УНИКАЛЬНЫМ значениям: один человек пишет подряд,
 * и десять одинаковых подписей на десять его реплик — работа впустую.
 * Подпись дешёвая (это HMAC без обращения к сети), но не бесплатная.
 */
export async function forView<T extends ChatMessageView>(
  ctx: AuthContext,
  locale: Locale,
  messages: readonly T[],
): Promise<Array<Omit<T, 'attachments'> & ChatMessageForView>> {
  const keys = [
    ...new Set([
      ...messages.map((message) => message.authorAvatarKey).filter((key) => key !== null),
      ...messages.flatMap((message) => message.attachments.map((file) => file.key)),
    ]),
  ];

  const urls = await fileUrls(ctx, keys);
  const urlOf = new Map(keys.map((key, index) => [key, urls[index] ?? null]));

  return messages.map((message) => ({
    ...message,
    timeLabel: formatDateTime(locale, new Date(message.createdAt)),
    authorAvatarUrl:
      message.authorAvatarKey === null ? null : (urlOf.get(message.authorAvatarKey) ?? null),
    attachments: message.attachments.map((file) => ({
      id: file.id,
      fileName: file.fileName,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
      url: urlOf.get(file.key) ?? null,
    })),
  }));
}
