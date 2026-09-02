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
}: {
  href: string;
  label: string;
  children: ReactNode;
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
      className={`flex items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2 text-sm transition-colors ${
        active
          ? 'bg-[var(--color-sidebar-active-bg)] font-medium text-[var(--color-sidebar-active-fg)]'
          : 'text-[var(--color-sidebar-fg-muted)] hover:bg-[var(--color-sidebar-hover-bg)] hover:text-[var(--color-sidebar-fg)]'
      }`}
    >
      {children}
    </Link>
  );
}
