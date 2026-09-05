import Link from 'next/link';

import { chatVersion, listChatMessages, listDirectConversations, listUsers } from '@kleekto/core';
import { formatDateTime, translate } from '@kleekto/i18n';

import { contextLocale, requireContext } from '../../_lib/session';
import { Avatar } from '../../_ui/accent';
import { Card, EmptyState } from '../../_ui/primitives';
import { Conversation } from '../chat/conversation';
import { StartConversation } from './start-conversation';

/**
 * Личные сообщения.
 *
 * ПЕРЕПИСКУ ВИДЯТ ТОЛЬКО ДВОЕ. Ни администратор, ни менеджер в неё
 * не заглядывают — это проверяется тестами в ядре, а не обещается здесь.
 * Строка над лентой говорит об этом человеку: если он этого не знает,
 * он будет писать так, будто читают все, и мессенджер не нужен.
 *
 * Собеседники — только свои: список берётся из справочника сотрудников
 * компании, а границу держит сервер (изоляция арендаторов).
 */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireContext();
  const locale = contextLocale(ctx);
  const params = await searchParams;

  const t = (key: Parameters<typeof translate>[1]): string => translate(locale, key);

  const [conversations, people] = await Promise.all([listDirectConversations(ctx), listUsers(ctx)]);

  const requested = typeof params['with'] === 'string' ? params['with'] : undefined;
  const active = conversations.find((row) => row.id === requested) ?? conversations[0] ?? null;

  // Отпечаток нужен клиенту, чтобы спрашивать «изменилось ли» и получать
  // короткий ответ, когда нет.
  const version = active === null ? '' : await chatVersion(ctx, { conversationId: active.id });

  const messages =
    active === null
      ? []
      : (await listChatMessages(ctx, { conversationId: active.id })).map((message) => ({
          ...message,
          timeLabel: formatDateTime(locale, new Date(message.createdAt)),
        }));

  // Себя в списке собеседников нет: написать самому себе нельзя, и сервер
  // это отвергает — предлагать бессмысленный пункт незачем.
  const candidates = people
    .filter((user) => user.isActive && user.id !== ctx.userId)
    .map((user) => ({ id: user.id, name: user.fullName }));

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t('nav.messages')}</h1>
        <StartConversation
          people={candidates}
          labels={{ open: t('chat.newConversation'), cancel: t('common.cancel') }}
        />
      </header>

      {conversations.length === 0 ? (
        <EmptyState title={t('chat.emptyConversations')} hint={t('chat.emptyConversationsHint')} />
      ) : (
        <div className="grid min-h-0 gap-4 lg:grid-cols-[18rem_1fr]">
          <Card className="h-fit overflow-hidden">
            <p className="px-4 pt-3 pb-1 text-xs font-semibold text-[var(--color-text-tertiary)]">
              {t('chat.conversations')}
            </p>
            <ul className="flex flex-col p-1.5">
              {conversations.map((row) => {
                const selected = row.id === active?.id;

                return (
                  <li key={row.id}>
                    <Link
                      href={`/messages?with=${row.id}`}
                      aria-current={selected ? 'page' : undefined}
                      className={`flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 transition-colors duration-[var(--duration-fast)] ${
                        selected
                          ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-text)]'
                          : 'hover:bg-[var(--color-surface-muted)]'
                      }`}
                    >
                      <Avatar name={row.partnerName} size="sm" />
                      <span className="truncate text-sm font-medium">{row.partnerName}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="flex h-[calc(100vh-13rem)] min-h-96 flex-col overflow-hidden">
            {active === null ? (
              <p className="m-auto text-sm text-[var(--color-text-secondary)]">
                {t('chat.pickConversation')}
              </p>
            ) : (
              <Conversation
                messages={messages}
                postTo={`/api/v1/chat/conversations/${active.id}/messages`}
                currentUserId={ctx.userId}
                version={version}
                notice={t('chat.privateHint')}
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
