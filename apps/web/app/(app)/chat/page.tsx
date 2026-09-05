import Link from 'next/link';

import { listChatMessages, listChatRooms, permissionScope } from '@kleekto/core';
import { formatDateTime, translate } from '@kleekto/i18n';

import { contextLocale, requireContext } from '../../_lib/session';
import { Card, EmptyState } from '../../_ui/primitives';
import { Conversation } from './conversation';
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

  const requested = typeof params['room'] === 'string' ? params['room'] : undefined;
  const active = rooms.find((room) => room.id === requested) ?? rooms[0] ?? null;

  const messages =
    active === null
      ? []
      : (await listChatMessages(ctx, { roomId: active.id })).map((message) => ({
          ...message,
          // Дата считается здесь, на сервере: у браузера агента может
          // не быть данных грузинской локали.
          timeLabel: formatDateTime(locale, new Date(message.createdAt)),
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
                      <span className="truncate text-sm font-medium">{room.name}</span>
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
              <p className="m-auto text-sm text-[var(--color-text-secondary)]">
                {t('chat.pickRoom')}
              </p>
            ) : (
              <Conversation
                messages={messages}
                postTo={`/api/v1/chat/rooms/${active.id}/messages`}
                currentUserId={ctx.userId}
                labels={{
                  write: t('chat.write'),
                  send: t('chat.send'),
                  edited: t('chat.edited'),
                  deleted: t('chat.deleted'),
                  delete: t('chat.delete'),
                  empty: t('chat.emptyMessages'),
                  emptyHint: t('chat.emptyMessagesHint'),
                }}
              />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
