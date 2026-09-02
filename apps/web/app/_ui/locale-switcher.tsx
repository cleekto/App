'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { LOCALES, type Locale } from '@cleekto/i18n';

/**
 * Переключатель языка.
 *
 * ЧТО ОН МЕНЯЕТ. Всегда — cookie `cleekto_locale`, то есть выбор на этом
 * устройстве. Дополнительно, если человек вошёл, — язык в его профиле,
 * чтобы выбор пережил другой браузер и достался расширению.
 *
 * Названия языков написаны каждое на своём языке и не переводятся: человек,
 * который не читает по-русски, должен узнать «ქართული» независимо от того,
 * на каком языке сейчас интерфейс. Поэтому здесь и нет обращения к словарю —
 * это не нарушение правила 18, а его смысл.
 */
const LABELS: Record<Locale, string> = {
  ka: 'ქართული',
  en: 'English',
  ru: 'Русский',
};

export function LocaleSwitcher({
  current,
  persist,
  ariaLabel,
}: {
  current: Locale;
  /** Сохранять ли выбор в профиль. Ложь на странице входа: профиля ещё нет. */
  persist: boolean;
  ariaLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    // Перенос разрешён: в боковой панели три полных названия в строку
    // не помещаются, а сокращать их нельзя — «ქართული» человек должен узнать
    // независимо от того, на каком языке сейчас интерфейс.
    <div className="flex flex-wrap items-center gap-0.5" role="group" aria-label={ariaLabel}>
      {LOCALES.map((locale) => {
        const active = locale === current;

        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            aria-pressed={active}
            disabled={busy || active}
            onClick={() => {
              setBusy(true);

              // Cookie ставится сразу и на клиенте: язык страницы входа
              // должен меняться и тогда, когда сервер о человеке ничего
              // не знает. `max-age` — год: это предпочтение, а не сессия.
              document.cookie = `cleekto_locale=${locale}; path=/; max-age=31536000; samesite=lax`;

              const done = (): void => {
                router.refresh();
                setBusy(false);
              };

              if (!persist) {
                done();
                return;
              }

              void fetch('/api/v1/auth/locale', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ locale }),
              })
                // Профиль не сохранился — язык всё равно сменился на этом
                // устройстве. Ронять переключение из-за этого не за что.
                .catch(() => undefined)
                .finally(done);
            }}
            className={`rounded-[var(--radius-control)] px-1.5 py-1 text-xs font-medium transition-colors ${
              active
                ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-text)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {LABELS[locale]}
          </button>
        );
      })}
    </div>
  );
}
