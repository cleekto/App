'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { failureText } from '../../_ui/failure';
import { Button, Field, Input, Notice, Select } from '../../_ui/primitives';
import { notifyError } from '../../_ui/toast';

/**
 * Новая задача со страницы задач.
 *
 * ЗАЧЕМ ЗДЕСЬ, ЕСЛИ ЕСТЬ НА КАРТОЧКЕ. Задачу заводят, когда о ней вспомнили,
 * а вспоминают не на карточке объекта, а между делом — «перезвонить
 * в четверг». Заставлять человека сначала найти объект, чтобы записать
 * то, что он уже держит в голове, — верный способ добиться, чтобы он
 * записал это в другом месте, вне продукта.
 *
 * ОБЪЕКТ ВСЁ РАВНО ОБЯЗАТЕЛЕН: задача «просто так» превращает список
 * в свалку, и найти её потом можно только глазами. Поэтому объект
 * выбирается из своих — их у агента десятки, не тысячи.
 *
 * Строк здесь нет — всё приходит из словаря (правило 18).
 */

export function NewTask({
  properties,
  labels,
}: {
  properties: Array<{ id: string; name: string }>;
  labels: {
    open: string;
    title: string;
    property: string;
    due: string;
    submit: string;
    cancel: string;
    saving: string;
    failed: string;
    noProperties: string;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  if (properties.length === 0) {
    return (
      <p className="text-[0.8125rem] text-[var(--color-text-secondary)]">{labels.noProperties}</p>
    );
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        {labels.open}
      </Button>
    );
  }

  const submit = async (form: FormData): Promise<void> => {
    const title = String(form.get('title') ?? '').trim();
    if (title === '' || busy) return;

    setBusy(true);
    setFailed(null);

    try {
      const due = String(form.get('dueAt') ?? '');

      const response = await fetch('/api/v1/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          propertyId: String(form.get('propertyId') ?? ''),
          title,
          /*
           * Поле `datetime-local` отдаёт время БЕЗ пояса — то самое, что
           * человек видит на своих часах. Разбирать его как местное и есть
           * правильно: «в четверг в 15:00» означает пятнадцать по Тбилиси,
           * а не по часам сервера.
           */
          ...(due === '' ? {} : { dueAt: new Date(due).toISOString() }),
        }),
      });

      if (!response.ok) {
        const text = await failureText(response, {}, labels.failed);
        setFailed(text);
        notifyError(text);
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setFailed(labels.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="appear flex w-full flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(new FormData(event.currentTarget));
      }}
    >
      {failed === null ? null : <Notice tone="error">{failed}</Notice>}

      <Field label={labels.title}>
        <Input name="title" autoFocus maxLength={200} required />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={labels.property}>
          <Select name="propertyId" defaultValue={properties[0]?.id ?? ''}>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={labels.due}>
          <Input type="datetime-local" name="dueAt" />
        </Field>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? labels.saving : labels.submit}
        </Button>
        <Button tone="ghost" size="sm" type="button" onClick={() => setOpen(false)}>
          {labels.cancel}
        </Button>
      </div>
    </form>
  );
}
