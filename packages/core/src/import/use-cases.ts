import {
  ObservationStateValue,
  PropertyOrigin,
  type Prisma,
  type PropertyType,
  type Source,
  type TransactionType,
  prisma,
} from '@kleekto/db';

import { ACTIVITY, ENTITY } from '../activity/actions';
import { writeActivity } from '../activity/write';
import type { AuthContext } from '../auth/context';
import { analyze, type DedupMatch, type DedupOutcome } from '../dedup/engine';
import type { Facts, Verdict } from '../dedup/scoring';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { canonicalizeUrl, normalizeAddress } from '../normalize';
import { normalizePhone } from '../phone';

/**
 * Импорт объявления и фиксация результата разговора.
 *
 * ГЛАВНОЕ ПРАВИЛО ПРОДУКТА (R14, инвариант 14): `Property` создаётся ТОЛЬКО
 * при исходе `consent`. Три остальных помечают объявление в индексе и объекта
 * не создают. До версии 2.2 объект создавала кнопка импорта; теперь между
 * извлечением данных и записью в базу стоит телефонный разговор.
 */

export type CallOutcome = 'consent' | 'refused' | 'no_answer' | 'callback';

export interface ImportPayload {
  source: Source;
  sourceUrl: string;
  externalId?: string | null | undefined;

  title?: string | null | undefined;
  propertyType?: PropertyType | null | undefined;
  transactionType?: TransactionType | null | undefined;

  price?: number | null | undefined;
  currency?: string | null | undefined;

  area?: number | null | undefined;
  rooms?: number | null | undefined;
  floor?: number | null | undefined;
  totalFloors?: number | null | undefined;

  district?: string | null | undefined;
  address?: string | null | undefined;
  description?: string | null | undefined;
  photos?: string[] | undefined;

  owner: { name?: string | null | undefined; phone: string };

  parserVersion: string;
  missingFields?: string[] | undefined;
}

export interface ImportInput extends ImportPayload {
  outcome: CallOutcome;
  /** Обязателен при `callback`. */
  callbackAt?: string | null | undefined;
  /** Флаг при `refused`: просьба собственника, а не результат переговоров. */
  doNotCallCompanyWide?: boolean | undefined;
  note?: string | null | undefined;

  /**
   * Механизм «Добавить всё равно»: агент повторяет запрос, перечислив
   * совпадения, которые сознательно признал не-дублями. При `EXACT`
   * не действует — вторая копия бессмысленна.
   */
  acknowledgedDuplicateOf?: string[] | undefined;
}

export type ImportResultKind =
  | 'created'
  | 'duplicate_blocked'
  | 'duplicate_warning'
  | 'linked_to_existing'
  /** Три исхода, не создающие объект. */
  | 'observation_recorded';

export interface ImportResult {
  result: ImportResultKind;
  verdict: Verdict;
  propertyId: string | null;
  sourceListingId: string | null;
  observationId: string;
  matches: DedupMatch[];
  /** Совпадения других команд компании: пометка, никогда не блокировка. */
  otherTeamMatches: DedupMatch[];
  actions: string[];
  phoneExcluded: DedupOutcome['phoneExcluded'];
  reasonHuman: string | null;
}

