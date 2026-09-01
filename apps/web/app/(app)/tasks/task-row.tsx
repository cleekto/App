'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Отметка «выполнено» прямо из списка: ради неё список и открывают. */
export function TaskRow({ taskId, doneLabel }: { taskId: string; doneLabel: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void fetch(`/api/v1/tasks/${taskId}/status`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status: 'done' }),
        })
          .then(() => router.refresh())
          .finally(() => setBusy(false));
      }}
      className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-1 text-xs disabled:opacity-50"
    >
      {doneLabel}
    </button>
  );
}
