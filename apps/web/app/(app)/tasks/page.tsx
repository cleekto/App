import Link from 'next/link';

import { listFollowUps, listProperties, listTasks } from '@kleekto/core';
import { formatDateTime, MARKET_TIME_ZONE, translate } from '@kleekto/i18n';

import { dueLine, kindLine, placeLine } from '../../_lib/format';
import { contextLocale, requireContext } from '../../_lib/session';
import { TaskCalendar, type CalendarDay } from './calendar';
import { NewTask } from './new-task';
import { TaskRow } from './task-row';

/**
 * Задачи и фоллоу-апы.
 *
 * ДВА РАЗНЫХ СПИСКА, И ПУТАТЬ ИХ НЕЛЬЗЯ. Задача относится к объекту, который
 * уже в базе. Фоллоу-ап — к объявлению, по которому агент договорился
 * перезвонить: объекта там ещё нет и не будет, пока собственник не согласится
 * (инвариант 10).
 *
 * Перезвоны идут первыми: у них наступил срок, и это то, ради чего агент
 * открыл страницу.
 */
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireContext();
  const locale = contextLocale(ctx);
  const params = await searchParams;

  const [followUps, tasks, { items: properties }] = await Promise.all([
    listFollowUps(ctx),
    listTasks(ctx, { mine: true, status: 'open' }),
    listProperties(ctx, { limit: 100 }),
  ]);

  const t = (key: Parameters<typeof translate>[1]): string => translate(locale, key);

  /*
   * ДЕНЬ СЧИТАЕТСЯ ПО ТБИЛИСИ, а не по часам сервера. Приложение живёт
   * в облаке по UTC, и разница в четыре часа приходится ровно на начало
   * суток: задача, назначенная на два часа ночи, попадала бы во вчерашнюю
   * клетку календаря.
   */
  const dayKey = (value: Date): string =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: MARKET_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(value);

  const today = dayKey(new Date());
  const activeDate = typeof params['date'] === 'string' ? params['date'] : null;

  // Сколько задач приходится на каждый день и есть ли среди них просроченные.
  const byDay = new Map<string, { count: number; hasOverdue: boolean }>();
  for (const task of tasks) {
    if (task.dueAt === null) continue;
    const key = dayKey(new Date(task.dueAt));
    const current = byDay.get(key) ?? { count: 0, hasOverdue: false };
    byDay.set(key, { count: current.count + 1, hasOverdue: current.hasOverdue || task.overdue });
  }

  /*
   * Сетка месяца. Неделя начинается с понедельника: так считают и в Грузии,
   * и в России — воскресенье первым выглядело бы чужим календарём.
   */
  const anchor = activeDate === null ? new Date() : new Date(`${activeDate}T12:00:00`);
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const shift = (first.getDay() + 6) % 7;
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - shift);

  const days: CalendarDay[] = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index,
    );
    const key = dayKey(date);
    const stats = byDay.get(key) ?? { count: 0, hasOverdue: false };

    return {
      date: key,
      label: String(date.getDate()),
      isOutside: date.getMonth() !== first.getMonth(),
      isToday: key === today,
      count: stats.count,
      hasOverdue: stats.hasOverdue,
    };
  });

  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale === 'ka' ? 'ka-GE' : locale === 'en' ? 'en-GB' : 'ru-RU', {
      weekday: 'short',
      timeZone: MARKET_TIME_ZONE,
      // 2026-01-05 — понедельник, дальше по порядку.
    }).format(new Date(2026, 0, 5 + index)),
  );

  const monthLabel = new Intl.DateTimeFormat(
    locale === 'ka' ? 'ka-GE' : locale === 'en' ? 'en-GB' : 'ru-RU',
    { month: 'long', year: 'numeric', timeZone: MARKET_TIME_ZONE },
  ).format(first);

  // Показываются задачи выбранного дня, а без выбора — все открытые.
  const shown =
    activeDate === null
      ? tasks
      : tasks.filter((task) => task.dueAt !== null && dayKey(new Date(task.dueAt)) === activeDate);

  return (
    /*
     * Две колонки на широком экране: страница задач была двумя строками
     * серого текста в левом верхнем углу пустого монитора. Пустое состояние
     * — это тоже состояние, и выглядеть оно должно как спокойный ответ,
     * а не как несработавшая загрузка.
     */
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t('task.title')}</h1>

        <NewTask
          properties={properties.map((property) => ({
            id: property.id,
            // Объект называют тем же, чем он назван везде: тип, комнаты,
            // площадь и место. Отдельного имени у объекта нет и не будет.
            name: [kindLine(locale, property), placeLine(property)]
              .filter((part) => part !== '')
              .join(' · '),
          }))}
          labels={{
            open: t('task.add'),
            title: t('task.titleField'),
            property: t('nav.properties'),
            due: t('task.dueField'),
            submit: t('common.save'),
            cancel: t('common.cancel'),
            saving: t('common.loading'),
            failed: t('task.addFailed'),
            noProperties: t('task.noProperties'),
          }}
        />
      </header>

      <TaskCalendar
        title={t('task.calendar')}
        monthLabel={monthLabel}
        weekdays={weekdays}
        days={days}
        activeDate={activeDate}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{t('task.followUps')}</h2>

          {followUps.length === 0 ? (
            <QuietState text={t('task.noFollowUps')} />
          ) : (
            <ul className="flex flex-col gap-2">
              {followUps.map((followUp) => (
                <li
                  key={followUp.observationId}
                  className="flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
                >
                  <div className="min-w-0">
                    <a
                      href={followUp.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-[var(--color-brand)]"
                    >
                      {followUp.source}
                    </a>
                    <p className="truncate text-xs text-[var(--color-text-secondary)]">
                      {[followUp.district, followUp.note]
                        .filter((part) => part !== null)
                        .join(' · ')}
                    </p>
                  </div>

                  <p
                    className={
                      followUp.overdue
                        ? 'shrink-0 text-xs text-[var(--color-danger)]'
                        : 'shrink-0 text-xs text-[var(--color-text-secondary)]'
                    }
                  >
                    {formatDateTime(locale, new Date(followUp.callbackAt))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{t('task.mine')}</h2>

          {shown.length === 0 ? (
            <QuietState text={t('task.empty')} />
          ) : (
            <ul className="flex flex-col gap-2">
              {shown.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
                >
                  <div className="min-w-0">
                    <Link href={`/properties/${task.propertyId}`} className="text-sm font-medium">
                      {task.title}
                    </Link>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {[
                        task.dueAt === null ? null : dueLine(locale, task.dueAt),
                        task.overdue ? t('task.overdue') : null,
                      ]
                        .filter((part) => part !== null && part !== '')
                        .join(' · ')}
                    </p>
                  </div>

                  <TaskRow taskId={task.id} doneLabel={t('task.done')} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Спокойный ответ вместо серой строки.
 *
 * «Перезвонов на сегодня нет» — это хорошая новость, а не сбой. Набранная
 * мелким серым в углу пустого экрана, она читалась как «ничего
 * не загрузилось».
 */
function QuietState({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-6 shadow-[var(--shadow-card)]">
      <span
        aria-hidden
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-success-soft)] text-[var(--color-success)]"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
        >
          <path d="m5 13 4 4L19 7" />
        </svg>
      </span>
      <p className="text-sm text-[var(--color-text-secondary)]">{text}</p>
    </div>
  );
}
