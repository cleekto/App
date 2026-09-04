import { dashboard } from '@kleekto/core';
import { formatNumber, translate } from '@kleekto/i18n';
import type { MessageKey } from '@kleekto/i18n';

import { statusLabel } from '../../_lib/format';
import { stageColors } from '../../_ui/accent';
import { contextLocale, requireContext } from '../../_lib/session';
import { Card } from '../../_ui/primitives';
import { FunnelRow, Metric, MetricGroup, Rule } from './parts';

/**
 * Аналитика — DESIGN §12.
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

  /*
   * Доля стадии считается от САМОЙ ЗАПОЛНЕННОЙ, а не от общего числа.
   *
   * От общего числа полосы получились бы одинаково короткими: в исправной
   * воронке почти всё лежит в первой стадии, и остальные превратились бы
   * в незаметные чёрточки. От максимума видно соотношение — а именно оно
   * и отвечает на вопрос «где затор».
   */
  const peak = Math.max(...data.properties.byStatus.map((status) => status.count), 1);

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
    <div className="flex max-w-5xl flex-col gap-8">
      <header>
        <h1 className="text-[1.75rem] leading-9 font-semibold tracking-tight">
          {t('dashboard.title')}
        </h1>
        <p className="mt-0.5 text-[0.8125rem] text-[var(--color-text-secondary)]">
          {data.scope === 'company' ? t('dashboard.scopeCompany') : t('dashboard.scopeTeam')}
        </p>
      </header>

      {/* ── Главные числа ────────────────────────────────────────────────── */}
      <MetricGroup columns={3}>
        <Metric size="lg" label={t('dashboard.newToday')} value={n(data.properties.createdToday)} />
        <Metric
          size="lg"
          label={t('dashboard.newThisWeek')}
          value={n(data.properties.createdThisWeek)}
        />
        <Metric size="lg" label={t('dashboard.totalProperties')} value={n(data.properties.total)} />
      </MetricGroup>

      {/* ── Воронка ──────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <Rule title={t('dashboard.byStatus')} />
        <Card>
          <ul className="divide-y divide-[var(--color-border)]">
            {data.properties.byStatus.map((status) => (
              <FunnelRow
                key={status.statusId}
                name={statusLabel(locale, {
                  name: status.statusName,
                  names: status.statusNames,
                })}
                count={n(status.count)}
                share={status.count / peak}
                color={stageColors(status.colorToken).fg}
              />
            ))}
          </ul>
        </Card>
      </section>

      {/* ── Люди ─────────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <Rule title={t('dashboard.people')} />
        {data.people.length === 0 ? (
          <p className="text-[0.8125rem] text-[var(--color-text-secondary)]">
            {t('dashboard.noData')}
          </p>
        ) : (
          <Card>
            <ul className="divide-y divide-[var(--color-border)]">
              {data.people.map((person) => (
                <li
                  key={person.userId}
                  className="grid grid-cols-[1fr_auto_auto] items-baseline gap-6 px-4 py-2.5"
                >
                  <span className="min-w-0 truncate text-[0.8125rem]">{person.fullName}</span>
                  <span className="text-right text-[0.8125rem]">
                    <span className="text-[var(--color-text-secondary)]">
                      {t('dashboard.consentsThisWeek')}
                    </span>
                    <span className="ml-2 font-medium">{n(person.consentsThisWeek)}</span>
                  </span>
                  <span className="w-40 text-right text-[0.8125rem]">
                    <span className="text-[var(--color-text-secondary)]">
                      {t('dashboard.propertiesOwned')}
                    </span>
                    <span className="ml-2 font-medium">{n(person.propertiesOwned)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* ── Качество ─────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <Rule title={t('dashboard.quality')} />

        <MetricGroup columns={2}>
          {quality.map((tile) => (
            <Metric key={tile.label} label={tile.label} value={tile.value} hint={tile.hint} />
          ))}
        </MetricGroup>

        {data.quality.topMissingFields.length === 0 ? null : (
          <Card className="px-4 py-3.5">
            <p className="text-[0.8125rem] text-[var(--color-text-secondary)]">
              {t('dashboard.topMissing')}
            </p>
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {data.quality.topMissingFields.map((entry) => (
                <li
                  key={entry.field}
                  className="rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] px-2 py-1 text-[0.75rem]"
                >
                  {[entry.field, n(entry.count)].join(' · ')}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* ── Публикация ───────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <Rule title={t('dashboard.publishing')} />

        <MetricGroup columns={3}>
          {publishing.map((tile) => (
            <Metric key={tile.label} label={tile.label} value={tile.value} />
          ))}
        </MetricGroup>

        {data.publishing.chronicallyUnfilled.length === 0 ? null : (
          <Card className="px-4 py-3.5">
            <p className="text-[0.8125rem] text-[var(--color-text-secondary)]">
              {t('dashboard.chronicallyUnfilled')}
            </p>
            <p className="mt-1 text-[0.75rem] text-[var(--color-text-tertiary)]">
              {t('dashboard.chronicHint')}
            </p>
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {data.publishing.chronicallyUnfilled.map((entry) => (
                <li
                  key={entry.field}
                  className="rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] px-2 py-1 text-[0.75rem]"
                >
                  {[entry.field, percent(entry.share)].join(' · ')}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}

/**
 * Цвет полосы воронки — один на все стадии.
 *
 * Раскрашивать стадии в разные цвета заманчиво, но цвет тогда перестаёт
 * что-либо значить: в продукте он уже занят — успех, внимание, тревога.
 * Полосе достаточно длины, она сравнивает, а не сигнализирует.
 */
/*
 * Цвет полосы больше не общий: он берётся у самой стадии (`colorToken`),
 * тот же, что на доске. Одноцветная воронка требовала читать подписи, чтобы
 * понять, где какая стадия; теперь она узнаётся так же, как колонка доски.
 */
