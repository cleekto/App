import Link from 'next/link';

import { Avatar, stageColors } from '../../_ui/accent';

/**
 * Общая лента: что происходит в компании, одной страницей.
 *
 * СЮДА ЧЕЛОВЕК ПОПАДАЕТ, ПОКА НЕ ЗАШЁЛ В КОМНАТУ (решение владельца).
 * Раньше по умолчанию открывалась первая комната списка — произвол:
 * почему именно она. Лента отвечает на вопрос «что вообще происходит»,
 * комната — «что происходит вот здесь».
 *
 * ТОЛЬКО ДЛЯ ЧТЕНИЯ, и поля ввода здесь нет намеренно. Писать «в ленту»
 * некуда: у сообщения обязана быть комната, иначе непонятно, кому оно
 * адресовано. Поэтому у каждой строки видно, откуда она, и по ней
 * переходят в саму комнату — там и отвечают.
 *
 * Личной переписки в ленте нет: её видят только двое.
 */

/** Разделитель между именами файлов. Тот же, что в остальных перечислениях. */
const SEPARATOR = ' · ';

export interface FeedRow {
  id: string;
  body: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  timeLabel: string;
  isDeleted: boolean;
  /** Приложенные файлы. В ленте — только упоминание: читают её, а не открывают. */
  attachments: Array<{ id: string; fileName: string }>;
  roomId: string;
  roomName: string;
  roomColorToken: string | null;
}

export function CompanyFeed({
  items,
  labels,
}: {
  items: FeedRow[];
  labels: { title: string; hint: string; empty: string };
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-[var(--color-border)] px-4 py-2.5">
        <p className="text-sm font-semibold">{labels.title}</p>
        <p className="text-xs text-[var(--color-text-tertiary)]">{labels.hint}</p>
      </div>

      {items.length === 0 ? (
        <p className="m-auto text-sm text-[var(--color-text-secondary)]">{labels.empty}</p>
      ) : (
        <ul className="flex-1 divide-y divide-[var(--color-border)] overflow-y-auto">
          {items.map((item) => {
            const colors = stageColors(item.roomColorToken);

            return (
              <li key={item.id}>
                <Link
                  href={`/chat?room=${item.roomId}`}
                  className="flex gap-3 px-4 py-3 transition-colors duration-[var(--duration-fast)] [@media(hover:hover)and(pointer:fine)]:hover:bg-[var(--color-surface-muted)]"
                >
                  <Avatar name={item.authorName} src={item.authorAvatarUrl} size="sm" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-medium">{item.authorName}</span>

                      {/* Откуда сообщение — меткой цвета комнаты: в общей
                          ленте это первое, что нужно знать. */}
                      <span
                        className="rounded-[var(--radius-pill)] px-2 py-0.5 text-[0.6875rem] font-medium"
                        style={{
                          color: colors.fg,
                          backgroundColor: colors.bg,
                        }}
                      >
                        {item.roomName}
                      </span>

                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        {item.timeLabel}
                      </span>
                    </div>

                    <p
                      className={`mt-0.5 text-sm break-words ${
                        item.isDeleted
                          ? 'text-[var(--color-text-tertiary)] italic'
                          : 'text-[var(--color-text-secondary)]'
                      }`}
                    >
                      {item.body}
                    </p>

                    {/* Файлы в ленте только УПОМИНАЮТСЯ: лента отвечает
                        на вопрос «что происходит», а открывают файл
                        в самой комнате, куда эта строка и ведёт. */}
                    {item.attachments.length === 0 ? null : (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                          className="size-3.5 shrink-0"
                        >
                          <path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.2-9.2a3.67 3.67 0 0 1 5.18 5.18l-9.2 9.2a1.83 1.83 0 1 1-2.6-2.6l8.5-8.48" />
                        </svg>
                        <span className="truncate">
                          {item.attachments.map((file) => file.fileName).join(SEPARATOR)}
                        </span>
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
