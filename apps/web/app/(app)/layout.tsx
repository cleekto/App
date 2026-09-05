import Link from 'next/link';
import type { ReactNode } from 'react';

import { translate } from '@kleekto/i18n';

import { contextLocale, me, requireContext } from '../_lib/session';
import { Avatar } from '../_ui/accent';
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

/**
 * Открытие/закрытие панели на телефоне — на чекбоксе, без клиентского
 * компонента и JS-состояния. `peer-checked:` у Tailwind достаёт как до
 * панели, так и до подложки, потому что обе идут родными соседями чекбокса
 * в разметке ниже (правило `peer` — только соседи одного родителя).
 *
 * Закрытие после перехода по ссылке — в `NavLink`: чекбокс не знает
 * о смене страницы сам, а постоянный layout Next не размонтирует его
 * при переходе между `/properties`, `/board` и так далее.
 */
const NAV_TOGGLE_ID = 'nav-toggle';

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

  return (
    <div className="flex min-h-screen">
      {/*
        Чекбокс не отрисовывает ничего сам — управляет панелью и подложкой
        через `peer-checked:` у обоих (DESIGN §11а, мобильная версия).
        На md и шире не влияет: там панель закреплена классами `md:*`
        независимо от состояния чекбокса.
      */}
      {/*
        `sr-only`, а не `hidden`: `display: none` убрал бы чекбокс и из потока
        табуляции — без него открыть панель с клавиатуры было бы нечем
        (DESIGN §32: «интерфейс непроходим без видимого фокуса» — здесь
        тот же принцип, фокус просто на невидимом элементе, а не потерян).
        Пробел на сфокусированном чекбоксе переключает его нативно, без JS.
      */}
      <input
        type="checkbox"
        id={NAV_TOGGLE_ID}
        aria-label={t('nav.menu')}
        className="peer sr-only"
      />

      {/* Подложка: видна только на телефоне и только при открытой панели. Тап закрывает — тот же чекбокс. */}
      <label
        htmlFor={NAV_TOGGLE_ID}
        aria-hidden
        className="fixed inset-0 z-30 hidden bg-black/40 peer-checked:block md:hidden"
      />

      {/*
        На телефоне панель — выезжающий поверх контента слой (fixed,
        сдвинут за левый край, выезжает по `peer-checked:`). На md и шире —
        обычная панель в потоке, прибитая к высоте экрана: без этого
        на длинной странице блок пользователя уезжает вниз вместе со списком,
        и переключатель языка с кнопкой выхода становится не достать —
        именно это и случилось при первой проверке.
      */}
      <aside className="fixed inset-y-0 left-0 z-40 flex h-screen w-64 max-w-[85vw] -translate-x-full flex-col justify-between border-r border-[var(--color-sidebar-border)] bg-[var(--color-sidebar-bg)] bg-[image:var(--gradient-sidebar)] text-[var(--color-sidebar-fg)] transition-transform duration-200 ease-out peer-checked:translate-x-0 md:sticky md:top-0 md:w-60 md:max-w-none md:translate-x-0">
        <div className="flex min-h-0 flex-col overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-5">
            <Link href="/properties" className="flex items-center gap-2 text-base tracking-tight">
              <img src="/brand/mark.png" alt="" className="size-7 object-contain" />
              <Wordmark tone="dark" className="text-base" />
            </Link>

            {/* Закрыть панель — только на телефоне, на md её и так видно всегда. */}
            <label
              htmlFor={NAV_TOGGLE_ID}
              aria-label={t('nav.closeMenu')}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-sidebar-fg-muted)] hover:bg-[var(--color-sidebar-hover-bg)] hover:text-[var(--color-sidebar-fg)] md:hidden"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="size-4"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </label>
          </div>

          <nav className="flex flex-col gap-0.5 px-3">
            {nav.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} toggleId={NAV_TOGGLE_ID}>
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
            {/* Цвет кружка выведен из имени и потому одинаков везде:
                в панели, в списке объектов, в задачах. Свой цвет узнаёшь
                раньше, чем прочитаешь имя. */}
            <Avatar name={user.fullName} />
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

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Верхняя полоса — только на телефоне: там панель не видна, пока её не открыли. */}
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 md:hidden">
          <label
            htmlFor={NAV_TOGGLE_ID}
            aria-label={t('nav.menu')}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-primary)]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="size-5"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </label>
          <Wordmark className="text-sm" />
        </header>

        {/*
          Полоса содержимого ограничена, но широко: на мониторе 1920 контент
          занимал половину экрана, а вторая половина оставалась белой пустотой.
          Совсем без предела строки текста растянулись бы на всю ширину
          и стали бы нечитаемыми, поэтому предел есть — просто вдвое дальше.
        */}
        <main className="mx-auto min-w-0 w-full max-w-[1600px] flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
