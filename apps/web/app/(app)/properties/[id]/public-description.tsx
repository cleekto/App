'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Описание для публикации.
 *
 * ДВА РАЗНЫХ ТЕКСТА, И ЭТО ПРИНЦИПИАЛЬНО. Описание из объявления написал
 * собственник или другое агентство — это чужой текст, и публиковать его
 * от своего имени странно и юридически, и стилистически. Поэтому оно
 * показывается только для справки и не редактируется.
 */
export function PublicDescription({
  propertyId,
  value,
  source,
  labels,
}: {
  propertyId: string;
  value: string | null;
  source: string | null;
  labels: { title: string; hint: string; source: string; save: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h2 className="text-sm font-semibold">{labels.title}</h2>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{labels.hint}</p>

      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const text = String(new FormData(event.currentTarget).get('publicDescription') ?? '');

          setBusy(true);
          void fetch(`/api/v1/properties/${propertyId}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ publicDescription: text === '' ? null : text }),
          })
            .then(() => router.refresh())
            .finally(() => setBusy(false));
        }}
      >
        <textarea
          name="publicDescription"
          defaultValue={value ?? ''}
          rows={6}
          className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="self-start rounded-lg bg-[var(--color-brand-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {labels.save}
        </button>
      </form>

      {source === null ? null : (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-[var(--color-text-secondary)]">
            {labels.source}
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">
            {source}
          </p>
        </details>
      )}
    </section>
  );
}
