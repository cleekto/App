import Link from 'next/link';

/**
 * Календарь задач на месяц.
 *
 * ЗАЧЕМ ОН РЯДОМ СО СПИСКОМ. Список отвечает «что делать сейчас», календарь
 * — «когда станет тесно». Агент планирует показы и звонки на неделю вперёд,
 * и три задачи, случайно назначенные на один четверг, видны только сеткой:
 * в списке они разъезжаются по строкам и выглядят как три обычные записи.
 *
 * СОБИРАЕТСЯ НА СЕРВЕРЕ, и это не мелочь. Сетка месяца зависит от того,
 * с какого дня начинается неделя и как называются месяцы, — то есть
 * от локали, а звать `Intl` в браузере агента в этом проекте запрещено:
 * у него может не быть данных грузинской локали. Поэтому сюда приезжают
 * готовые подписи, а компонент только раскладывает их по клеткам.
 *
 * Строк здесь нет — всё приходит из словаря (правило 18).
 */

export interface CalendarDay {
  /** `ГГГГ-ММ-ДД` — ключ и одновременно то, что уходит в адрес. */
  date: string;
  /** Число месяца, уже написанное. */
  label: string;
  /** День не из этого месяца — показывается приглушённым. */
  isOutside: boolean;
  isToday: boolean;
  /** Сколько задач с этим сроком. */
  count: number;
  /** Есть ли среди них просроченные. */
  hasOverdue: boolean;
}

export function TaskCalendar({
  title,
  monthLabel,
  weekdays,
  days,
  activeDate,
}: {
  title: string;
  monthLabel: string;
  /** Подписи дней недели в том порядке, в каком идут клетки. */
  weekdays: string[];
  days: CalendarDay[];
  activeDate: string | null;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-sm text-[var(--color-text-secondary)]">{monthLabel}</span>
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-7 gap-1">
          {weekdays.map((day, index) => (
            <span
              key={`${day}-${String(index)}`}
              className="pb-1 text-center text-[0.6875rem] font-medium text-[var(--color-text-tertiary)]"
            >
              {day}
            </span>
          ))}

          {days.map((day) => {
            const selected = day.date === activeDate;

            /*
             * Пустой день — не ссылка. Нажимать на клетку, за которой ничего
             * нет, бессмысленно, и курсор об этом сообщать не должен.
             */
            const content = (
              <>
                <span className="text-[0.8125rem] tabular-nums">{day.label}</span>

                {day.count === 0 ? (
                  // Место под точку занято всегда: иначе числа в клетках
                  // прыгали бы вверх-вниз в зависимости от наличия задач.
                  <span aria-hidden className="mt-0.5 block size-1.5" />
                ) : (
                  <span
                    aria-hidden
                    className={`mt-0.5 block size-1.5 rounded-full ${
                      day.hasOverdue ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-brand)]'
                    }`}
                  />
                )}
              </>
            );

            const shell = `flex aspect-square flex-col items-center justify-center rounded-[var(--radius-sm)] ${
              day.isOutside ? 'text-[var(--color-text-tertiary)]' : ''
            } ${day.isToday ? 'font-semibold ring-1 ring-[var(--color-brand)]' : ''} ${
              selected ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-text)]' : ''
            }`;

            if (day.count === 0) {
              return (
                <span key={day.date} className={shell}>
                  {content}
                </span>
              );
            }

            return (
              <Link
                key={day.date}
                href={`/tasks?date=${day.date}`}
                className={`${shell} transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-muted)]`}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
