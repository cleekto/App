'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Полоса тем над лентой комнаты.
 *
 * ЗАЧЕМ ТЕМЫ, КОГДА ЕСТЬ КОМНАТЫ. Комната — это круг людей и предмет в целом
 * («Ваке», «Объявления»); тема — один разговор внутри него («Жванияс 5, торг
 * с собственником»). Без тем длинный день в комнате превращается в одну
 * ленту, где три разговора идут вперемешку и ни один нельзя дочитать.
 *
 * «Всё в комнате» — первый пункт и состояние по умолчанию: сообщения,
 * написанные без темы, никуда не пропадают.
 *
 * Тему заводит любой сотрудник, в отличие от комнаты: начать разговор —
 * не то же самое, что завести новый круг людей. Поэтому кнопка тут без
 * проверки роли.
 */

export interface TopicItem {
  id: string;
  name: string;
  messageCount: number;
}

export function TopicBar({
  roomId,
  topics,
  activeTopicId,
  labels,
}: {
  roomId: string;
  topics: TopicItem[];
  activeTopicId: string | null;
  labels: { all: string; add: string; name: string; create: string; cancel: string };
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const create = async (name: string): Promise<void> => {
    const clean = name.trim();
    if (clean === '' || busy) return;

    setBusy(true);
    try {
      const response = await fetch(`/api/v1/chat/rooms/${roomId}/topics`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: clean }),
      });

      if (response.ok) {
        const topic = (await response.json()) as { id: string };
        setAdding(false);
        // Сразу в новую тему: человек её завёл, чтобы в ней писать.
        router.push(`/chat?room=${roomId}&topic=${topic.id}`);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--color-border)] px-3 py-2">
      <Link
        href={`/chat?room=${roomId}`}
        aria-current={activeTopicId === null ? 'page' : undefined}
        className={`rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-medium transition-[background-color,color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.97] ${
          activeTopicId === null
            ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-text)]'
            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]'
        }`}
      >
        {labels.all}
      </Link>

      {topics.map((topic) => (
        <Link
          key={topic.id}
          href={`/chat?room=${roomId}&topic=${topic.id}`}
          aria-current={topic.id === activeTopicId ? 'page' : undefined}
          className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-medium transition-[background-color,color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.97] ${
            topic.id === activeTopicId
              ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-text)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]'
          }`}
        >
          <span className="max-w-40 truncate">{topic.name}</span>
          <span className="tabular-nums opacity-60">{String(topic.messageCount)}</span>
        </Link>
      ))}

      {adding ? (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void create(String(form.get('name') ?? ''));
          }}
        >
          <input
            name="name"
            autoFocus
            maxLength={80}
            placeholder={labels.name}
            className="h-7 w-44 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-xs outline-none focus-visible:border-[var(--color-brand)]"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-[var(--radius-pill)] bg-[var(--color-brand)] px-2.5 py-1 text-xs font-medium text-white"
          >
            {labels.create}
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="px-1.5 text-xs text-[var(--color-text-tertiary)]"
          >
            {labels.cancel}
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-[var(--radius-pill)] border border-dashed border-[var(--color-border-field)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] transition-[border-color,color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.97] hover:border-[var(--color-brand)] hover:text-[var(--color-brand-text)]"
        >
          {labels.add}
        </button>
      )}
    </div>
  );
}
