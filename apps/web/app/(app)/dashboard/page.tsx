import { dashboard } from '@cleekto/core';
import { formatNumber, translate } from '@cleekto/i18n';
import type { MessageKey } from '@cleekto/i18n';

import { contextLocale, requireContext } from '../../_lib/session';

/**
 * Сводка — DESIGN §12.
 *
 * Область не выбирается: её задаёт роль. Администратор видит компанию,
 * менеджер и агент — свою команду, и это написано на экране, чтобы никто
 * не сравнивал свои цифры с чужими, не заметив разной базы.
 *
 * У каждого раздела качества есть пояснение. Метрика без объяснения либо
 * не читается, либо читается неверно: «упёрлись в дубль 40%» без строки
 * «это значит, что команды звонят одним и тем же» выглядит как авария.
 */
export default async function DashboardPage() {
  const ctx = await requireContext();
  const locale = contextLocale(ctx);
  const data = await dashboard(ctx);

  const t = (key: MessageKey): string => translate(locale, key);
  const n = (value: number): string => formatNumber(locale, value);
  const percent = (value: number): string => `${formatNumber(locale, Math.round(value * 100))}%`;

  const headline = [
    { label: t('dashboard.newToday'), value: n(data.properties.createdToday) },
    { label: t('dashboard.newThisWeek'), value: n(data.properties.createdThisWeek) },
    { label: t('dashboard.totalProperties'), value: n(data.properties.total) },
  ];

  const quality = [
    {
      label: t('dashboard.duplicateRate'),
      value: percent(data.quality.duplicateRate),
      hint: t('dashboard.duplicateHint'),
    },
    {
      label: t('dashboard.parserFailureRate'),
      value: percent(data.quality.parserFailureRate),
      hint: t('dashboard.parserHint'),
    },
  ];

  const publishing = [
    { label: t('dashboard.filledToday'), value: n(data.publishing.filledToday) },
    { label: t('dashboard.filledThisWeek'), value: n(data.publishing.filledThisWeek) },
    { label: t('dashboard.publishedThisWeek'), value: n(data.publishing.publishedThisWeek) },
    { label: t('dashboard.publishedShare'), value: percent(data.publishing.publishedShare) },
    { label: t('dashboard.averageUnfilled'), value: n(data.publishing.averageUnfilled) },
    { label: t('dashboard.fillFailureRate'), value: percent(data.publishing.fillFailureRate) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('dashboard.title')}</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {data.scope === 'company' ? t('dashboard.scopeCompany') : t('dashboard.scopeTeam')}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {headline.map((tile) => (
          <div
            key={tile.label}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
          >
            <p className="text-xs text-[var(--color-text-secondary)]">{tile.label}</p>
            <p className="mt-1 text-2xl font-semibold">{tile.value}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">{t('dashboard.byStatus')}</h2>
        <ul className="flex flex-col gap-1">
          {data.properties.byStatus.map((status) => (
            <li
              key={status.statusId}
              className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm"
            >
              <span>{status.statusName}</span>
              <span className="font-semibold">{n(status.count)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">{t('dashboard.people')}</h2>
        {data.people.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">{t('dashboard.noData')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {data.people.map((person) => {
              const consents = `${t('dashboard.consentsThisWeek')}: ${n(person.consentsThisWeek)}`;
              const owned = `${t('dashboard.propertiesOwned')}: ${n(person.propertiesOwned)}`;

              return (
                <li
                  key={person.userId}
                  className="flex items-center justify-between gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">{person.fullName}</span>
                  <span className="shrink-0 text-xs text-[var(--color-text-secondary)]">
                    {consents}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--color-text-secondary)]">
                    {owned}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">{t('dashboard.quality')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {quality.map((tile) => (
            <div
              key={tile.label}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
            >
              <p className="text-xs text-[var(--color-text-secondary)]">{tile.label}</p>
              <p className="mt-1 text-2xl font-semibold">{tile.value}</p>
              <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{tile.hint}</p>
            </div>
          ))}
        </div>

        {data.quality.topMissingFields.length === 0 ? null : (
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
            <p className="text-xs text-[var(--color-text-secondary)]">
              {t('dashboard.topMissing')}
            </p>
            <ul className="mt-2 flex flex-wrap gap-2 text-sm">
              {data.quality.topMissingFields.map((entry) => (
                <li key={entry.field} className="rounded-lg bg-[var(--color-background)] px-2 py-1">
                  {[entry.field, n(entry.count)].join(' · ')}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">{t('dashboard.publishing')}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {publishing.map((tile) => (
            <div
              key={tile.label}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
            >
              <p className="text-xs text-[var(--color-text-secondary)]">{tile.label}</p>
              <p className="mt-1 text-xl font-semibold">{tile.value}</p>
            </div>
          ))}
        </div>

        {data.publishing.chronicallyUnfilled.length === 0 ? null : (
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
            <p className="text-xs text-[var(--color-text-secondary)]">
              {t('dashboard.chronicallyUnfilled')}
            </p>
            <ul className="mt-2 flex flex-wrap gap-2 text-sm">
              {data.publishing.chronicallyUnfilled.map((entry) => (
                <li key={entry.field} className="rounded-lg bg-[var(--color-background)] px-2 py-1">
                  {[entry.field, percent(entry.share)].join(' · ')}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
              {t('dashboard.chronicHint')}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
