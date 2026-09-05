'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, Field, Input } from '../../_ui/primitives';

/**
 * Заведение комнаты.
 *
 * Форма разворачивается на месте, а не в модальном окне: комната — это
 * название и одна строка про то, о чём она. Отдельное окно ради двух полей
 * перекрывает список, из которого человек и решил, что комнаты не хватает.
 *
 * Кнопка показывается только тому, у кого есть право (правило 6): сервер
 * всё равно откажет, и предлагать бессмысленное действие незачем.
 */
export function NewRoom({
  labels,
}: {
  labels: { open: string; name: string; topic: string; create: string; cancel: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        {labels.open}
      </Button>
    );
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;

        const form = new FormData(event.currentTarget);
        setBusy(true);

        void fetch('/api/v1/chat/rooms', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: String(form.get('name') ?? ''),
            topic: String(form.get('topic') ?? ''),
          }),
        })
          .then((response) => {
            if (response.ok) {
              setOpen(false);
              router.refresh();
            }
          })
          .finally(() => {
            setBusy(false);
          });
      }}
    >
      <Field label={labels.name}>
        <Input name="name" required autoFocus maxLength={80} />
      </Field>
      <Field label={labels.topic}>
        <Input name="topic" maxLength={280} />
      </Field>

      <Button type="submit" size="sm" disabled={busy}>
        {labels.create}
      </Button>
      <Button type="button" tone="ghost" size="sm" onClick={() => setOpen(false)}>
        {labels.cancel}
      </Button>
    </form>
  );
}
