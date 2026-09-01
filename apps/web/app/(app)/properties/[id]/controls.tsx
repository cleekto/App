'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Labels {
  status: string;
  assignee: string;
  unassigned: string;
  publish: string;
  openExisting: string;
  publishAnyway: string;
  cancel: string;
}

interface CheckResult {
  alreadyPublished: boolean;
  reasonHuman: string | null;
  existingListings: Array<{ source: string; canonicalUrl: string }>;
  actions: string[];
}

/**
 * Статус, ответственный и размещение.
 *
 * Кнопка «Разместить» НЕ размещает объявление и не может: публикует человек,
 * на форме площадки, своими руками (правило 12). Здесь она делает ровно две
 * вещи — проверяет, не размещён ли объект уже, и заводит черновик публикации
 * с профилем по умолчанию.
 */
export function PropertyControls({
  propertyId,
  currentStatusId,
  currentAssigneeId,
  statuses,
  people,
  labels,
}: {
  propertyId: string;
  currentStatusId: string;
  currentAssigneeId: string | null;
  statuses: Array<{ id: string; name: string }>;
  people: Array<{ id: string; name: string }>;
  labels: Labels;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<CheckResult | null>(null);
  /** Площадка, ради которой открылось предупреждение. Иначе «всё равно»
      не знает, что именно размещать. */
  const [pending, setPending] = useState<string | null>(null);

  const post = async (path: string, body: unknown): Promise<void> => {
    setBusy(true);
    try {
      await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  /**
   * §5.5 п. 4: обратная проверка ДО заполнения.
   *
   * Если у объекта уже есть объявление на этой площадке — в том числе то,
   * из которого он был импортирован, — агент видит предупреждение и сам
   * решает, что делать. Молча создать вторую публикацию значило бы завести
   * агентству дубль на площадке.
   */
  const startPublish = async (source: string): Promise<void> => {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/v1/properties/${propertyId}/publish-check?source=${source}`,
      );
      const result = (await response.json()) as CheckResult;

      if (result.alreadyPublished || result.existingListings.length > 0) {
        setPending(source);
        setCheck(result);
        return;
      }
      await createDraft(source);
    } finally {
      setBusy(false);
    }
  };

  const createDraft = async (source: string): Promise<void> => {
    setCheck(null);
    setPending(null);
    await post(`/api/v1/properties/${propertyId}/publications`, { targetSource: source });
  };

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--color-text-secondary)]">{labels.status}</span>
        <select
          defaultValue={currentStatusId}
          disabled={busy}
          onChange={(event) =>
            void post(`/api/v1/properties/${propertyId}/status`, {
              pipelineStatusId: event.target.value,
            })
          }
          className="rounded-lg border border-[var(--color-border)] px-3 py-2"
        >
          {statuses.map((status) => (
            <option key={status.id} value={status.id}>
              {status.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--color-text-secondary)]">{labels.assignee}</span>
        <select
          defaultValue={currentAssigneeId ?? ''}
          disabled={busy}
          onChange={(event) =>
            void post(`/api/v1/properties/${propertyId}/assign`, {
              assignedUserId: event.target.value === '' ? null : event.target.value,
            })
          }
          className="rounded-lg border border-[var(--color-border)] px-3 py-2"
        >
          <option value="">{labels.unassigned}</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </label>

      <div className="ml-auto flex items-center gap-2">
        {['SS_GE', 'MYHOME_GE'].map((source) => {
          // Название площадки — не текст интерфейса и переводу не подлежит.
          const label = `${labels.publish}: ${source}`;

          return (
            <button
              key={source}
              type="button"
              disabled={busy}
              onClick={() => void startPublish(source)}
              className="rounded-lg border border-[var(--color-brand-primary)] px-3 py-2 text-sm text-[var(--color-brand-primary)] disabled:opacity-50"
            >
              {label}
            </button>
          );
        })}
      </div>

      {check === null ? null : (
        <div className="w-full rounded-lg bg-[var(--color-warning)]/10 px-3 py-3 text-sm">
          <p className="text-[var(--color-text-primary)]">{check.reasonHuman}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {check.existingListings.map((listing) => (
              <li key={listing.canonicalUrl}>
                <a
                  href={listing.canonicalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--color-brand-primary)]"
                >
                  {listing.source}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            {/* Коды действий приходят с сервера (`open_existing`,
                `publish_anyway`, `cancel`) — это коды, а не текст, и
                переводятся здесь. Сервер не знает языка агента. */}
            {check.actions.includes('open_existing') && check.existingListings[0] !== undefined ? (
              <a
                href={check.existingListings[0].canonicalUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-[var(--color-border)] px-3 py-1 text-xs"
              >
                {labels.openExisting}
              </a>
            ) : null}

            {check.actions.includes('publish_anyway') ? (
              <button
                type="button"
                disabled={busy || pending === null}
                onClick={() => (pending === null ? undefined : void createDraft(pending))}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1 text-xs disabled:opacity-50"
              >
                {labels.publishAnyway}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setCheck(null);
                setPending(null);
              }}
              className="rounded-lg px-3 py-1 text-xs text-[var(--color-text-secondary)]"
            >
              {labels.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