export async function importListing(ctx: AuthContext, input: ImportInput): Promise<ImportResult> {
  if (ctx.teamId === null) {
    throw new ForbiddenError('Импорт доступен только участнику команды');
  }

  // ПРАВИЛО 11, вторая линия. В норме сюда не доходит: расширение блокирует
  // отправку, если телефон не раскрыт. Если запрос всё же пришёл — сломан
  // адаптер либо кто-то обращается к API напрямую.
  const phone = normalizePhone(input.owner.phone);

  const canonicalUrl = canonicalizeUrl(input.sourceUrl);
  const addressNormalized = normalizeAddress(input.address);

  const observation = await upsertObservation(input, canonicalUrl, phone.normalized);

  // Три исхода из четырёх объекта не создают (правило R14).
  if (input.outcome !== 'consent') {
    return recordObservationOnly(ctx, input, observation.id);
  }

  const facts: Facts = {
    phones: [phone.normalized],
    addressNormalized,
    area: input.area ?? null,
    rooms: input.rooms ?? null,
    floor: input.floor ?? null,
    totalFloors: input.totalFloors ?? null,
    price: input.price ?? null,
    currency: input.currency ?? null,
    propertyType: input.propertyType ?? null,
    photos: input.photos ?? [],
    district: input.district ?? null,
  };

  const dedup = await analyze(ctx, {
    source: input.source,
    externalId: input.externalId ?? null,
    canonicalUrl,
    facts,
  });

  if (dedup.exact !== null) {
    return handleExact(ctx, input, dedup, observation.id);
  }

  // Своё же объявление вернулось обратно (§5.5). Привязка ВСЕГДА, никогда
  // новый объект: иначе телефон агентства попадёт в базу как телефон
  // собственника и отравит дедупликацию всей команды (риск R-31).
  if (dedup.selfPublication !== null) {
    return linkSelfPublication(ctx, input, dedup, observation.id, canonicalUrl);
  }

  const acknowledged = new Set(input.acknowledgedDuplicateOf ?? []);
  const blocking = dedup.teamMatches.filter((match) => !acknowledged.has(match.propertyId));

  const strong = blocking.find((match) => match.verdict === 'STRONG');

  if (strong !== undefined) {
    // Объявление с ДРУГОЙ площадки, уверенно опознанное как тот же объект:
    // это не дубль, а полезный результат — объект рекламируется на двух
    // площадках (Q23, C-04). Привязываем объявление вместо создания копии.
    if (!strong.linkedSources.includes(input.source)) {
      return linkToExisting(ctx, input, strong, dedup, observation.id, canonicalUrl);
    }

    // Тот же источник — это уже предупреждение, а не находка.
    return warning(ctx, dedup, observation.id, blocking);
  }

  // POSSIBLE: мягкое предупреждение, импорт по умолчанию разрешён (P§5.2).
  // Система не должна быть агрессивной — агент настаивает на своём везде,
  // кроме EXACT.
  return createProperty(ctx, input, dedup, observation.id, canonicalUrl, addressNormalized, phone);
}

// ── Индекс наблюдений ────────────────────────────────────────────────────────

/**
 * Наблюдение пишется при ЛЮБОМ исходе, включая отказ.
 *
 * Телефон сохраняется всегда (J6): иначе то же объявление всплывёт в ленте
 * завтра, и второй агент команды позвонит тому же собственнику.
 *
 * Индекс общий для всех компаний — единственное место без `companyId`
 * (инвариант 16). Состояние работы над ним привязано к команде и границу
 * компании не покидает (инвариант 17).
 */
async function upsertObservation(
  input: ImportPayload,
  canonicalUrl: string,
  phoneNormalized: string,
): Promise<{ id: string }> {
  const data = {
    source: input.source,
    externalId: input.externalId ?? null,
    canonicalUrl,
    price: input.price ?? null,
    currency: input.currency ?? null,
    area: input.area ?? null,
    rooms: input.rooms ?? null,
    floor: input.floor ?? null,
    totalFloors: input.totalFloors ?? null,
    district: input.district ?? null,
    propertyType: input.propertyType ?? null,
    transactionType: input.transactionType ?? null,
    ownerName: input.owner.name ?? null,
    ownerPhone: input.owner.phone,
    phoneNormalized,
  };

  const existing = await prisma.listingObservation.findFirst({
    where:
      input.externalId === null || input.externalId === undefined
        ? { source: input.source, canonicalUrl }
        : { source: input.source, externalId: input.externalId },
    select: { id: true, price: true, currency: true },
  });

  if (existing === null) {
    const created = await prisma.listingObservation.create({ data, select: { id: true } });
    if (input.price !== null && input.price !== undefined) {
      await prisma.observationPriceHistory.create({
        data: {
          observationId: created.id,
          price: input.price,
          currency: input.currency ?? 'USD',
        },
      });
    }
    return created;
  }

  const priceChanged =
    input.price !== null &&
    input.price !== undefined &&
    (existing.price === null || Number(existing.price) !== input.price);

  await prisma.listingObservation.update({
    where: { id: existing.id },
    data: {
      ...data,
      lastSeenAt: new Date(),
      ...(priceChanged ? { lastPriceChangeAt: new Date() } : {}),
    },
  });

  // История цены — ключевая ценность индекса (K8). Накапливается с первого
  // дня: задним числом её не получить.
  if (priceChanged) {
    await prisma.observationPriceHistory.create({
      data: {
        observationId: existing.id,
        price: input.price as number,
        currency: input.currency ?? 'USD',
      },
    });
  }

  return { id: existing.id };
}

