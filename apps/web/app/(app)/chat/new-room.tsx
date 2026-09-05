'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { stageColors } from '../../_ui/accent';
import { Button, Field, Input } from '../../_ui/primitives';

/**
 * Цвета комнаты — тот же закрытый набор, что у стадий воронки.
 *
 * Общий набор, а не свой: две палитры в одном продукте расходятся на первой
 * же правке, и пользователь начинает видеть «почти такой же, но другой»
 * зелёный в двух местах.
 */
const COLORS = ['brand', 'success', 'warning', 'danger', 'neutral'] as const;

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
  labels: {
    open: string;
    name: string;
    topic: string;
    color: string;
    create: string;
    cancel: string;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [color, setColor] = useState<string>('brand');

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
            colorToken: color,
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

      {/* Цвет — кружками, а не списком: цвет выбирают глазами, и название
          «brand» человеку ничего не говорит. Выбранный обведён кольцом,
          чтобы состояние читалось не только по насыщенности. */}
      <div className="flex items-center gap-1.5 pb-1">
        {COLORS.map((token) => {
          const colors = stageColors(token);
          const selected = token === color;

          return (
            <button
              key={token}
              type="button"
              onClick={() => setColor(token)}
              aria-label={labels.color}
              aria-pressed={selected}
              className={`size-6 rounded-full transition-transform duration-[var(--duration-fast)] ${
                selected ? 'ring-2 ring-offset-2 ring-[var(--color-text-primary)]' : ''
              }`}
              style={{ backgroundColor: colors.fg }}
            />
          );
        })}
      </div>

      <Button type="submit" size="sm" disabled={busy}>
        {labels.create}
      </Button>
      <Button type="button" tone="ghost" size="sm" onClick={() => setOpen(false)}>
        {labels.cancel}
      </Button>
    </form>
  );
}
