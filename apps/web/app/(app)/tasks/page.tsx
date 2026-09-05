import Link from 'next/link';

import { listFollowUps, listTasks } from '@kleekto/core';
import { formatDateTime, translate } from '@kleekto/i18n';

import { dueLine } from '../../_lib/format';
import { contextLocale, requireContext } from '../../_lib/session';
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
export default async function TasksPage() {
  const ctx = await requireContext();
  const locale = contextLocale(ctx);

  const [followUps, tasks] = await Promise.all([
    listFollowUps(ctx),
    listTasks(ctx, { mine: true, status: 'open' }),
  ]);

  const t = (key: Parameters<typeof translate>[1]): string => translate(locale, key);

  return (
    /*
     * Две колонки на широком экране: страница задач была двумя строками
     * серого текста в левом верхнем углу пустого монитора. Пустое состояние
     * — это тоже состояние, и выглядеть оно должно как спокойный ответ,
     * а не как несработавшая загрузка.
     */
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('task.title')}</h1>

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

          {tasks.length === 0 ? (
            <QuietState text={t('task.empty')} />
          ) : (
            <ul className="flex flex-col gap-2">
              {tasks.map((task) => (
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
    <div className="flex items-center gap-3 rounded-[var(--radius-card)] bg-[var(--color-surface)] px-4 py-6 shadow-[var(--shadow-card)] supports-[backdrop-filter]:bg-[var(--color-glass)] supports-[backdrop-filter]:backdrop-blur-[var(--blur-glass)]">
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
