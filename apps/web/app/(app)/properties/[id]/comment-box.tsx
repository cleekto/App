'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Comment {
  id: string;
  body: string;
  authorName: string | null;
  /**
   * Дата, УЖЕ ОТФОРМАТИРОВАННАЯ НА СЕРВЕРЕ.
   *
   * Форматировать её здесь нельзя, и это не стилистика. Браузер может не
   * иметь данных грузинской локали: Chrome на машине владельца молча
   * подставляет для `ka-GE` русский формат, тогда как Node с полным ICU
   * даёт грузинский. Разный текст на сервере и на клиенте — это, во-первых,
   * ошибка гидратации (React выбрасывает серверную разметку и рисует
   * заново), а во-вторых и хуже — грузинский агент видит русские даты
   * в продукте, где три языка равноправны (ADR-0008).
   *
   * Найдено ручным проходом по продукту; ни один тест этого не видел,
   * потому что тесты выполняются только в Node.
   */
  createdAtLabel: string;
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
  labels,
}: {
  propertyId: string;
  comments: Comment[];
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
          const meta = [comment.authorName, comment.createdAtLabel]
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
