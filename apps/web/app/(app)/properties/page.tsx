import Link from 'next/link';
import { EmptyState, PageHeader } from '../../_ui/primitives';

import { listPipelineStatuses, listProperties } from '@kleekto/core';
import { translate } from '@kleekto/i18n';

import { factsLine, kindLine, placeLine, priceLine, statusLabel } from '../../_lib/format';
import { contextLocale, requireContext } from '../../_lib/session';
import { PropertyFilters } from './filters';

/**
 * Список объектов — DESIGN §13.
 *
 * Плотный, сканируемый, с поиском наверху. Агент приходит сюда с вопросом
 * «где тот объект», а не «покажи мне всё».
 */
export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireContext();
  const locale = contextLocale(ctx);
  const params = await searchParams;

  const single = (key: string): string | undefined => {
    const value = params[key];
    return typeof value === 'string' && value !== '' ? value : undefined;
  };

  const [{ items, total }, statuses] = await Promise.all([
    listProperties(ctx, {
      query: single('query'),
      pipelineStatusId: single('status'),
      propertyType: single('type') as never,
    }),
    listPipelineStatuses(ctx),
  ]);

  const t = (key: Parameters<typeof translate>[1]): string => translate(locale, key);
  const foundLine = `${String(total)} ${t('property.found')}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('nav.properties')}
        action={<p className="text-sm text-[var(--color-text-secondary)]">{foundLine}</p>}
      />

      <PropertyFilters
        labels={{
          search: t('property.search'),
          reset: t('property.reset'),
          allStatuses: t('property.allStatuses'),
          allTypes: t('property.allTypes'),
          apartment: t('property.type.APARTMENT'),
          house: t('property.type.HOUSE'),
          land: t('property.type.LAND'),
          commercial: t('property.type.COMMERCIAL'),
        }}
        statuses={statuses.map((status) => ({ id: status.id, name: statusLabel(locale, status) }))}
      />

      {items.length === 0 ? (
        <EmptyState title={t('property.empty')} hint={t('property.emptyHint')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/properties/${item.id}`}
                className="flex items-start justify-between gap-6 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-card)] transition-colors hover:border-[var(--color-brand)] hover:bg-[var(--color-surface-muted)]"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{kindLine(locale, item)}</p>
                  <p className="truncate text-sm text-[var(--color-text-secondary)]">
                    {factsLine(locale, item)}
                  </p>
                  {placeLine(item) === '' ? null : (
                    <p className="truncate text-sm text-[var(--color-text-secondary)]">
                      {placeLine(item)}
                    </p>
                  )}
                  {item.sharedWithOtherTeam ? (
                    <p className="mt-1 text-xs text-[var(--color-warning)]">
                      {t('property.sharedWithOtherTeam')}
                    </p>
                  ) : null}
                </div>

                <div className="shrink-0 text-right">
                  <p className="font-semibold">{priceLine(locale, item)}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {item.pipelineStatusName}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {item.assignedUserName ?? t('property.unassigned')}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
