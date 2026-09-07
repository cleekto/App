import { CopyButton } from '../../../_ui/copy-button';

/**
 * Поля для формы площадки — в её порядке, каждое со своей кнопкой.
 *
 * Агент переносит два десятка значений, глядя попеременно в две вкладки.
 * Порядок здесь тот же, в каком их спрашивает форма, — иначе он каждый раз
 * ищет глазами нужную строку, а это и есть та беготня, ради которой всё
 * затевалось.
 *
 * Показ, а не поле ввода: значение уже готово, править его здесь нечего.
 */

export function ListingFields({
  fields,
  labels,
}: {
  fields: Array<{ label: string; value: string }>;
  labels: { title: string; hint: string; copy: string; copied: string };
}) {
  if (fields.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm font-semibold">{labels.title}</p>
      <p className="text-[0.75rem] text-[var(--color-text-tertiary)]">{labels.hint}</p>

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <ul className="divide-y divide-[var(--color-border)]">
          {fields.map((field) => (
            <li
              key={field.label}
              className="flex items-center gap-3 px-3 py-2 transition-colors duration-[var(--duration-fast)] [@media(hover:hover)and(pointer:fine)]:hover:bg-[var(--color-surface-muted)]"
            >
              <span className="w-40 shrink-0 text-[0.75rem] text-[var(--color-text-secondary)]">
                {field.label}
              </span>

              {/* `select-all` — одно нажатие выделяет значение целиком,
                  если агент копирует привычным способом, а не кнопкой. */}
              <span className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] select-all">
                {field.value}
              </span>

              <CopyButton
                text={field.value}
                labels={{ copy: labels.copy, copied: labels.copied }}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
