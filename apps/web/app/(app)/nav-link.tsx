'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Пункт навигации, знающий, открыт ли он сейчас.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ КОМПОНЕНТ. Подсветка текущего раздела требует адреса
 * страницы, а он известен только на клиенте. Выносится ровно этот кусок,
 * чтобы оболочка целиком осталась серверной и не тащила в браузер список
 * пунктов и переводы.
 *
 * Без подсветки человек теряет место: пять одинаковых строк, и непонятно,
 * на какой из них он стоит (DESIGN §11).
 */
export function NavLink({
  href,
  label,
  children,
  toggleId,
}: {
  href: string;
  label: string;
  children: ReactNode;
  /**
   * Id чекбокса, открывающего панель на телефоне (`(app)/layout.tsx`).
   * Постоянный layout Next не размонтирует чекбокс при переходе между
   * разделами — сам он не узнаёт о смене страницы, поэтому закрываем его
   * здесь, руками, по факту клика.
   */
  toggleId?: string;
}) {
  const pathname = usePathname();

  // Совпадение по префиксу, а не точное: карточка объекта лежит в
  // `/properties/<id>`, и раздел «Объекты» обязан оставаться подсвеченным.
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      title={label}
      onClick={() => {
        if (toggleId === undefined) return;
        const toggle = document.getElementById(toggleId);
        if (toggle instanceof HTMLInputElement) toggle.checked = false;
      }}
      /*
       * Открытый раздел отмечен полосой у левого края, а не только заливкой.
       * Заливка на тёмной панели читается слабо, и пять пунктов оставались
       * почти одинаковыми; полоса видна боковым зрением.
       */
      className={`relative flex items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2 text-sm transition-colors duration-[var(--duration-fast)] before:absolute before:top-1.5 before:bottom-1.5 before:-left-2 before:w-[3px] before:rounded-full before:transition-colors ${
        active
          ? 'bg-[var(--color-sidebar-active-bg)] font-medium text-[var(--color-sidebar-active-fg)] before:bg-[var(--color-brand)]'
          : 'text-[var(--color-sidebar-fg-muted)] before:bg-transparent hover:bg-[var(--color-sidebar-hover-bg)] hover:text-[var(--color-sidebar-fg)]'
      }`}
    >
      {children}
    </Link>
  );
}
