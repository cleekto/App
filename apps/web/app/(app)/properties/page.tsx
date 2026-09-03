import Link from 'next/link';
import { Badge, Card, EmptyState, PageHeader } from '../../_ui/primitives';

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
        /*
         * ОДНА ПОВЕРХНОСТЬ, СТРОКИ ВНУТРИ — а не двадцать одна отдельная
         * карточка с зазорами.
         *
         * Карточка обособляет то, что внутри неё, от всего остального.
         * Когда карточек столько же, сколько строк, обособлять нечего:
         * получается рябь из одинаковых прямоугольников, по которой глаз
         * не может идти сверху вниз. Список — это список: общий лист,
         * волосяные линии, ровные колонки.
         */
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--color-border)]">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/properties/${item.id}`}
                  className="grid grid-cols-[1fr_auto] items-center gap-6 px-4 py-3 transition-colors duration-[var(--duration-fast)] [@media(hover:hover)and(pointer:fine)]:hover:bg-[var(--color-surface-muted)]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[0.9375rem] leading-5 font-medium">
                      {kindLine(locale, item)}
                    </p>
                    <p className="mt-0.5 truncate text-[0.8125rem] leading-5 text-[var(--color-text-secondary)]">
                      {[factsLine(locale, item), placeLine(item)].filter(Boolean).join(' · ')}
                    </p>
                    {item.sharedWithOtherTeam ? (
                      <p className="mt-1 text-[0.75rem] text-[var(--color-warning)]">
                        {t('property.sharedWithOtherTeam')}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-4">
                    <div className="text-right">
                      {/* Цена — якорь строки: по ней список и просматривают.
                          Раньше она была того же веса, что и тип объекта,
                          и глазу не за что было зацепиться. */}
                      <p className="text-[0.9375rem] leading-5 font-semibold">
                        {priceLine(locale, item)}
                      </p>
                      <p className="mt-0.5 truncate text-[0.75rem] leading-4 text-[var(--color-text-tertiary)]">
                        {item.assignedUserName ?? t('property.unassigned')}
                      </p>
                    </div>

                    <span className="w-36 shrink-0">
                      <Badge tone="neutral">
                        {statusLabel(locale, {
                          code: item.pipelineStatusCode,
                          name: item.pipelineStatusName,
                          nameIsCustom: item.pipelineStatusNameIsCustom,
                        })}
                      </Badge>
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
