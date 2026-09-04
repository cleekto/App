import { PublicationStatus, type Prisma, type Source, prisma } from '@kleekto/db';

import { ACTIVITY, ENTITY } from '../activity/actions';
import { writeActivity } from '../activity/write';
import type { AuthContext } from '../auth/context';
import { ConflictError, NotFoundError, ValidationError } from '../errors';
import { assertScope, requirePermission } from '../rbac/guard';
import { MANUAL_ONLY_FIELDS, type ListingPublishDraft } from './draft';
import { sanitizePublicText } from './sanitize';

export interface CreateDraftInput {
  targetSource: Source;
}

export interface DraftResult {
  publicationId: string;
  draft: ListingPublishDraft;
  /** Поля, которые агент заполнит руками. Названы заранее, а не обнаружены. */
  manualOnly: string[];
  /** Что было вырезано из описания. Для отчёта агенту, не для логов. */
  sanitized: { removedPhones: number; removedName: boolean };
}

/**
 * Сборка черновика публикации.
 *
 * ЕДИНСТВЕННОЕ МЕСТО, где обеспечено правило 13. Расширение не получает
 * контактов собственника, потому что их нет в ответе, — а не потому,
 * что оно обещало их не использовать.
 */
export async function createPublicationDraft(
  ctx: AuthContext,
  propertyId: string,
  input: CreateDraftInput,
): Promise<DraftResult> {
  const scope = requirePermission(ctx, 'publication', 'create');

  const property = await prisma.property.findFirst({
    // companyId из контекста (правило 5).
    where: { id: propertyId, companyId: ctx.companyId },
    include: { ownerContact: { include: { phones: true } } },
  });

  if (property === null) {
    throw new NotFoundError();
  }

  // Область права — не украшение: без этой проверки «команда» в матрице
  // ничего не значила бы, и агент собирал бы черновик на объект соседей.
  assertScope(ctx, scope, { companyId: property.companyId, teamId: property.teamId });

  /**
   * Объявление выходит под именем и номером того, кто его публикует
   * (решение владельца 2026-09-03). Отдельного «профиля публикации» больше
   * нет: лишняя сущность разъезжалась с действительностью — в объявлении
   * стоял один номер, а звонил собственнику другой человек.
   *
   * Номера нет — публикации нет. Подставить вместо него что угодно (номер
   * компании, пустоту, номер соседа) значит выпустить объявление, по которому
   * позвонят не тому: правило 14 запрещает придуманные значения именно здесь.
   */
  const publisher = await prisma.user.findFirst({
    where: { id: ctx.userId, companyId: ctx.companyId },
    select: { fullName: true, phone: true },
  });

  if (publisher === null || publisher.phone === null || publisher.phone === '') {
    throw new ValidationError(
      'В вашей учётной записи не указан рабочий телефон. Объявление выходит под ним — попросите руководителя заполнить его в настройках',
      { fields: ['phone'] },
    );
  }

  // Очистка описания — второй слой защиты. Первый — то, что owner вообще
  // не попадает в тип черновика.
  const sanitized = sanitizePublicText(property.publicDescription, {
    ownerPhones: property.ownerContact?.phones.map((phone) => phone.phoneNormalized) ?? [],
    ownerName: property.ownerContact?.fullName ?? null,
  });

  const publication = await prisma.$transaction(async (tx) => {
    const created = await tx.publication.create({
      data: {
        companyId: ctx.companyId,
        teamId: property.teamId,
        propertyId: property.id,
        // Контакт запоминается в самой публикации: сотрудник потом сменит
        // номер, а в чужом объявлении останется прежний, и история публикаций
        // обязана показывать тот, что там стоит.
        publisherName: publisher.fullName,
        publisherPhone: publisher.phone,
        source: input.targetSource,
        status: PublicationStatus.draft,
        createdByUserId: ctx.userId,
      },
      select: { id: true },
    });

    await writeActivity(tx, ctx, {
      entityType: ENTITY.PUBLICATION,
      entityId: created.id,
      action: ACTIVITY.PUBLICATION_DRAFTED,
      // Ни имени, ни номера: в журнале только факт (правило 10).
      after: { source: input.targetSource },
    });

    return created;
  });

  const draft: ListingPublishDraft = {
    propertyId: property.id,
    targetSource: input.targetSource,
    propertyType: property.propertyType,
    transactionType: property.transactionType,
    price: property.price === null ? null : Number(property.price),
    currency: property.currency,
    area: property.areaTotal === null ? null : Number(property.areaTotal),
    rooms: property.rooms,
    floor: property.floor,
    totalFloors: property.totalFloors,
    district: property.district,
    address: property.addressRaw,
    publicDescription: sanitized.text === '' ? null : sanitized.text,
    publisher: {
      displayName: publisher.fullName,
      phone: publisher.phone,
    },
  };

  return {
    publicationId: publication.id,
    draft,
    manualOnly: [...MANUAL_ONLY_FIELDS],
    sanitized: { removedPhones: sanitized.removedPhones, removedName: sanitized.removedName },
  };
}

