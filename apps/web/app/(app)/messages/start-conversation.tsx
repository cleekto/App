'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Avatar } from '../../_ui/accent';
import { Button } from '../../_ui/primitives';

/**
 * Начало переписки с коллегой.
 *
 * Список сотрудников, а не поле ввода имени: людей в агентстве десятки,
 * не тысячи, и выбрать из списка быстрее и надёжнее, чем угадать написание
 * грузинской фамилии.
 *
 * Переписка не «создаётся» повторно: сервер возвращает существующую, если
 * эти двое уже переписывались. Поэтому кнопка ведёт себя одинаково и в
 * первый раз, и в сотый.
 */
export function StartConversation({
  people,
  labels,
}: {
  people: Array<{ id: string; name: string }>;
  labels: { open: string; cancel: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (people.length === 0) return null;

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        {labels.open}
      </Button>
    );
  }

  const start = async (partnerUserId: string): Promise<void> => {
    if (busy) return;
    setBusy(true);

    try {
      const response = await fetch('/api/v1/chat/conversations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ partnerUserId }),
      });

      if (response.ok) {
        const conversation = (await response.json()) as { id: string };
        setOpen(false);
        router.push(`/messages?with=${conversation.id}`);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full max-w-md flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-card)]">
      <ul className="max-h-64 overflow-y-auto">
        {people.map((person) => (
          <li key={person.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void start(person.id)}
              className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-muted)] disabled:opacity-60"
            >
              <Avatar name={person.name} size="sm" />
              <span className="truncate text-sm">{person.name}</span>
            </button>
          </li>
        ))}
      </ul>

      <Button type="button" tone="ghost" size="sm" onClick={() => setOpen(false)}>
        {labels.cancel}
      </Button>
    </div>
  );
}
