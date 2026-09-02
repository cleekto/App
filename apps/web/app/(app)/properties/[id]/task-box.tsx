'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { Locale } from '@cleekto/i18n';

import { dueLine } from '../../../_lib/format';

interface Task {
  id: string;
  title: string;
  assignedUserName: string | null;
  dueAt: string | null;
  status: string;
  overdue: boolean;
}

/**
 * Задачи по объекту — DESIGN §20.
 *
 * Легко: что сделать, до когда, кто. Ни подзадач, ни приоритетов, ни меток —
 * дизайн прямо предупреждает не превращать задачи MVP в систему управления
 * проектами.
 */
export function TaskBox({
  propertyId,
  tasks,
  people,
  locale,
  labels,
}: {
  propertyId: string;
  tasks: Task[];
  people: Array<{ id: string; name: string }>;
  locale: Locale;
  labels: {
    title: string;
    add: string;
    titleField: string;
    dueField: string;
    assigneeField: string;
    create: string;
    done: string;
    cancel: string;
    overdue: string;
    empty: string;
    unassigned: string;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  const setStatus = (taskId: string, status: string): void => {
    setBusy(true);
    void fetch(`/api/v1/tasks/${taskId}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    })
      .then(() => router.refresh())
      .finally(() => setBusy(false));
  };

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{labels.title}</h2>
        <button
          type="button"
          onClick={() => setAdding((value) => !value)}
          className="text-xs text-[var(--color-brand)]"
        >
          {labels.add}
        </button>
      </div>

      {adding ? (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            const title = String(data.get('title') ?? '').trim();
            if (title === '') return;

            const due = String(data.get('dueAt') ?? '');
            const assignee = String(data.get('assignedUserId') ?? '');

            setBusy(true);
            void fetch('/api/v1/tasks', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                propertyId,
                title,
                dueAt: due === '' ? null : new Date(due).toISOString(),
                assignedUserId: assignee === '' ? null : assignee,
              }),
            })
              .then(() => {
                form.reset();
                setAdding(false);
                router.refresh();
              })
              .finally(() => setBusy(false));
          }}
        >
          <input
            name="title"
            placeholder={labels.titleField}
            className="min-w-48 flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
          />
          <input
            name="dueAt"
            type="datetime-local"
            aria-label={labels.dueField}
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
          />
          <select
            name="assignedUserId"
            aria-label={labels.assigneeField}
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
          >
            <option value="">{labels.unassigned}</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {labels.create}
          </button>
        </form>
      ) : null}

      {tasks.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{labels.empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className={task.status === 'open' ? '' : 'line-through opacity-60'}>
                  {task.title}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {[
                    task.dueAt === null ? null : dueLine(locale, task.dueAt),
                    task.assignedUserName,
                    task.overdue ? labels.overdue : null,
                  ]
                    .filter((part) => part !== null && part !== '')
                    .join(' · ')}
                </p>
              </div>

              {task.status === 'open' ? (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setStatus(task.id, 'done')}
                    className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs"
                  >
                    {labels.done}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setStatus(task.id, 'cancelled')}
                    className="rounded-lg px-2 py-1 text-xs text-[var(--color-text-secondary)]"
                  >
                    {labels.cancel}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
