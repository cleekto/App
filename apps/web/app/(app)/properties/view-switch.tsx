import Link from 'next/link';

/**
 * Переключатель «списком / плитками» (§20 задания).
 *
 * ПОЧЕМУ ССЫЛКИ, А НЕ КНОПКИ С СОСТОЯНИЕМ. Режим живёт в адресе страницы,
 * и это даёт три вещи бесплатно: он переживает перезагрузку, его можно
 * послать коллеге ссылкой, и страница остаётся серверной — ни строчки
 * состояния в браузере. Переключатель на клиентском состоянии всё это
 * потерял бы и потребовал бы клиентского компонента ради двух кнопок.
 *
 * Остальные параметры (поиск, фильтры) переносятся как есть: переключение
 * вида не должно сбрасывать то, что агент уже набрал.
 */

export type PropertyView = 'list' | 'grid';

const ICONS: Record<PropertyView, React.ReactNode> = {
  list: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </>
  ),
};

export function ViewSwitch({
  current,
  params,
  labels,
}: {
  current: PropertyView;
  /** Уже набранные параметры страницы — переносятся без изменений. */
  params: Record<string, string | string[] | undefined>;
  labels: { list: string; grid: string };
}) {
  const hrefFor = (view: PropertyView): string => {
    const next = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (key === 'view') continue;
      if (typeof value === 'string' && value !== '') next.set(key, value);
    }

    // Список — вид по умолчанию, и в адресе он не пишется: чистая ссылка
    // на раздел должна открывать список, а не режим, выбранный кем-то раньше.
    if (view === 'grid') next.set('view', 'grid');

    const query = next.toString();
    return query === '' ? '/properties' : `/properties?${query}`;
  };

  return (
    <div className="inline-flex shrink-0 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
      {(['list', 'grid'] as const).map((view) => {
        const active = view === current;

        return (
          <Link
            key={view}
            href={hrefFor(view)}
            aria-current={active ? 'page' : undefined}
            title={view === 'list' ? labels.list : labels.grid}
            className={`inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] transition-colors duration-[var(--duration-fast)] ${
              active
                ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-text)]'
                : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
            >
              {ICONS[view]}
            </svg>
          </Link>
        );
      })}
    </div>
  );
}
