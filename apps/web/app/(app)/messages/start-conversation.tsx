'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Avatar } from '../../_ui/accent';
import { Button, Input } from '../../_ui/primitives';

/**
 * Начало переписки с коллегой.
 *
 * СПИСОК С ПОИСКОМ, а не одно поле ввода: людей в агентстве десятки,
 * и выбрать из списка надёжнее, чем угадать написание грузинской фамилии.
 * Но и список из тридцати имён листать долго, поэтому над ним строка поиска.
 *
 * ИЩЕТ И ПО ТЕЛЕФОНУ. Коллегу нередко ищут по номеру: он пришёл в звонке,
 * в переписке с собственником, в объявлении, размещённом этим сотрудником.
 * Сравниваются только цифры — записаны номера по-разному, с плюсом
 * и без, со скобками и пробелами, и совпадение по написанию не нашлось бы.
 *
 * Переписка не «создаётся» повторно: сервер возвращает существующую, если
 * эти двое уже переписывались. Поэтому кнопка ведёт себя одинаково и в
 * первый раз, и в сотый.
 */
/** Только цифры: номера записывают по-разному, а ищут по цифрам. */
function digits(value: string): string {
  return value.replace(/\D/gu, '');
}

export interface Colleague {
  id: string;
  name: string;
  phone: string | null;
}

export function StartConversation({
  people,
  labels,
}: {
  people: Colleague[];
  labels: { open: string; cancel: string; search: string; nothing: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');

  if (people.length === 0) return null;

  const clean = query.trim();
  const asDigits = digits(clean);

  const found =
    clean === ''
      ? people
      : people.filter((person) => {
          if (person.name.toLowerCase().includes(clean.toLowerCase())) return true;
          // По номеру ищем, только если в запросе вообще есть цифры:
          // иначе пустая строка цифр совпала бы с любым телефоном.
          return (
            asDigits !== '' && person.phone !== null && digits(person.phone).includes(asDigits)
          );
        });

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
      <Input
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={labels.search}
        aria-label={labels.search}
      />

      {found.length === 0 ? (
        <p className="px-2.5 py-3 text-sm text-[var(--color-text-secondary)]">{labels.nothing}</p>
      ) : (
        <ul className="max-h-64 overflow-y-auto">
          {found.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void start(person.id)}
                className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left transition-[background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.99] hover:bg-[var(--color-surface-muted)] disabled:opacity-60"
              >
                <Avatar name={person.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{person.name}</span>
                  {/* Номер под именем: по нему и искали, и увидеть его надо
                      рядом с тем, кого нашли. */}
                  {person.phone === null ? null : (
                    <span className="block truncate text-xs text-[var(--color-text-tertiary)]">
                      {person.phone}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button type="button" tone="ghost" size="sm" onClick={() => setOpen(false)}>
        {labels.cancel}
      </Button>
    </div>
  );
}
