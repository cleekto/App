import Link from 'next/link';
import type { ReactNode } from 'react';

import { translate } from '@kleekto/i18n';

import { contextLocale, me, requireContext } from '../_lib/session';
import { LocaleSwitcher } from '../_ui/locale-switcher';
import { Wordmark } from '../_ui/wordmark';
import { NavLink } from './nav-link';
import { SignOutButton } from './sign-out-button';

/**
 * Оболочка приложения — DESIGN §10 и §11.
 *
 * Боковая навигация из пяти пунктов и ничего больше: интерфейс агента должен
 * помещаться в голове целиком. Шестой пункт добавляется, только когда без него
 * нельзя работать.
 *
 * Иконки нарисованы здесь, а не подключены библиотекой: их пять, каждая
 * в двадцать строк, и целая зависимость ради этого — плохой обмен. Все они
 * штриховые, одной толщины, как требует DESIGN §33.
 */

const ICONS: Record<string, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  properties: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M9.5 20v-6h5v6" />
    </>
  ),
  board: (
    <>
      <rect x="3" y="4" width="5" height="16" rx="1.5" />
      <rect x="10" y="4" width="5" height="11" rx="1.5" />
      <rect x="17" y="4" width="4" height="7" rx="1.5" />
    </>
  ),
  tasks: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h9" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
    </>
  ),
};

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireContext();
  const locale = contextLocale(ctx);
  const user = await me(ctx);

  const t = (key: Parameters<typeof translate>[1]): string => translate(locale, key);

  const nav = [
    { href: '/dashboard', label: t('dashboard.title'), icon: 'dashboard' },
    { href: '/properties', label: t('nav.properties'), icon: 'properties' },
    { href: '/board', label: t('nav.board'), icon: 'board' },
    { href: '/tasks', label: t('nav.tasks'), icon: 'tasks' },
    { href: '/settings', label: t('nav.settings'), icon: 'settings' },
  ];

  // Инициалы вместо фотографии: фотографий у нас нет, а серый круг с буквой
  // читается как «человек» и не притворяется тем, чего нет.
  const initials = user.fullName
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('');

  return (
    <div className="flex min-h-screen">
      {/*
        Панель прибита к высоте экрана, а не тянется за содержимым. Иначе
        на длинной странице блок пользователя уезжает вниз вместе со списком,
        и переключатель языка с кнопкой выхода становится не достать —
        именно это и случилось при первой проверке.
      */}
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col justify-between border-r border-[var(--color-sidebar-border)] bg-[var(--color-sidebar-bg)] text-[var(--color-sidebar-fg)]">
        <div className="flex min-h-0 flex-col overflow-y-auto">
          <Link
            href="/properties"
            className="flex items-center gap-2 px-5 py-5 text-base tracking-tight"
          >
            <img src="/brand/mark.png" alt="" className="size-7 object-contain" />
            <Wordmark tone="dark" className="text-base" />
          </Link>

          <nav className="flex flex-col gap-0.5 px-3">
            {nav.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4 shrink-0"
                  aria-hidden
                >
                  {ICONS[item.icon]}
                </svg>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--color-sidebar-border)] p-4">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-sidebar-active-bg)] text-xs font-semibold text-[var(--color-sidebar-active-fg)]"
            >
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.fullName}</p>
              <p className="truncate text-xs text-[var(--color-sidebar-fg-muted)]">
                {user.companyName}
              </p>
            </div>
          </div>

          <LocaleSwitcher current={locale} persist tone="dark" ariaLabel={t('settings.language')} />

          <SignOutButton label={t('nav.signOut')} />
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
