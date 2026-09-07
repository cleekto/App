'use client';

import { useState } from 'react';

/**
 * Кнопка «скопировать» — одна на всё, что копируют в форму площадки.
 *
 * ОТМЕТКА ГАСНЕТ САМА. Она подтверждает действие, а не остаётся состоянием,
 * которое агенту потом сбрасывать. Он копирует два десятка значений подряд,
 * и двадцать зажжённых отметок сказали бы ему ровно ничего.
 *
 * НЕУДАЧА МОЛЧАЛИВА, И ЭТО НАМЕРЕННО. Буфер обмена закрывают настройками
 * браузера; текст при этом виден целиком, и агент выделит его руками.
 * Сообщение об ошибке там, где выход очевиден, — лишний шум.
 */

/** Сколько держится отметка. Достаточно, чтобы заметить, и мало, чтобы не мешать. */
const SHOWN_MS = 1500;

export function CopyButton({
  text,
  labels,
  className = '',
}: {
  text: string;
  labels: { copy: string; copied: string };
  className?: string;
}) {
  const [done, setDone] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), SHOWN_MS);
    } catch {
      // См. выше: текст на экране, руки у агента есть.
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={`shrink-0 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] px-2 py-1 text-[0.6875rem] transition-colors duration-[var(--duration-fast)] [@media(hover:hover)and(pointer:fine)]:hover:bg-[var(--color-surface-muted)] ${className}`}
    >
      {done ? labels.copied : labels.copy}
    </button>
  );
}