/** Отказ, недозвон, фоллоу-ап: помечают объявление и объекта не создают. */
async function recordObservationOnly(
  ctx: AuthContext,
  input: ImportInput,
  observationId: string,
): Promise<ImportResult> {
  if (ctx.teamId === null) throw new ForbiddenError('Импорт доступен только участнику команды');

  const state: ObservationStateValue =
    input.outcome === 'refused'
      ? ObservationStateValue.refused
      : input.outcome === 'no_answer'
        ? ObservationStateValue.no_answer
        : ObservationStateValue.callback;

  if (state === ObservationStateValue.callback && (input.callbackAt ?? null) === null) {
    throw new ValidationError('Для «перезвонить» нужна дата', { fields: ['callbackAt'] });
  }

  const callbackAt =
    input.callbackAt === null || input.callbackAt === undefined ? null : new Date(input.callbackAt);

  await prisma.observationState.upsert({
    where: { observationId_teamId: { observationId, teamId: ctx.teamId } },
    update: {
      state,
      callbackAt,
      note: input.note ?? null,
      doNotCallCompanyWide: input.doNotCallCompanyWide ?? false,
      updatedByUserId: ctx.userId,
    },
    create: {
      observationId,
      companyId: ctx.companyId,
      teamId: ctx.teamId,
      state,
      callbackAt,
      note: input.note ?? null,
      doNotCallCompanyWide: input.doNotCallCompanyWide ?? false,
      updatedByUserId: ctx.userId,
    },
  });

  return {
    result: 'observation_recorded',
    verdict: 'NONE',
    propertyId: null,
    sourceListingId: null,
    observationId,
    matches: [],
    otherTeamMatches: [],
    actions: [],
    phoneExcluded: null,
    reasonHuman: null,
  };
}

// ── Исходы согласия ──────────────────────────────────────────────────────────

/**
 * Повторная отправка того же объявления.
 *
 * Объект не создаётся. Обновляются цена, `lastSeenAt` и история цены —
 * иначе цена в базе протухала бы молча, а это худший из вариантов (C-05, Q21).
 */
