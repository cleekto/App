'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { formatDateTime, type Locale } from '@cleekto/i18n';

interface Comment {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: string;
}

/**
 * Обсуждение объекта — DESIGN §21.
 *
 * Разговорно: автор, дата, текст. Метаданные держатся неброско.
 * Текст выводится через `{}` — React экранирует его сам, и комментарий
 * с угловыми скобками останется текстом, а не разметкой.
 */
export function CommentBox({
  propertyId,
  comments,
  locale,
  labels,
}: {
  propertyId: string;
  comments: Comment[];
  locale: Locale;
  labels: { title: string; placeholder: string; send: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h2 className="text-sm font-semibold">{labels.title}</h2>

      <ul className="mt-3 flex flex-col gap-3">
        {comments.map((comment) => {
          // Автор мог уйти из компании — комментарий остаётся, он часть
          // истории объекта. Показываем только дату, без пустого имени.
          const meta = [comment.authorName, formatDateTime(locale, new Date(comment.createdAt))]
            .filter((part) => part !== null)
            .join(' · ');

          return (
            <li key={comment.id}>
              <p className="text-xs text-[var(--color-text-secondary)]">{meta}</p>
              <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
            </li>
          );
        })}
      </ul>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const body = String(new FormData(form).get('body') ?? '').trim();
          if (body === '') return;

          setBusy(true);
          void fetch(`/api/v1/properties/${propertyId}/comments`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ body }),
          })
            .then(() => {
              form.reset();
              router.refresh();
            })
            .finally(() => setBusy(false));
        }}
      >
        <input
          name="body"
          placeholder={labels.placeholder}
          className="flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {labels.send}
        </button>
      </form>
    </section>
  );
}
