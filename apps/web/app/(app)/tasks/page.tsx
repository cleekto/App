import Link from 'next/link';

import { listFollowUps, listTasks } from '@cleekto/core';
import { formatDateTime, translate } from '@cleekto/i18n';

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
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t('task.title')}</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">{t('task.followUps')}</h2>

        {followUps.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">{t('task.noFollowUps')}</p>
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
                    {[followUp.district, followUp.note].filter((part) => part !== null).join(' · ')}
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
          <p className="text-sm text-[var(--color-text-secondary)]">{t('task.empty')}</p>
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
  );
}