async function handleExact(
  ctx: AuthContext,
  input: ImportInput,
  dedup: DedupOutcome,
  observationId: string,
): Promise<ImportResult> {
  const exact = dedup.exact as { sourceListingId: string; propertyId: string };

  const listing = await prisma.sourceListing.findUniqueOrThrow({
    where: { id: exact.sourceListingId },
    select: { id: true, price: true, currency: true },
  });

  const priceChanged =
    input.price !== null &&
    input.price !== undefined &&
    (listing.price === null || Number(listing.price) !== input.price);

  await prisma.$transaction(async (tx) => {
    await tx.sourceListing.update({
      where: { id: listing.id },
      data: {
        lastSeenAt: new Date(),
        ...(input.price === null || input.price === undefined ? {} : { price: input.price }),
        ...(input.currency === null || input.currency === undefined
          ? {}
          : { currency: input.currency }),
      },
    });

    if (priceChanged) {
      await tx.sourceListingPriceHistory.create({
        data: {
          sourceListingId: listing.id,
          price: input.price as number,
          currency: input.currency ?? 'USD',
        },
      });
    }

    await writeActivity(tx, ctx, {
      entityType: ENTITY.PROPERTY,
      entityId: exact.propertyId,
      action: ACTIVITY.LISTING_RESEEN,
      ...(priceChanged
        ? {
            before: { price: listing.price === null ? null : Number(listing.price) },
            after: { price: input.price as number },
          }
        : {}),
    });
  });

  return {
    result: 'duplicate_blocked',
    verdict: 'EXACT',
    propertyId: exact.propertyId,
    sourceListingId: listing.id,
    observationId,
    matches: [],
    otherTeamMatches: dedup.companyMatches,
    actions: ['open_existing'],
    phoneExcluded: dedup.phoneExcluded,
    reasonHuman: 'Это объявление уже импортировано вашей командой',
  };
}

/**
 * Объявление с другой площадки, опознанное как тот же объект.
 *
 * Полезный результат, а не дубль: агент узнал, что квартира рекламируется
 * на двух площадках. Именно ради того, чтобы отличить этот случай от
 * «у тебя уже есть этот объект», в контракт добавлен четвёртый исход (Q23).
 *
 * Агент может настоять на своём: повтор с `acknowledgedDuplicateOf` создаст
 * отдельный объект.
 */
async function linkToExisting(
  ctx: AuthContext,
  input: ImportInput,
  match: DedupMatch,
  dedup: DedupOutcome,
  observationId: string,
  canonicalUrl: string,
): Promise<ImportResult> {
  const listing = await prisma.$transaction(async (tx) => {
    const created = await tx.sourceListing.create({
      data: {
        propertyId: match.propertyId,
        companyId: ctx.companyId,
        teamId: ctx.teamId as string,
        source: input.source,
        externalId: input.externalId ?? null,
        canonicalUrl,
        originalUrl: input.sourceUrl,
        price: input.price ?? null,
        currency: input.currency ?? null,
        parserVersion: input.parserVersion,
        missingFields: input.missingFields ?? [],
        importedByUserId: ctx.userId,
      },
      select: { id: true },
    });

    await writeActivity(tx, ctx, {
      entityType: ENTITY.PROPERTY,
      entityId: match.propertyId,
      action: ACTIVITY.LISTING_LINKED,
      after: { source: input.source, canonicalUrl },
    });

    return created;
  });

  return {
    result: 'linked_to_existing',
    verdict: match.verdict,
    propertyId: match.propertyId,
    sourceListingId: listing.id,
    observationId,
    matches: [match],
    otherTeamMatches: dedup.companyMatches,
    actions: ['open_existing', 'import_anyway'],
    phoneExcluded: dedup.phoneExcluded,
    reasonHuman: `${match.reasonHuman}. Объявление привязано к существующему объекту`,
  };
}

/**
 * Импорт объявления, размещённого нашим же агентством.
 *
 * Агент не сделал ничего неправильного: он открыл объявление на площадке
 * и не мог знать, что его разместила соседняя команда. Поэтому это не ошибка
 * и не предупреждение, а привязка с понятным объяснением.
 */
