import Link from 'next/link';
import type { ReactNode } from 'react';

import { Photo } from '../../_ui/photo';

/**
 * Карточка объекта для плиточного режима (§21 задания).
 *
 * ЦЕНА — ГЛАВНОЕ. Задание говорит об этом прямо, и оно право: по цене
 * объекты и перебирают. Поэтому цена набрана крупно и первой, а тип,
 * площадь и адрес идут под ней строкой поменьше — они уточняют, а не спорят.
 *
 * ЧЕМ ЭТО ОТЛИЧАЕТСЯ ОТ СТРОКИ СПИСКА. Список отвечает на вопрос «где тот
 * объект» — там важна плотность и ровные колонки. Плитки отвечают на «что
 * у нас вообще есть» — там важна фотография, потому что недвижимость
 * узнают глазами. Поэтому здесь снимок крупный, а не шестнадцать на
 * двенадцать пикселей сбоку.
 */
export function PropertyCard({
  href,
  photo,
  photoAlt,
  price,
  kind,
  facts,
  place,
  status,
  agent,
  updated,
}: {
  href: string;
  photo: string | null;
  photoAlt: string;
  price: string;
  kind: string;
  facts: string;
  place: string;
  status: ReactNode;
  agent: ReactNode;
  updated: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] transition-[transform,box-shadow,border-color] duration-[var(--duration-base)] ease-[var(--ease-out)] [@media(hover:hover)and(pointer:fine)]:hover:-translate-y-0.5 [@media(hover:hover)and(pointer:fine)]:hover:border-[var(--color-border-strong)] [@media(hover:hover)and(pointer:fine)]:hover:shadow-[var(--shadow-hover)]"
    >
      {/* Снимок чуть наезжает при наведении — движение внутри рамки,
          сама карточка при этом лишь приподнимается. */}
      <span className="relative block aspect-[4/3] overflow-hidden bg-[var(--color-surface-muted)]">
        <Photo
          src={photo}
          alt={photoAlt}
          className="size-full transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)] group-hover:scale-[1.04]"
        />
        <span className="absolute top-2 left-2">{status}</span>
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1 p-3.5">
        <span className="text-[1.25rem] leading-7 font-semibold tracking-tight tabular-nums">
          {price}
        </span>

        <span className="truncate text-[0.8125rem] leading-5 text-[var(--color-text-secondary)]">
          {facts}
        </span>
        {place === '' ? null : (
          <span className="truncate text-[0.8125rem] leading-5 text-[var(--color-text-tertiary)]">
            {place}
          </span>
        )}

        <span className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="flex min-w-0 items-center gap-1.5">{agent}</span>
          <span className="shrink-0 text-[0.75rem] text-[var(--color-text-tertiary)]">
            {updated}
          </span>
        </span>

        {/* Тип и сделка — служебная строка внизу: она одинакова у половины
            карточек и наверху только отнимала бы место у цены. */}
        <span className="sr-only">{kind}</span>
      </span>
    </Link>
  );
}
