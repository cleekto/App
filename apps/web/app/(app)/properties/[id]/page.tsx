import {
  getProperty,
  listComments,
  listPipelineStatuses,
  listPublications,
  listTasks,
  listUsers,
  fileUrls,
  permissionScope,
  propertyActivity,
} from '@kleekto/core';
import { formatDateTime, translate } from '@kleekto/i18n';

import {
  dateLine,
  dueLine,
  factsLine,
  kindLine,
  placeLine,
  priceLine,
  statusLabel,
} from '../../../_lib/format';
import { contextLocale, requireContext } from '../../../_lib/session';
import { ActivityList } from './activity-list';
import { Characteristics } from './characteristics';
import { CommentBox } from './comment-box';
import { editLabels, factDictionaries } from '../../../_lib/property-labels';
import { PropertyControls } from './controls';
import { EditProperty } from '../edit-property';
import { PhotoGallery } from './photo-gallery';
import { PublicDescription } from './public-description';
import { TaskBox } from './task-box';

/**
 * Карточка объекта — DESIGN §15.
 *
 * Всё, что агент должен знать перед звонком, на одном экране: недвижимость,
 * собственник, объявления, публикации, задачи, обсуждение и история.
 */
export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const locale = contextLocale(ctx);
  const { id } = await params;

  const [property, statuses, publications, comments, tasks, activity] = await Promise.all([
    getProperty(ctx, id),
    listPipelineStatuses(ctx),
    listPublications(ctx, id),
    listComments(ctx, id),
    listTasks(ctx, { propertyId: id }),
    propertyActivity(ctx, id),
  ]);

  // Кому можно назначить объект — люди той же области видимости, что и сам
  // пользователь. Список берётся из справочника людей, а не выводится
  // из уже назначенных объектов: иначе нового сотрудника нельзя было бы
  // выбрать, пока на нём нет ни одного объекта.
  const teammates = (await listUsers(ctx))
    .filter((user) => user.isActive)
    .map((user) => ({ id: user.id, name: user.fullName }));

  const t = (key: Parameters<typeof translate>[1]): string => translate(locale, key);

  // Ссылки на снимки подписываются на сервере: бак приватный. У объектов
  // с площадок в поле лежит внешний адрес — он отдаётся как есть.
  //
  // Рядом со ссылкой едет и КЛЮЧ: ссылка живёт час и в базу не возвращается,
  // а правка списка фотографий говорит серверу именно ключами.
  const photoUrls = await fileUrls(ctx, property.photos);
  const photos = property.photos
    .map((key, index) => ({ key, url: photoUrls[index] ?? null }))
    .filter((item): item is { key: string; url: string } => item.url !== null);

  // Правило 6: кнопки правки прячутся у того, кому сервер всё равно откажет.
  // Отказать он может и по области — это его дело, не экрана.
  const canEditPhotos = permissionScope(ctx.role, 'property', 'update') !== null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{kindLine(locale, property)}</h1>
          <p className="text-[var(--color-text-secondary)]">{factsLine(locale, property)}</p>
          {placeLine(property) === '' ? null : (
            <p className="text-[var(--color-text-secondary)]">{placeLine(property)}</p>
          )}
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
            {translate(locale, `property.origin.${property.origin}` as never)}
          </p>
          {property.sharedWithOtherTeam ? (
            <p className="mt-2 rounded-lg bg-[var(--color-warning)]/10 px-3 py-2 text-sm text-[var(--color-warning)]">
              {t('property.sharedWithOtherTeam')}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-2">
          <p className="text-2xl font-semibold">{priceLine(locale, property)}</p>
          {canEditPhotos ? (
            <EditProperty
              propertyId={property.id}
              labels={editLabels(locale)}
              dictionaries={factDictionaries(locale)}
            />
          ) : null}
        </div>
      </header>

      {/* ФОТОГРАФИИ ОБЪЕКТА. Их не было вовсе, хотя ссылки лежали в базе
          с первого импорта: агент открывал карточку и не видел того, чем
          недвижимость и опознают. Первая крупнее — она и есть «эта квартира»,
          остальные полосой рядом. */}
      <PhotoGallery
        propertyId={property.id}
        initial={photos}
        canEdit={canEditPhotos}
        labels={{
          photos: t('property.photos'),
          alt: t('property.photoAlt'),
          edit: t('property.photoEdit'),
          done: t('property.photoDone'),
          remove: t('property.photoRemove'),
          choose: t('property.photoChoose'),
          busy: t('property.photoBusy'),
          uploadFailed: t('property.photoFailed'),
          saveFailed: t('property.photoSaveFailed'),
          open: t('property.photoOpen'),
          close: t('property.photoClose'),
          previous: t('property.photoPrevious'),
          next: t('property.photoNext'),
          downloadAll: t('property.photoDownloadAll'),
          downloadBusy: t('property.photoDownloadBusy'),
          downloadFailed: t('property.photoDownloadFailed'),
        }}
      />

      <PropertyControls
        propertyId={property.id}
        currentStatusId={property.pipelineStatusId}
        currentAssigneeId={property.assignedUserId}
        statuses={statuses.map((status) => ({ id: status.id, name: statusLabel(locale, status) }))}
        people={teammates}
        labels={{
          status: t('property.status'),
          assignee: t('property.assignee'),
          unassigned: t('property.unassigned'),
          publish: t('property.publish'),
          openExisting: t('property.publishCheckOpenExisting'),
          publishAnyway: t('property.publishCheckAnyway'),
          cancel: t('property.publishCheckCancel'),
        }}
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          {/* Характеристики выше описания: их читают перед звонком,
              а описание — чужой текст, который агент перепишет. */}
          <Characteristics locale={locale} facts={property} />

          <PublicDescription
            propertyId={property.id}
            value={property.publicDescription}
            source={property.descriptionSource}
            labels={{
              title: t('property.publicDescription'),
              hint: t('property.publicDescriptionHint'),
              source: t('property.sourceDescription'),
              save: t('common.save'),
            }}
          />

          <TaskBox
            propertyId={property.id}
            tasks={tasks.map((task) => ({
              ...task,
              // Срок форматируется на сервере: внутри `Intl`, а у браузера
              // может не быть данных нужной локали — см. `task-box.tsx`.
              dueLabel: dueLine(locale, task.dueAt),
            }))}
            people={teammates}
            labels={{
              title: t('property.tasks'),
              add: t('task.add'),
              titleField: t('task.titleField'),
              dueField: t('task.dueField'),
              assigneeField: t('task.assigneeField'),
              create: t('task.create'),
              done: t('task.done'),
              cancel: t('task.cancel'),
              overdue: t('task.overdue'),
              empty: t('task.empty'),
              unassigned: t('property.unassigned'),
            }}
          />

          <CommentBox
            propertyId={property.id}
            comments={comments.map((comment) => ({
              ...comment,
              // Дата форматируется здесь, на сервере: у браузера может
              // не быть данных грузинской локали (см. `comment-box.tsx`).
              createdAtLabel: formatDateTime(locale, new Date(comment.createdAt)),
            }))}
            labels={{
              title: t('property.comments'),
              placeholder: t('property.addComment'),
              send: t('property.send'),
            }}
          />
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <h2 className="text-sm font-semibold">{t('property.owner')}</h2>
            {property.owner === null ? (
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                {t('property.noOwner')}
              </p>
            ) : (
              <div className="mt-2 flex flex-col gap-1 text-sm">
                {property.owner.fullName === null ? null : <p>{property.owner.fullName}</p>}
                {property.owner.phones.map((phone) => (
                  <a key={phone} href={`tel:${phone}`} className="text-[var(--color-brand)]">
                    {phone}
                  </a>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <h2 className="text-sm font-semibold">{t('property.listings')}</h2>
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {property.listings.map((listing) => (
                <li key={listing.id}>
                  <a
                    href={listing.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--color-brand)]"
                  >
                    {listing.source}
                  </a>
                  {listing.lastSeenAt === null ? null : (
                    <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                      {dateLine(locale, listing.lastSeenAt)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <h2 className="text-sm font-semibold">{t('property.publications')}</h2>
            {publications.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                {t('property.notPublished')}
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2 text-sm">
                {publications.map((publication) => (
                  <li key={publication.id} className="flex flex-col">
                    <span className="font-medium">{publication.source}</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {publication.publisherDisplayName}
                    </span>
                    {publication.externalUrl === null ? null : (
                      <a
                        href={publication.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[var(--color-brand)]"
                      >
                        {t('property.openSource')}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <ActivityList entries={activity} locale={locale} title={t('property.activity')} />
        </div>
      </div>
    </div>
  );
}