async function linkSelfPublication(
  ctx: AuthContext,
  input: ImportInput,
  dedup: DedupOutcome,
  observationId: string,
  canonicalUrl: string,
): Promise<ImportResult> {
  const self = dedup.selfPublication as NonNullable<DedupOutcome['selfPublication']>;

  const existing = await prisma.sourceListing.findFirst({
    where: { propertyId: self.propertyId, source: input.source, canonicalUrl },
    select: { id: true },
  });

  const listingId =
    existing?.id ??
    (
      await prisma.$transaction(async (tx) => {
        const created = await tx.sourceListing.create({
          data: {
            propertyId: self.propertyId,
            companyId: ctx.companyId,
            teamId: ctx.teamId as string,
            source: input.source,
            externalId: input.externalId ?? null,
            canonicalUrl,
            originalUrl: input.sourceUrl,
            price: input.price ?? null,
            currency: input.currency ?? null,
            parserVersion: input.parserVersion,
            missingFields: input.missingFields ?? [],
            importedByUserId: ctx.userId,
          },
          select: { id: true },
        });

        await writeActivity(tx, ctx, {
          entityType: ENTITY.PROPERTY,
          entityId: self.propertyId,
          action: ACTIVITY.SELF_PUBLICATION_LINKED,
          after: { matchedBy: self.matchedBy, source: input.source },
        });

        return created;
      })
    ).id;

  return {
    result: 'linked_to_existing',
    verdict: 'EXACT',
    propertyId: self.propertyId,
    sourceListingId: listingId,
    observationId,
    matches: [],
    otherTeamMatches: dedup.companyMatches,
    actions: ['open_existing'],
    phoneExcluded: dedup.phoneExcluded,
    reasonHuman: 'Это объявление разместило ваше агентство',
  };
}

/**
 * Предупреждение о дубле.
 *
 * ЗАПИСЫВАЕТСЯ В ЖУРНАЛ, хотя объект не создан. Метрика «доля дублей»
 * (фаза 8) считается именно по этим записям: без них агентство не узнает,
 * как часто агенты натыкаются друг на друга.
 *
 * Ссылки на найденные объекты в журнал не идут: `entityId` указывает
 * на объявление-наблюдение, а не на чужой объект. Иначе журнал агента
 * содержал бы идентификаторы объектов, которых он не видит.
 */
async function warning(
  ctx: AuthContext,
  dedup: DedupOutcome,
  observationId: string,
  blocking: DedupMatch[],
): Promise<ImportResult> {
  await writeActivity(prisma, ctx, {
    entityType: ENTITY.SOURCE_LISTING,
    entityId: observationId,
    action: ACTIVITY.IMPORT_DUPLICATE_WARNED,
    after: { verdict: dedup.verdict, matches: blocking.length },
  });

  return {
    result: 'duplicate_warning',
    verdict: dedup.verdict,
    propertyId: null,
    sourceListingId: null,
    observationId,
    matches: blocking,
    otherTeamMatches: dedup.companyMatches,
    actions: ['open_existing', 'cancel', 'import_anyway'],
    phoneExcluded: dedup.phoneExcluded,
    reasonHuman: blocking[0]?.reasonHuman ?? null,
  };
}

// ── Создание объекта ─────────────────────────────────────────────────────────