// ── Отчёт о заполнении ───────────────────────────────────────────────────────

export interface FillReport {
  formVersion: string;
  filled: string[];
  unfilled: Array<{ field: string; reason: string }>;
  /**
   * Поля, в которых уже что-то лежало до заполнения. Только имена: значения
   * принадлежат другому объекту, и на сервер им незачем.
   */
  prefilled?: Array<{ field: string; outcome: 'overwritten' | 'kept' }> | undefined;
}

/**
 * Отчёт расширения о заполнении формы.
 *
 * ЗДЕСЬ, а не при подтверждении, объект переходит в «Принято в работу»
 * (J13). Расширение не знает и не имеет права узнавать, нажал ли агент
 * «Опубликовать»: форму отправляет площадка (инвариант 13).
 *
 * Статус воронки отражает работу агента, `Publication` — факт на площадке.
 * Смешивать нельзя: первое нужно воронке, второе — защите от самоимпорта.
 */
export async function reportPublicationFilled(
  ctx: AuthContext,
  publicationId: string,
  report: FillReport,
): Promise<{ id: string; status: PublicationStatus; propertyStatus: string }> {
  const publication = await prisma.publication.findFirst({
    where: { id: publicationId, companyId: ctx.companyId },
    select: { id: true, propertyId: true, status: true },
  });

  if (publication === null) {
    throw new NotFoundError();
  }

  if (publication.status === PublicationStatus.published) {
    throw new ConflictError('Публикация уже подтверждена');
  }

  const inProgress = await prisma.pipelineStatus.findFirst({
    where: { companyId: ctx.companyId, code: 'IN_PROGRESS' },
    select: { id: true, name: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.publication.update({
      where: { id: publication.id },
      data: {
        status: PublicationStatus.filled,
        formVersion: report.formVersion,
        unfilledFields: report.unfilled as unknown as Prisma.InputJsonValue,
        filledAt: new Date(),
      },
      select: { id: true, status: true },
    });

    if (inProgress !== null) {
      await tx.property.update({
        where: { id: publication.propertyId },
        data: { pipelineStatusId: inProgress.id },
      });
    }

    await writeActivity(tx, ctx, {
      entityType: ENTITY.PUBLICATION,
      entityId: publication.id,
      action: ACTIVITY.PUBLICATION_FILLED,
      after: {
        filled: report.filled.length,
        unfilled: report.unfilled.map((item) => item.field),
        /*
         * Поля, где осталось значение прошлого объекта. В журнал они попадают
         * потому, что это единственный след предупреждения: если объявление
         * уйдёт с чужим адресом, по журналу будет видно, что агента
         * предупредили, а не что система промолчала.
         */
        keptFromPrevious: (report.prefilled ?? [])
          .filter((item) => item.outcome === 'kept')
          .map((item) => item.field),
      },
    });

    return updated;
  });

  return {
    id: result.id,
    status: result.status,
    propertyStatus: inProgress?.name ?? 'unchanged',
  };
}

// ── Подтверждение факта публикации ───────────────────────────────────────────

/**
 * Единственный способ перевести публикацию в `published` (инвариант 13, I17).
 *
 * Без подтверждения статус остаётся `filled`, и это оставляет дыру в защите
 * от самоимпорта ровно тогда, когда она нужна: объявление реально живёт
 * на площадке. Дыру закрывают запасные признаки (Q31) — см. `selfPublication`.
 */
export async function confirmPublication(
  ctx: AuthContext,
  publicationId: string,
  input: { externalId?: string | null | undefined; externalUrl: string },
): Promise<{ id: string; status: PublicationStatus }> {
  const publication = await prisma.publication.findFirst({
    where: { id: publicationId, companyId: ctx.companyId },
    select: { id: true, propertyId: true, status: true, externalId: true },
  });

  if (publication === null) {
    throw new NotFoundError();
  }

  // Повторное подтверждение — конфликт, а не молчаливое обновление:
  // два разных externalId у одной записи означают, что что-то пошло не так,
  // и это должно быть видно.
  if (publication.status === PublicationStatus.published) {
    throw new ConflictError('Публикация уже подтверждена', {
      existingExternalId: publication.externalId,
    });
  }

  if (input.externalUrl.trim() === '') {
    throw new ValidationError('Нужна ссылка на размещённое объявление', {
      fields: ['externalUrl'],
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.publication.update({
      where: { id: publication.id },
      data: {
        status: PublicationStatus.published,
        externalId: input.externalId ?? null,
        externalUrl: input.externalUrl.trim(),
        publishedAt: new Date(),
        confirmedByUserId: ctx.userId,
      },
      select: { id: true, status: true },
    });

    await writeActivity(tx, ctx, {
      entityType: ENTITY.PUBLICATION,
      entityId: publication.id,
      action: ACTIVITY.LISTING_PUBLISHED,
      after: { externalUrl: input.externalUrl.trim() },
    });

    return row;
  });

  return updated;
}

// ── Чтение и проверка перед публикацией ──────────────────────────────────────

export interface PublicationSummary {
  id: string;
  source: Source;
  status: PublicationStatus;
  externalUrl: string | null;
  publisherDisplayName: string;
  unfilledFields: string[];
  filledAt: Date | null;
  publishedAt: Date | null;
}

export async function listPublications(
  ctx: AuthContext,
  propertyId: string,
): Promise<PublicationSummary[]> {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, companyId: ctx.companyId },
    select: { id: true },
  });
  if (property === null) throw new NotFoundError();

  const publications = await prisma.publication.findMany({
    where: { companyId: ctx.companyId, propertyId },
    orderBy: { createdAt: 'desc' },
  });

  return publications.map((publication) => ({
    id: publication.id,
    source: publication.source,
    status: publication.status,
    externalUrl: publication.externalUrl,
    publisherDisplayName: publication.publisherName ?? '',
    unfilledFields: Array.isArray(publication.unfilledFields)
      ? (publication.unfilledFields as Array<{ field?: string }>).map(
          (item) => item.field ?? 'unknown',
        )
      : [],
    filledAt: publication.filledAt,
    publishedAt: publication.publishedAt,
  }));
}

