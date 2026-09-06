import Link from 'next/link';
import { Photo } from '../../_ui/photo';
import { EditProperty } from './edit-property';
import { NewProperty } from './new-property';
import { Avatar, StagePill } from '../../_ui/accent';
import { PropertyCard } from './property-card';
import { ViewSwitch, type PropertyView } from './view-switch';
import { Card, EmptyState, PageHeader } from '../../_ui/primitives';

import { fileUrls, listPipelineStatuses, listProperties, permissionScope } from '@kleekto/core';
import { translate } from '@kleekto/i18n';

import {
  dateLine,
  factsLine,
  kindLine,
  placeLine,
  priceLine,
  statusLabel,
} from '../../_lib/format';
import { contextLocale, requireContext } from '../../_lib/session';
import {
  editLabels,
  factLabels,
  propertyTypeOptions,
  transactionOptions,
} from '../../_lib/property-labels';
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

  // Режим показа живёт в адресе: переживает перезагрузку и передаётся ссылкой.
  const view: PropertyView = params['view'] === 'grid' ? 'grid' : 'list';

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

  /*
   * Цвет стадии по её идентификатору.
   *
   * Берётся тот же `colorToken`, что и на доске: администратор выбрал его
   * один раз, и стадия обязана выглядеть одинаково везде. Вывести цвет
   * заново — значит показать одну стадию разного цвета в двух местах.
   */
  const stageColor = new Map(statuses.map((status) => [status.id, status.colorToken]));

  /*
   * Обложки подписываются на сервере, все сразу.
   *
   * Бак приватный, постоянного адреса у файла нет. Подпись — это HMAC
   * без обращения к сети, поэтому подписать два десятка обложек дёшево;
   * у объектов с площадок в поле лежит внешний адрес, и он отдаётся как есть.
   */
  const photoUrls = await fileUrls(
    ctx,
    items.map((item) => item.photo ?? ''),
  );
  const photoOf = new Map(items.map((item, index) => [item.id, photoUrls[index] ?? null]));

  /*
   * Фотографии ответственных — тем же способом, но по УНИКАЛЬНЫМ ключам:
   * у одного агента в списке легко десять объектов, и десять одинаковых
   * подписей были бы работой впустую.
   */
  const faceKeys = [
    ...new Set(items.map((item) => item.assignedUserAvatarKey).filter((key) => key !== null)),
  ];
  const faceUrls = await fileUrls(ctx, faceKeys);
  const faceOf = new Map(faceKeys.map((key, index) => [key, faceUrls[index] ?? null]));
  const faceFor = (key: string | null): string | null =>
    key === null ? null : (faceOf.get(key) ?? null);

  const foundLine = `${String(total)} ${t('property.found')}`;

  // Подписи полей — общие для заведения и правки: см. `property-labels`.
  const facts = factLabels(locale);
  const edit = editLabels(locale);
  const types = propertyTypeOptions(locale);
  const transactions = transactionOptions(locale);

  // Правило 6: кнопка прячется у того, кому сервер всё равно откажет.
  // Область у агента — свои объекты, и в отказе он убедился бы уже
  // после того, как заполнил форму.
  const canEdit = permissionScope(ctx.role, 'property', 'update') !== null;

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
                  photos: t('property.photos'),
                  photoChoose: t('property.photoChoose'),
                  photoBusy: t('property.photoBusy'),
                  photoFailed: t('property.photoFailed'),
                  ...facts,
                  duplicateTitle: t('property.duplicateTitle'),
                  duplicateHint: t('property.duplicateHint'),
                  openExisting: t('property.publishCheckOpenExisting'),
                  createAnyway: t('property.createAnyway'),
                }}
                types={types}
                transactions={transactions}
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

      <div className="flex items-center justify-end">
        <ViewSwitch
          current={view}
          params={params}
          labels={{ list: t('property.viewList'), grid: t('property.viewGrid') }}
        />
      </div>

      {items.length === 0 ? (
        <EmptyState title={t('property.empty')} hint={t('property.emptyHint')} />
      ) : view === 'grid' ? (
        /* Плиточный режим: недвижимость узнают глазами, и здесь снимок
           крупный, а цена — главный элемент карточки (§21 задания). */
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <PropertyCard
              key={item.id}
              href={`/properties/${item.id}`}
              photo={photoOf.get(item.id) ?? null}
              photoAlt={t('property.photoAlt')}
              price={priceLine(locale, item)}
              kind={kindLine(locale, item)}
              facts={[kindLine(locale, item), factsLine(locale, item)].filter(Boolean).join(' · ')}
              place={placeLine(item)}
              status={
                <StagePill
                  label={statusLabel(locale, {
                    name: item.pipelineStatusName,
                    names: item.pipelineStatusNames,
                  })}
                  colorToken={stageColor.get(item.pipelineStatusId) ?? null}
                />
              }
              agent={
                item.assignedUserName === null ? (
                  <span className="truncate text-[0.75rem] text-[var(--color-text-tertiary)]">
                    {t('property.unassigned')}
                  </span>
                ) : (
                  <>
                    <Avatar
                      name={item.assignedUserName}
                      src={faceFor(item.assignedUserAvatarKey)}
                      size="sm"
                    />
                    <span className="truncate text-[0.75rem] text-[var(--color-text-tertiary)]">
                      {item.assignedUserName}
                    </span>
                  </>
                )
              }
              updated={dateLine(locale, item.updatedAt)}
            />
          ))}
        </div>
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
              <li key={item.id} className="flex items-center">
                <Link
                  href={`/properties/${item.id}`}
                  /*
                   * Отклик на наведение: подсветка строки, фирменная полоса
                   * у левого края и лёгкий сдвиг содержимого. Полоса нужна
                   * не для красоты — она отмечает, какая именно строка
                   * под курсором, когда их два десятка и они одинаковой
                   * высоты. Двигается только `transform`.
                   */
                  className="group relative grid flex-1 grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3 transition-colors duration-[var(--duration-fast)] before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:bg-transparent before:transition-colors [@media(hover:hover)and(pointer:fine)]:hover:bg-[var(--color-surface-muted)] [@media(hover:hover)and(pointer:fine)]:hover:before:bg-[var(--color-brand)]"
                >
                  {/* Недвижимость узнают по картинке, а не по строке
                      «Квартира · Продажа». Без неё двадцать строк подряд
                      неразличимы. */}
                  <Photo
                    src={photoOf.get(item.id) ?? null}
                    alt={t('property.photoAlt')}
                    className="h-12 w-16 transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)] [@media(hover:hover)and(pointer:fine)]:group-hover:scale-[1.04]"
                  />

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
                      {/* Ответственный — с кружком: в списке из двадцати
                          строк видно, чьи объекты, не читая имён. */}
                      <p className="mt-0.5 flex items-center justify-end gap-1.5 truncate text-[0.75rem] leading-4 text-[var(--color-text-tertiary)]">
                        {item.assignedUserName === null ? null : (
                          <Avatar
                            name={item.assignedUserName}
                            src={faceFor(item.assignedUserAvatarKey)}
                            size="sm"
                          />
                        )}
                        <span className="truncate">
                          {item.assignedUserName ?? t('property.unassigned')}
                        </span>
                      </p>
                    </div>

                    <span className="w-36 shrink-0">
                      <StagePill
                        label={statusLabel(locale, {
                          name: item.pipelineStatusName,
                          names: item.pipelineStatusNames,
                        })}
                        colorToken={stageColor.get(item.pipelineStatusId) ?? null}
                      />
                    </span>
                  </div>
                </Link>

                {/* Правка прямо из списка: заметил неверную цену — исправил,
                    не открывая карточку и не теряя места, до которого
                    долистал.

                    Кнопка стоит РЯДОМ со ссылкой, а не внутри неё: кнопка
                    внутри ссылки — недопустимая вложенность, и ведёт она
                    себя по-разному в разных браузерах и с клавиатуры. */}
                {canEdit ? (
                  <span className="shrink-0 pr-4">
                    <EditProperty
                      propertyId={item.id}
                      labels={edit}
                      types={types}
                      transactions={transactions}
                      compact
                    />
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
