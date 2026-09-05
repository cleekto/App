'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Avatar } from '../../_ui/accent';
import { Button } from '../../_ui/primitives';

/**
 * Лента сообщений и поле ввода — общее для комнаты и личной переписки.
 *
 * ОДИН КОМПОНЕНТ НА ОБА СЛУЧАЯ, потому что разница между ними ровно
 * в адресе, куда уходит сообщение. Всё остальное — как выглядит своё
 * и чужое, что можно править, что удалено — одинаково, и разведённое
 * по двум компонентам разошлось бы на первой же правке.
 *
 * КЛИЕНТСКИЙ, И ЭТО ОПРАВДАНО. Списки и страницы в продукте серверные,
 * но здесь нужны три вещи, которых на сервере не сделать: отправка без
 * перезагрузки, прокрутка к последнему сообщению и обновление ленты после
 * отправки. Дат он не форматирует — их считает сервер (у браузера может
 * не быть данных грузинской локали).
 */

export interface ChatMessageItem {
  id: string;
  body: string | null;
  authorUserId: string;
  authorName: string;
  /** Готовая подпись времени: посчитана на сервере. */
  timeLabel: string;
  editedAt: string | null;
  isDeleted: boolean;
  canDelete: boolean;
  canEdit: boolean;
}

export interface ChatLabels {
  write: string;
  send: string;
  edited: string;
  deleted: string;
  delete: string;
  empty: string;
  emptyHint: string;
}

export function Conversation({
  messages,
  postTo,
  currentUserId,
  labels,
  notice,
}: {
  messages: ChatMessageItem[];
  /** Адрес, куда уходит новое сообщение. Вся разница между комнатой и личной. */
  postTo: string;
  currentUserId: string;
  labels: ChatLabels;
  /** Пояснение над лентой — например, что переписка личная. */
  notice?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const bottom = useRef<HTMLDivElement>(null);

  // К последнему сообщению — сразу, без прокрутки на глазах: лента открылась
  // уже внизу, а не приехала туда, пока человек читает.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const send = async (): Promise<void> => {
    const body = draft.trim();
    if (body === '' || busy) return;

    setBusy(true);
    try {
      const response = await fetch(postTo, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
      });

      if (response.ok) {
        setDraft('');
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string): Promise<void> => {
    const response = await fetch(`/api/v1/chat/messages/${id}`, { method: 'DELETE' });
    if (response.ok) router.refresh();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {notice === undefined ? null : (
        <p className="border-b border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-text-tertiary)]">
          {notice}
        </p>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium">{labels.empty}</p>
            <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">
              {labels.emptyHint}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((message) => {
              const mine = message.authorUserId === currentUserId;

              return (
                <li key={message.id} className={`flex gap-2.5 ${mine ? 'flex-row-reverse' : ''}`}>
                  <Avatar name={message.authorName} size="sm" />

                  <div className={`flex min-w-0 max-w-[min(34rem,80%)] flex-col gap-1`}>
                    <div
                      className={`flex items-baseline gap-2 text-xs text-[var(--color-text-tertiary)] ${
                        mine ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <span className="font-medium text-[var(--color-text-secondary)]">
                        {message.authorName}
                      </span>
                      <span>{message.timeLabel}</span>
                      {message.editedAt === null ? null : <span>{labels.edited}</span>}
                    </div>

                    {/*
                      Своё сообщение — фирменной заливкой, чужое — светлой.
                      Так лента читается без чтения имён: взгляд отличает
                      свои реплики по стороне и цвету.
                    */}
                    <div
                      className={`rounded-[var(--radius-card)] px-3 py-2 text-sm break-words ${
                        message.isDeleted
                          ? 'bg-[var(--color-surface-muted)] text-[var(--color-text-tertiary)] italic'
                          : mine
                            ? 'bg-[image:var(--gradient-primary)] text-white'
                            : 'border border-[var(--color-border)] bg-[var(--color-surface)]'
                      }`}
                    >
                      {message.isDeleted ? labels.deleted : message.body}
                    </div>

                    {message.canDelete ? (
                      <button
                        type="button"
                        onClick={() => void remove(message.id)}
                        className={`text-xs text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-danger)] ${
                          mine ? 'self-end' : 'self-start'
                        }`}
                      >
                        {labels.delete}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div ref={bottom} />
      </div>

      <div className="flex items-end gap-2 border-t border-[var(--color-border)] p-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter отправляет, Shift+Enter переносит строку — как везде,
            // где люди переписываются. Иначе каждое сообщение требует мыши.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder={labels.write}
          rows={1}
          className="max-h-40 min-h-10 flex-1 resize-y rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus-visible:border-[var(--color-brand)]"
        />
        <Button type="button" onClick={() => void send()} disabled={busy || draft.trim() === ''}>
          {labels.send}
        </Button>
      </div>
    </div>
  );
}
