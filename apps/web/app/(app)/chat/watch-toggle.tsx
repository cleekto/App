'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Отметка «следить» на карточке комнаты.
 *
 * ЧТО ОНА ДЕЛАЕТ. Отмеченная комната даёт значок непрочитанного и звук;
 * неотмеченная не даёт ничего. В агентстве два десятка комнат, и значок,
 * который горит всегда, перестают замечать через неделю — а вместе с ним
 * перестают замечать и тот единственный раз, когда он горел по делу.
 *
 * ОТМЕТКА ЛИЧНАЯ. Комнаты открыты всей компании, но следит за ними каждый
 * за своими: одна и та же комната для одного рабочая, для другого фоновая.
 *
 * ПЕРЕКЛЮЧАЕТСЯ СРАЗУ, ответа не дожидаясь. Флажок, который думает
 * полсекунды, нажимают второй раз — и получают обратное задуманному.
 * Если сервер откажет, состояние возвращается: показывать отмеченной
 * комнату, за которой не следят, хуже, чем не отметить её вовсе.
 */
export function WatchToggle({
  roomId,
  watched: initial,
  label,
}: {
  roomId: string;
  watched: boolean;
  label: string;
}) {
  const router = useRouter();
  const [watched, setWatched] = useState(initial);
  const [busy, setBusy] = useState(false);

  const toggle = async (next: boolean): Promise<void> => {
    setWatched(next);
    setBusy(true);

    try {
      const response = await fetch(`/api/v1/chat/rooms/${roomId}/watch`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ watched: next }),
      });

      if (!response.ok) {
        setWatched(!next);
        return;
      }

      // Значок в панели считает только отслеживаемые комнаты, поэтому
      // страница обязана перечитаться: иначе число останется прежним
      // до следующего тика опроса.
      router.refresh();
    } catch {
      setWatched(!next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <label
      title={label}
      // Нажатие на флажок не должно открывать комнату: он стоит внутри
      // строки, которая целиком ведёт в неё.
      onClick={(event) => event.stopPropagation()}
      className="flex shrink-0 cursor-pointer items-center gap-1 rounded-[var(--radius-pill)] px-1 py-0.5 transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-muted)]"
    >
      <input
        type="checkbox"
        checked={watched}
        disabled={busy}
        aria-label={label}
        onChange={(event) => void toggle(event.target.checked)}
        className="size-3.5 shrink-0 cursor-pointer accent-[var(--color-brand)]"
      />
    </label>
  );
}
