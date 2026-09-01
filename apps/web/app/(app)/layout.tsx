import Link from 'next/link';
import type { ReactNode } from 'react';

import { translate } from '@cleekto/i18n';

import { contextLocale, me, requireContext } from '../_lib/session';
import { SignOutButton } from './sign-out-button';

/**
 * Оболочка приложения — DESIGN §10 и §11.
 *
 * Боковая навигация из четырёх пунктов и ничего больше: интерфейс агента
 * должен помещаться в голове целиком. Пятый пункт добавляется, только когда
 * без него нельзя работать.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireContext();
  const locale = contextLocale(ctx);
  const user = await me(ctx);

  const t = (key: Parameters<typeof translate>[1]): string => translate(locale, key);

  const nav = [
    { href: '/properties', label: t('nav.properties') },
    { href: '/board', label: t('nav.board') },
    { href: '/tasks', label: t('nav.tasks') },
    { href: '/settings', label: t('nav.settings') },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col justify-between border-r border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-6">
        <div>
          <Link href="/properties" className="block px-2 text-lg font-semibold tracking-tight">
            {t('app.name')}
          </Link>

          <nav className="mt-8 flex flex-col gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-2 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] hover:text-[var(--color-text-primary)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="border-t border-[var(--color-border)] px-2 pt-4">
          <p className="truncate text-sm font-medium">{user.fullName}</p>
          <p className="truncate text-xs text-[var(--color-text-secondary)]">{user.companyName}</p>
          <SignOutButton label={t('nav.signOut')} />
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
