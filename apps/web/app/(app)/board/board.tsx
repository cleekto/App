'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { Locale } from '@cleekto/i18n';

import { factsLine, kindLine, placeLine, priceLine, type PropertyFacts } from '../../_lib/format';

interface Card extends PropertyFacts {
  id: string;
  pipelineStatusId: string;
}

/**
 * Перетаскивание карточек — DESIGN §17.
 *
 * На нативном HTML5 drag & drop, без библиотеки: перетаскивание карточки
 * между колонками — ровно то, для чего он и предназначен, а зависимость
 * ради этого пришлось бы обосновывать.
 *
 * Карточка переезжает в новую колонку сразу, до ответа сервера: агент
 * тащил её мышью и ждать подтверждения не должен. Если сервер откажет,
 * `router.refresh()` вернёт правду.
 */
export function Board({
  columns,
  items,
  locale,
  emptyLabel,
}: {
  columns: Array<{ id: string; name: string }>;
  items: Card[];
  locale: Locale;
  emptyLabel: string;
}) {
  const router = useRouter();
  const [cards, setCards] = useState(items);
  const [dragging, setDragging] = useState<string | null>(null);

  const move = (cardId: string, statusId: string): void => {
    const card = cards.find((item) => item.id === cardId);
    if (card === undefined || card.pipelineStatusId === statusId) return;

    setCards((current) =>
      current.map((item) => (item.id === cardId ? { ...item, pipelineStatusId: statusId } : item)),
    );

    void fetch(`/api/v1/properties/${cardId}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pipelineStatusId: statusId }),
    }).then(() => router.refresh());
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => {
        const inColumn = cards.filter((card) => card.pipelineStatusId === column.id);

        return (
          <section
            key={column.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (dragging !== null) move(dragging, column.id);
              setDragging(null);
            }}
            className="flex w-72 shrink-0 flex-col gap-2 rounded-[var(--radius-card)] bg-[var(--color-surface)] p-3"
          >
            <h2 className="flex items-baseline justify-between text-sm font-semibold">
              <span>{column.name}</span>
              <span className="text-xs text-[var(--color-text-secondary)]">
                {String(inColumn.length)}
              </span>
            </h2>

            {inColumn.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-6 text-center text-xs text-[var(--color-text-secondary)]">
                {emptyLabel}
              </p>
            ) : (
              inColumn.map((card) => (
                <a
                  key={card.id}
                  href={`/properties/${card.id}`}
                  draggable
                  onDragStart={() => setDragging(card.id)}
                  onDragEnd={() => setDragging(null)}
                  className="cursor-grab rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 active:cursor-grabbing"
                >
                  <p className="text-sm font-medium">{priceLine(locale, card)}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {kindLine(locale, card)}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {factsLine(locale, card)}
                  </p>
                  {placeLine(card) === '' ? null : (
                    <p className="truncate text-xs text-[var(--color-text-secondary)]">
                      {placeLine(card)}
                    </p>
                  )}
                </a>
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}
