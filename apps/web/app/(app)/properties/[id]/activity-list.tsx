import { formatDateTime, translate, type Locale, type MessageKey } from '@kleekto/i18n';

interface Entry {
  id: string;
  action: string;
  actorName: string | null;
  createdAt: string;
}

/**
 * История объекта — DESIGN §19.
 *
 * НАЗВАНИЕ ДЕЙСТВИЯ БЕРЁТСЯ ИЗ СЛОВАРЯ. Раньше здесь показывался код как
 * есть — `PROPERTY_STATUS_CHANGED`, — и грузинский агент видел латиницу
 * капсом посреди грузинского интерфейса. Это откладывалось до фазы 8 вместе
 * с аналитикой; фаза закрыта, словарь заведён.
 *
 * Ключ приводится к `MessageKey` приведением типа: набор кодов закрытый
 * и наш собственный, но живёт он в другом пакете, и вывести из него тип
 * ключа нельзя. Пропущенный перевод виден дырой `⟦ключ⟧` и ловится тестом
 * полноты словарей.
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
              <p className="font-medium">
                {translate(locale, `activityAction.${entry.action}` as MessageKey)}
              </p>
              <p className="text-[var(--color-text-secondary)]">{meta}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