/**
 * Предупреждение «объект уже размещён на этой площадке» ДО заполнения формы
 * (I22, P9).
 *
 * ОБЛАСТЬ — КОМПАНИЯ, не команда (инвариант 9). Объявление могла разместить
 * соседняя команда, и повторная публикация одной квартиры от имени одного
 * агентства — ровно то, что запрещает формула из ADR-0006.
 *
 * Учитывается и объявление, ИЗ КОТОРОГО объект был импортирован: собственник
 * уже разместил его сам, и второе объявление от агентства будет конкурировать
 * с первым.
 */
export async function publishCheck(
  ctx: AuthContext,
  propertyId: string,
  source: Source,
): Promise<{
  alreadyPublished: boolean;
  reasonHuman: string | null;
  publications: PublicationSummary[];
  existingListings: Array<{ source: Source; canonicalUrl: string }>;
  actions: string[];
}> {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, companyId: ctx.companyId },
    select: { id: true, propertyLinkId: true },
  });
  if (property === null) throw new NotFoundError();

  // Связка нужна именно здесь: тот же объект может вести другая команда,
  // и её публикация — тоже публикация нашего агентства.
  const linkedIds =
    property.propertyLinkId === null
      ? [property.id]
      : (
          await prisma.property.findMany({
            where: { companyId: ctx.companyId, propertyLinkId: property.propertyLinkId },
            select: { id: true },
          })
        ).map((row) => row.id);

  const publications = await prisma.publication.findMany({
    where: {
      companyId: ctx.companyId,
      propertyId: { in: linkedIds },
      source,
      status: { in: [PublicationStatus.filled, PublicationStatus.published] },
    },
  });

  const listings = await prisma.sourceListing.findMany({
    where: { propertyId: { in: linkedIds }, source },
    select: { source: true, canonicalUrl: true },
  });

  const already = publications.length > 0 || listings.length > 0;

  return {
    alreadyPublished: already,
    reasonHuman: already
      ? publications.length > 0
        ? 'Ваше агентство уже размещало этот объект на этой площадке'
        : 'Этот объект уже есть на площадке — из этого объявления он и был импортирован'
      : null,
    publications: publications.map((publication) => ({
      id: publication.id,
      source: publication.source,
      status: publication.status,
      externalUrl: publication.externalUrl,
      publisherDisplayName: publication.publisherName ?? '',
      unfilledFields: [],
      filledAt: publication.filledAt,
      publishedAt: publication.publishedAt,
    })),
    existingListings: listings,
    actions: already ? ['open_existing', 'publish_anyway', 'cancel'] : ['proceed'],
  };
}