async function createProperty(
  ctx: AuthContext,
  input: ImportInput,
  dedup: DedupOutcome,
  observationId: string,
  canonicalUrl: string,
  addressNormalized: string | null,
  phone: { original: string; normalized: string },
): Promise<ImportResult> {
  const teamId = ctx.teamId as string;

  const status = await prisma.pipelineStatus.findFirst({
    where: { companyId: ctx.companyId, code: 'IN_BASE' },
    select: { id: true },
  });
  if (status === null) {
    throw new NotFoundError('В компании нет статуса «В базе». Проверьте сид статусов воронки');
  }

  // Тот же объект уже ведёт другая команда — связываем записи на уровне
  // компании. Связка НЕ даёт прав: она нужна самоимпорту, предупреждению
  // о повторной публикации и отчётности (Q33, ADR-0006).
  const crossTeam = dedup.companyMatches.find(
    (match) => match.verdict === 'STRONG' || match.verdict === 'EXACT',
  );

  const created = await prisma.$transaction(async (tx) => {
    let propertyLinkId = crossTeam?.propertyLinkId ?? null;

    if (crossTeam !== undefined && propertyLinkId === null) {
      const link = await tx.propertyLink.create({
        data: { companyId: ctx.companyId },
        select: { id: true },
      });
      propertyLinkId = link.id;
      await tx.property.update({
        where: { id: crossTeam.propertyId },
        data: { propertyLinkId },
      });
    }

    const ownerContact = await tx.ownerContact.create({
      data: {
        companyId: ctx.companyId,
        fullName: input.owner.name ?? null,
        phones: {
          create: {
            companyId: ctx.companyId,
            phoneOriginal: phone.original,
            phoneNormalized: phone.normalized,
            isPrimary: true,
          },
        },
      },
      select: { id: true },
    });

    const property = await tx.property.create({
      data: {
        // Из контекста, не из входных данных (правило 5).
        companyId: ctx.companyId,
        teamId,
        assignedUserId: ctx.userId,
        createdByUserId: ctx.userId,
        propertyLinkId,
        pipelineStatusId: status.id,
        // Объект появился по согласию собственника (R14, J15).
        origin: PropertyOrigin.consent,
        ownerContactId: ownerContact.id,
        transactionType: input.transactionType ?? 'SALE',
        propertyType: input.propertyType ?? 'APARTMENT',
        rooms: input.rooms ?? null,
        areaTotal: input.area ?? null,
        floor: input.floor ?? null,
        totalFloors: input.totalFloors ?? null,
        district: input.district ?? null,
        addressRaw: input.address ?? null,
        addressNormalized,
        price: input.price ?? null,
        currency: input.currency ?? null,
        descriptionSource: input.description ?? null,
        photos: input.photos ?? [],
      },
      select: { id: true },
    });

    const listing = await tx.sourceListing.create({
      data: {
        propertyId: property.id,
        companyId: ctx.companyId,
        teamId,
        source: input.source,
        externalId: input.externalId ?? null,
        canonicalUrl,
        originalUrl: input.sourceUrl,
        price: input.price ?? null,
        currency: input.currency ?? null,
        parserVersion: input.parserVersion,
        missingFields: input.missingFields ?? [],
        importedByUserId: ctx.userId,
      },
      select: { id: true },
    });

    if (input.price !== null && input.price !== undefined) {
      await tx.sourceListingPriceHistory.create({
        data: {
          sourceListingId: listing.id,
          price: input.price,
          currency: input.currency ?? 'USD',
        },
      });
    }

    // Объявление уходит из ленты у всей компании, как только любой её агент
    // отметил «Согласен» (K26, инвариант «лента общая»).
    await tx.observationState.upsert({
      where: { observationId_teamId: { observationId, teamId } },
      update: {
        state: ObservationStateValue.converted,
        convertedPropertyId: property.id,
        updatedByUserId: ctx.userId,
      },
      create: {
        observationId,
        companyId: ctx.companyId,
        teamId,
        state: ObservationStateValue.converted,
        convertedPropertyId: property.id,
        updatedByUserId: ctx.userId,
      },
    });

    await writeActivity(tx, ctx, {
      entityType: ENTITY.PROPERTY,
      entityId: property.id,
      action: ACTIVITY.OWNER_AGREED,
      // Телефона и имени собственника здесь нет (правило 10).
      after: { source: input.source, origin: PropertyOrigin.consent } as Prisma.InputJsonValue,
    });

    return { propertyId: property.id, sourceListingId: listing.id };
  });

  return {
    result: 'created',
    verdict: dedup.verdict,
    propertyId: created.propertyId,
    sourceListingId: created.sourceListingId,
    observationId,
    // При POSSIBLE импорт прошёл, но совпадения показываются: мягкое
    // предупреждение после факта, а не блокировка.
    matches: dedup.teamMatches,
    otherTeamMatches: dedup.companyMatches,
    actions: ['open_existing'],
    phoneExcluded: dedup.phoneExcluded,
    reasonHuman: dedup.teamMatches[0]?.reasonHuman ?? null,
  };
}
