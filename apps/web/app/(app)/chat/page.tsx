import Link from 'next/link';

import {
  chatVersion,
  companyFeed,
  fileUrls,
  listChatMessages,
  listChatRooms,
  listChatTopics,
  markChatRead,
  permissionScope,
} from '@kleekto/core';
import { formatDateTime, translate } from '@kleekto/i18n';

import { contextLocale, requireContext } from '../../_lib/session';
import { stageColors } from '../../_ui/accent';
import { Card, EmptyState } from '../../_ui/primitives';
import { RoomUnread } from '../unread';
import { CompanyFeed } from './company-feed';
import { Conversation } from './conversation';
import { TopicBar } from './topic-bar';
import { NewRoom } from './new-room';

/**
 * Чат компании.
 *
 * КОМНАТЫ ОТКРЫТЫ ВСЕЙ КОМПАНИИ — решение владельца. Закрытых нет, поэтому
 * и списка участников нет: видит каждый, пишет каждый, заводит комнату
 * менеджер или администратор.
 *
 * Выбранная комната живёт в адресе, а не в состоянии браузера: ссылкой
 * на обсуждение можно поделиться, и она переживает перезагрузку.
 */
export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireContext();
  const locale = contextLocale(ctx);
  const params = await searchParams;

  const t = (key: Parameters<typeof translate>[1]): string => translate(locale, key);

  const rooms = await listChatRooms(ctx);

  /*
   * НЕ ЗАШЁЛ В КОМНАТУ — ЗНАЧИТ, В ОБЩЕЙ ЛЕНТЕ (решение владельца).
   *
   * Раньше по умолчанию открывалась первая комната списка, и это был
   * произвол: почему именно она. Лента отвечает на вопрос «что вообще
   * происходит», комната — «что происходит вот здесь».
   */
  const requested = typeof params['room'] === 'string' ? params['room'] : undefined;
  const active =
    requested === undefined ? null : (rooms.find((room) => room.id === requested) ?? null);

  const topicId = typeof params['topic'] === 'string' ? params['topic'] : undefined;

  const feed = active === null ? await companyFeed(ctx) : [];

  // Те же подписи для ленты: ключи повторяются, подписывается каждый по разу.
  const feedKeys = [
    ...new Set(feed.map((item) => item.authorAvatarKey).filter((key) => key !== null)),
  ];
  const feedUrls = await fileUrls(ctx, feedKeys);
  const feedAvatar = new Map(feedKeys.map((key, index) => [key, feedUrls[index] ?? null]));

  const feedRows = feed.map((item) => ({
    ...item,
    timeLabel: formatDateTime(locale, new Date(item.createdAt)),
    authorAvatarUrl:
      item.authorAvatarKey === null ? null : (feedAvatar.get(item.authorAvatarKey) ?? null),
  }));

  // Отпечаток нужен клиенту, чтобы спрашивать «изменилось ли» и получать
  // короткий ответ, когда нет.
  const target =
    active === null ? null : { roomId: active.id, ...(topicId === undefined ? {} : { topicId }) };

  const version = target === null ? '' : await chatVersion(ctx, target);

  // Открыл — значит прочитал. Отметка ставится серверным временем: браузер
  // с уехавшими часами пометил бы прочитанным то, что ещё не пришло.
  if (target !== null) await markChatRead(ctx, target);

  const topics = active === null ? [] : await listChatTopics(ctx, active.id);

  const messages =
    target === null
      ? []
      : (await listChatMessages(ctx, target)).map((message) => ({
          ...message,
          // Дата считается здесь, на сервере: у браузера агента может
          // не быть данных грузинской локали.
          timeLabel: formatDateTime(locale, new Date(message.createdAt)),
        }));

  /*
   * Фотографии авторов подписываются одним махом.
   *
   * Ключей в ленте немного и они повторяются — один человек пишет подряд, —
   * поэтому подписывается каждый УНИКАЛЬНЫЙ ключ по разу. Подпись дешёвая,
   * но десять одинаковых подписей на десять реплик одного автора — работа
   * впустую.
   */
  const avatarKeys = [
    ...new Set(messages.map((message) => message.authorAvatarKey).filter((key) => key !== null)),
  ];
  const avatarUrls = await fileUrls(ctx, avatarKeys);
  const avatarOf = new Map(avatarKeys.map((key, index) => [key, avatarUrls[index] ?? null]));

  const withAvatars = messages.map((message) => ({
    ...message,
    authorAvatarUrl:
      message.authorAvatarKey === null ? null : (avatarOf.get(message.authorAvatarKey) ?? null),
  }));

  // Правило 6: кнопка прячется у того, кому сервер всё равно откажет.
  const canCreate = permissionScope(ctx.role, 'chatRoom', 'create') !== null;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t('nav.chat')}</h1>
        {canCreate ? (
          <NewRoom
            labels={{
              open: t('chat.newRoom'),
              name: t('chat.roomName'),
              topic: t('chat.roomTopic'),
              color: t('chat.roomColor'),
              create: t('chat.create'),
              cancel: t('common.cancel'),
            }}
          />
        ) : null}
      </header>

      {rooms.length === 0 ? (
        <EmptyState title={t('chat.emptyRooms')} hint={t('chat.emptyRoomsHint')} />
      ) : (
        <div className="grid min-h-0 gap-4 lg:grid-cols-[16rem_1fr]">
          <Card className="h-fit overflow-hidden">
            <p className="px-4 pt-3 pb-1 text-xs font-semibold text-[var(--color-text-tertiary)]">
              {t('chat.rooms')}
            </p>
            <ul className="flex flex-col p-1.5">
              {/* Общая лента — первый пункт и место по умолчанию: сюда
                  человек попадает, пока не зашёл в конкретную комнату. */}
              <li>
                <Link
                  href="/chat"
                  aria-current={active === null ? 'page' : undefined}
                  className={`flex items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 transition-colors duration-[var(--duration-fast)] ${
                    active === null
                      ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-text)]'
                      : 'hover:bg-[var(--color-surface-muted)]'
                  }`}
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full bg-[image:var(--gradient-primary)]"
                  />
                  <span className="truncate text-sm font-medium">{t('chat.feed')}</span>
                </Link>
              </li>

              {rooms.map((room) => {
                const selected = room.id === active?.id;

                return (
                  <li key={room.id}>
                    <Link
                      href={`/chat?room=${room.id}`}
                      aria-current={selected ? 'page' : undefined}
                      className={`flex flex-col gap-0.5 rounded-[var(--radius-sm)] px-2.5 py-2 transition-colors duration-[var(--duration-fast)] ${
                        selected
                          ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-text)]'
                          : 'hover:bg-[var(--color-surface-muted)]'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {/* Точка цвета комнаты: в списке из десяти строк
                            нужную находят по цвету, а не читают названия. */}
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: stageColors(room.colorToken).fg }}
                        />
                        <span className="truncate text-sm font-medium">{room.name}</span>

                        {/* Сколько непрочитанного именно здесь. Без этого
                            значок в панели говорил «есть новое», но не
                            говорил где, и комнаты приходилось обходить
                            по одной. */}
                        <RoomUnread roomId={room.id} label={t('nav.unread')} />
                      </span>
                      {room.topic === null ? null : (
                        <span className="truncate text-xs text-[var(--color-text-tertiary)]">
                          {room.topic}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="flex h-[calc(100vh-13rem)] min-h-96 flex-col overflow-hidden">
            {active === null ? (
              <CompanyFeed
                items={feedRows}
                labels={{
                  title: t('chat.feed'),
                  hint: t('chat.feedHint'),
                  empty: t('chat.emptyMessages'),
                }}
              />
            ) : (
              <>
                <TopicBar
                  roomId={active.id}
                  topics={topics}
                  activeTopicId={topicId ?? null}
                  labels={{
                    all: t('chat.allInRoom'),
                    add: t('chat.newTopic'),
                    name: t('chat.topicName'),
                    create: t('chat.create'),
                    cancel: t('common.cancel'),
                  }}
                />

                <Conversation
                  messages={withAvatars}
                  postTo={`/api/v1/chat/rooms/${active.id}/messages${topicId === undefined ? '' : `?topic=${topicId}`}`}
                  currentUserId={ctx.userId}
                  version={version}
                  labels={{
                    write: t('chat.write'),
                    send: t('chat.send'),
                    edited: t('chat.edited'),
                    deleted: t('chat.deleted'),
                    delete: t('chat.delete'),
                    reply: t('chat.reply'),
                    replyingTo: t('chat.replyingTo'),
                    cancelReply: t('chat.cancelReply'),
                    deletedQuote: t('chat.deletedQuote'),
                    empty: t('chat.emptyMessages'),
                    emptyHint: t('chat.emptyMessagesHint'),
                  }}
                />
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
