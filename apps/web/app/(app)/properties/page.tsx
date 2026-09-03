import Link from 'next/link';
import { Photo } from '../../_ui/photo';
import { NewProperty } from './new-property';
import { Badge, Card, EmptyState, PageHeader } from '../../_ui/primitives';

import { listPipelineStatuses, listProperties, permissionScope } from '@kleekto/core';
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

  // Правило 6: кнопка прячется у того, кому сервер всё равно откажет.
  // Заводить объекты может участник команды — администратор без команды
  // получит отказ, и предлагать ему кнопку незачем.
  const canCreate = permissionScope(ctx.role, 'property', 'create') !== null && ctx.teamId !== null;

  const t = (key: Parameters<typeof translate>[1]): string => translate(locale, key);
  const foundLine = `${String(total)} ${t('property.found')}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('nav.properties')}
        action={
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-sm text-[var(--color-text-secondary)]">{foundLine}</p>
            {canCreate ? (
              <NewProperty
                labels={{
                  trigger: t('property.addManually'),
                  submit: t('common.save'),
                  cancel: t('common.cancel'),
                  saving: t('common.loading'),
                  failed: t('property.addFailed'),
                  ownerName: t('property.ownerName'),
                  ownerPhone: t('property.ownerPhone'),
                  ownerPhoneHint: t('property.ownerPhoneHint'),
                  transactionType: t('property.transactionLabel'),
                  propertyType: t('property.typeLabel'),
                  rooms: t('property.roomsLabel'),
                  area: t('property.areaLabel'),
                  floor: t('property.floorLabel'),
                  totalFloors: t('property.totalFloorsLabel'),
                  district: t('property.districtLabel'),
                  address: t('property.addressLabel'),
                  price: t('property.priceLabel'),
                  currency: t('property.currencyLabel'),
                  duplicateTitle: t('property.duplicateTitle'),
                  duplicateHint: t('property.duplicateHint'),
                  openExisting: t('property.publishCheckOpenExisting'),
                  createAnyway: t('property.createAnyway'),
                }}
                types={[
                  { value: 'APARTMENT', label: t('property.type.APARTMENT') },
                  { value: 'HOUSE', label: t('property.type.HOUSE') },
                  { value: 'LAND', label: t('property.type.LAND') },
                  { value: 'COMMERCIAL', label: t('property.type.COMMERCIAL') },
                ]}
                transactions={[
                  { value: 'SALE', label: t('property.transaction.SALE') },
                  { value: 'RENT', label: t('property.transaction.RENT') },
                ]}
                currencies={CURRENCIES}
              />
            ) : null}
          </div>
        }
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
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3 transition-colors duration-[var(--duration-fast)] [@media(hover:hover)and(pointer:fine)]:hover:bg-[var(--color-surface-muted)]"
                >
                  {/* Недвижимость узнают по картинке, а не по строке
                      «Квартира · Продажа». Без неё двадцать строк подряд
                      неразличимы. */}
                  <Photo src={item.photo} alt={t('property.photoAlt')} className="h-12 w-16" />

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
                          name: item.pipelineStatusName,
                          names: item.pipelineStatusNames,
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

/**
 * Валюты, в которых агентства ведут объекты в Грузии.
 *
 * Доллар первым: цены на недвижимость в Тбилиси называют в нём, а лари —
 * валюта расчётов. Список закрыт: свободное поле здесь дало бы «USD»,
 * «usd» и «долл.» в одной базе, и сравнивать цены стало бы нечем.
 */
const CURRENCIES = ['USD', 'GEL', 'EUR'] as const;
