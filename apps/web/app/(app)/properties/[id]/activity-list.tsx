import { formatDateTime, type Locale } from '@kleekto/i18n';

interface Entry {
  id: string;
  action: string;
  actorName: string | null;
  createdAt: string;
}

/**
 * История объекта — DESIGN §19.
 *
 * Коды действий показываются как есть: осмысленные названия им даст фаза 8
 * вместе с аналитикой, где тот же словарь понадобится для графиков.
 * Придумывать перевод сейчас значило бы завести второй словарь действий.
 */
export function ActivityList({
  entries,
  locale,
  title,
}: {
  entries: Entry[];
  locale: Locale;
  title: string;
}) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h2 className="text-sm font-semibold">{title}</h2>

      <ol className="mt-3 flex flex-col gap-2">
        {entries.map((entry) => {
          const meta = [entry.actorName, formatDateTime(locale, new Date(entry.createdAt))]
            .filter((part) => part !== null)
            .join(' · ');

          return (
            <li key={entry.id} className="text-xs">
              <p className="font-medium">{entry.action}</p>
              <p className="text-[var(--color-text-secondary)]">{meta}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
