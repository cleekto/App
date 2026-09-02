import { Prisma, prisma } from '@kleekto/db';
import type { PropertyOrigin, PropertyType, TransactionType } from '@kleekto/db';

import { ACTIVITY, ENTITY } from '../activity/actions';
import { writeActivity } from '../activity/write';
import type { AuthContext } from '../auth/context';
import { NotFoundError, ValidationError } from '../errors';
import { assertScope, requirePermission, scopeFilter } from '../rbac/guard';

/**
 * Объекты в CRM: список, карточка, движение по воронке.
 *
 * Ядро не знает о HTTP: сюда приходит `AuthContext`, а не запрос. Именно
 * поэтому правило 5 выполняется само собой — взять `companyId` из тела
 * запроса здесь физически неоткуда.
 */

export interface PropertyListFilters {
  /** Поиск по адресу, району и телефону собственника. */
  query?: string | undefined;
  pipelineStatusId?: string | undefined;
  propertyType?: PropertyType | undefined;
  transactionType?: TransactionType | undefined;
  assignedUserId?: string | undefined;
  origin?: PropertyOrigin | undefined;
  priceMin?: number | undefined;
  priceMax?: number | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface PropertyListItem {
  id: string;
  /**
   * Заголовка у объекта нет и не будет: `Property` описан структурно —
   * тип, комнаты, площадь, адрес. Строку для карточки собирает интерфейс,
   * и делает это на языке агента. Хранить готовый заголовок значило бы
   * хранить его на одном языке из трёх.
   */
  propertyType: PropertyType;
  transactionType: TransactionType;
  price: number | null;
  currency: string | null;
  areaTotal: number | null;
  rooms: number | null;
  floor: number | null;
  totalFloors: number | null;
  district: string | null;
  addressRaw: string | null;
  pipelineStatusId: string;
  pipelineStatusName: string;
  assignedUserId: string | null;
  assignedUserName: string | null;
  origin: PropertyOrigin;
  photo: string | null;
  updatedAt: string;
  /** Объект ведёт и другая команда компании (инвариант 9, строка 2). */
  sharedWithOtherTeam: boolean;
}

export interface PropertyList {
  items: PropertyListItem[];
  total: number;
}

const MAX_LIMIT = 100;

/**
 * Список объектов.
 *
 * Область — из матрицы прав: агент и менеджер видят свою команду, админ —
 * всю компанию. Фильтр строится `scopeFilter`, а не руками: два разных
 * фильтра для одних данных рано или поздно разойдутся.
 */
export async function listProperties(
  ctx: AuthContext,
  filters: PropertyListFilters = {},
): Promise<PropertyList> {
  const scope = requirePermission(ctx, 'property', 'read');

  const where: Prisma.PropertyWhereInput = {
    ...(scopeFilter(ctx, scope) as Prisma.PropertyWhereInput),
    ...(filters.pipelineStatusId === undefined
      ? {}
      : { pipelineStatusId: filters.pipelineStatusId }),
    ...(filters.propertyType === undefined ? {} : { propertyType: filters.propertyType }),
    ...(filters.transactionType === undefined ? {} : { transactionType: filters.transactionType }),
    ...(filters.assignedUserId === undefined ? {} : { assignedUserId: filters.assignedUserId }),
    ...(filters.origin === undefined ? {} : { origin: filters.origin }),
  };

  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    where.price = {
      ...(filters.priceMin === undefined ? {} : { gte: filters.priceMin }),
      ...(filters.priceMax === undefined ? {} : { lte: filters.priceMax }),
    };
  }

  const query = filters.query?.trim() ?? '';
  if (query !== '') {
    // Поиск идёт по адресу, району и телефону собственника. Телефон здесь
    // не роскошь: агенту звонят с номера, и «кто это» — самый частый вопрос
    // к CRM за день.
    where.OR = [
      { addressRaw: { contains: query, mode: 'insensitive' } },
      { addressNormalized: { contains: query, mode: 'insensitive' } },
      { district: { contains: query, mode: 'insensitive' } },
      { ownerContact: { fullName: { contains: query, mode: 'insensitive' } } },
    ];

    // Ветка телефона добавляется, ТОЛЬКО если в запросе есть цифры.
    //
    // Иначе `digits(query)` пуст, а `contains: ''` совпадает со всем: поиск
    // по слову возвращал бы каждый объект, у которого есть контакт
    // собственника. Дефект найден тестом, который сравнивал результат поиска
    // с ожидаемым, — и падал тем чаще, чем больше объектов было в базе.
    const phoneDigits = digits(query);
    if (phoneDigits !== '') {
      where.OR.push({
        ownerContact: { phones: { some: { phoneNormalized: { contains: phoneDigits } } } },
      });
    }
  }

  const limit = Math.min(filters.limit ?? 50, MAX_LIMIT);

  const [rows, total] = await Promise.all([
    prisma.property.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: filters.offset ?? 0,
      include: {
        pipelineStatus: { select: { id: true, name: true } },
      },
    }),
    prisma.property.count({ where }),
  ]);

  const assignees = await namesOf(rows.map((row) => row.assignedUserId));
  const shared = await sharedLinks(
    ctx,
    rows.map((row) => row.propertyLinkId),
    rows.map((row) => row.teamId),
  );

  return {
    total,
    items: rows.map((row) => ({
      id: row.id,
      propertyType: row.propertyType,
      transactionType: row.transactionType,
      price: decimal(row.price),
      currency: row.currency,
      areaTotal: decimal(row.areaTotal),
      rooms: row.rooms,
      floor: row.floor,
      totalFloors: row.totalFloors,
      district: row.district,
      addressRaw: row.addressRaw,
      pipelineStatusId: row.pipelineStatus.id,
      pipelineStatusName: row.pipelineStatus.name,
      assignedUserId: row.assignedUserId,
      assignedUserName:
        row.assignedUserId === null ? null : (assignees.get(row.assignedUserId) ?? null),
      origin: row.origin,
      photo: row.photos[0] ?? null,
      updatedAt: row.updatedAt.toISOString(),
      sharedWithOtherTeam: row.propertyLinkId !== null && shared.has(row.propertyLinkId),
    })),
  };
}

export interface PropertyDetail extends PropertyListItem {
  teamId: string;
  descriptionSource: string | null;
  publicDescription: string | null;
  photos: string[];
  owner: { fullName: string | null; phones: string[] } | null;
  listings: Array<{
    id: string;
    source: string;
    url: string;
    externalId: string | null;
    price: number | null;
    lastSeenAt: string | null;
  }>;
  createdAt: string;
}

/**
 * Карточка объекта.
 *
 * Чужая компания и несуществующий объект отвечают одинаково — `NotFoundError`
 * (риск R-04): различимость подсказала бы, что такой идентификатор существует.
 */
export async function getProperty(ctx: AuthContext, id: string): Promise<PropertyDetail> {
  const scope = requirePermission(ctx, 'property', 'read');

  const row = await prisma.property.findFirst({
    where: { id, companyId: ctx.companyId },
    include: {
      pipelineStatus: { select: { id: true, name: true } },
      ownerContact: { include: { phones: { select: { phoneOriginal: true } } } },
      sourceListings: {
        select: {
          id: true,
          source: true,
          originalUrl: true,
          externalId: true,
          price: true,
          lastSeenAt: true,
        },
        orderBy: { firstSeenAt: 'asc' },
      },
    },
  });

  if (row === null) throw new NotFoundError();
  assertScope(ctx, scope, { companyId: row.companyId, teamId: row.teamId });

  const assignees = await namesOf([row.assignedUserId]);
  const shared = await sharedLinks(ctx, [row.propertyLinkId], [row.teamId]);

  return {
    id: row.id,
    teamId: row.teamId,
    propertyType: row.propertyType,
    transactionType: row.transactionType,
    price: decimal(row.price),
    currency: row.currency,
    areaTotal: decimal(row.areaTotal),
    rooms: row.rooms,
    floor: row.floor,
    totalFloors: row.totalFloors,
    district: row.district,
    addressRaw: row.addressRaw,
    pipelineStatusId: row.pipelineStatus.id,
    pipelineStatusName: row.pipelineStatus.name,
    assignedUserId: row.assignedUserId,
    assignedUserName:
      row.assignedUserId === null ? null : (assignees.get(row.assignedUserId) ?? null),
    origin: row.origin,
    photo: row.photos[0] ?? null,
    photos: row.photos,
    descriptionSource: row.descriptionSource,
    publicDescription: row.publicDescription,
    owner:
      row.ownerContact === null
        ? null
        : {
            fullName: row.ownerContact.fullName,
            phones: row.ownerContact.phones.map((phone) => phone.phoneOriginal),
          },
    listings: row.sourceListings.map((listing) => ({
      id: listing.id,
      source: listing.source,
      url: listing.originalUrl,
      externalId: listing.externalId,
      price: decimal(listing.price),
      lastSeenAt: listing.lastSeenAt?.toISOString() ?? null,
    })),
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    sharedWithOtherTeam: row.propertyLinkId !== null && shared.has(row.propertyLinkId),
  };
}

/**
 * Смена статуса воронки.
 *
 * Пишется в `ActivityLog` со старым и новым значением (Q30): без прошлого
 * значения журнал не отвечает на вопрос «кто вернул объект назад», а это
 * ровно тот вопрос, ради которого его читают.
 */
export async function changePropertyStatus(
  ctx: AuthContext,
  propertyId: string,
  pipelineStatusId: string,
): Promise<{ id: string; pipelineStatusId: string; pipelineStatusName: string }> {
  const scope = requirePermission(ctx, 'property', 'update');

  const property = await prisma.property.findFirst({
    where: { id: propertyId, companyId: ctx.companyId },
    select: {
      id: true,
      companyId: true,
      teamId: true,
      assignedUserId: true,
      pipelineStatusId: true,
    },
  });
  if (property === null) throw new NotFoundError();

  assertScope(ctx, scope, {
    companyId: property.companyId,
    teamId: property.teamId,
    ownerUserId: property.assignedUserId,
  });

  const status = await prisma.pipelineStatus.findFirst({
    where: { id: pipelineStatusId, companyId: ctx.companyId },
    select: { id: true, name: true },
  });
  // Статус чужой компании неотличим от несуществующего — та же причина,
  // что и у объекта.
  if (status === null) throw new NotFoundError();

  if (property.pipelineStatusId === status.id) {
    return { id: property.id, pipelineStatusId: status.id, pipelineStatusName: status.name };
  }

  const previous = await prisma.pipelineStatus.findUnique({
    where: { id: property.pipelineStatusId },
    select: { name: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.property.update({
      where: { id: property.id },
      data: { pipelineStatusId: status.id },
    });

    await writeActivity(tx, ctx, {
      entityType: ENTITY.PROPERTY,
      entityId: property.id,
      action: ACTIVITY.PROPERTY_STATUS_CHANGED,
      before: { pipelineStatus: previous?.name ?? null },
      after: { pipelineStatus: status.name },
    });
  });

  return { id: property.id, pipelineStatusId: status.id, pipelineStatusName: status.name };
}

/** Переназначение ответственного. Отдельным действием: у него своё право. */
export async function assignProperty(
  ctx: AuthContext,
  propertyId: string,
  assignedUserId: string | null,
): Promise<{ id: string; assignedUserId: string | null }> {
  const scope = requirePermission(ctx, 'property', 'assign');

  const property = await prisma.property.findFirst({
    where: { id: propertyId, companyId: ctx.companyId },
    select: { id: true, companyId: true, teamId: true, assignedUserId: true },
  });
  if (property === null) throw new NotFoundError();
  assertScope(ctx, scope, { companyId: property.companyId, teamId: property.teamId });

  if (assignedUserId !== null) {
    const user = await prisma.user.findFirst({
      where: { id: assignedUserId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (user === null) throw new NotFoundError();
  }

  await prisma.$transaction(async (tx) => {
    await tx.property.update({ where: { id: property.id }, data: { assignedUserId } });
    await writeActivity(tx, ctx, {
      entityType: ENTITY.PROPERTY,
      entityId: property.id,
      action: ACTIVITY.PROPERTY_ASSIGNED,
      before: { assignedUserId: property.assignedUserId },
      after: { assignedUserId },
    });
  });

  return { id: property.id, assignedUserId };
}

/**
 * Поля, редактируемые в карточке.
 *
 * `publicDescription` и цена публикации правятся ОТДЕЛЬНО от данных объекта
 * (§7): описание из объявления — чужой текст, и публиковать его от своего
 * имени странно и юридически, и стилистически.
 */
export interface PropertyEditInput {
  publicDescription?: string | null | undefined;
  price?: number | null | undefined;
  currency?: string | null | undefined;
  district?: string | null | undefined;
  addressRaw?: string | null | undefined;
}

export async function updateProperty(
  ctx: AuthContext,
  propertyId: string,
  input: PropertyEditInput,
): Promise<{ id: string }> {
  const scope = requirePermission(ctx, 'property', 'update');

  const property = await prisma.property.findFirst({
    where: { id: propertyId, companyId: ctx.companyId },
    select: {
      id: true,
      companyId: true,
      teamId: true,
      assignedUserId: true,
      publicDescription: true,
      price: true,
      currency: true,
      district: true,
      addressRaw: true,
    },
  });
  if (property === null) throw new NotFoundError();
  assertScope(ctx, scope, {
    companyId: property.companyId,
    teamId: property.teamId,
    ownerUserId: property.assignedUserId,
  });

  const data: Prisma.PropertyUpdateInput = {};
  if (input.publicDescription !== undefined) data.publicDescription = input.publicDescription;
  if (input.price !== undefined) data.price = input.price;
  if (input.currency !== undefined) data.currency = input.currency;
  if (input.district !== undefined) data.district = input.district;
  if (input.addressRaw !== undefined) data.addressRaw = input.addressRaw;

  if (Object.keys(data).length === 0) {
    throw new ValidationError('Менять нечего: не передано ни одного поля');
  }

  await prisma.$transaction(async (tx) => {
    await tx.property.update({ where: { id: property.id }, data });
    await writeActivity(tx, ctx, {
      entityType: ENTITY.PROPERTY,
      entityId: property.id,
      action: ACTIVITY.PROPERTY_UPDATED,
      after: { fields: Object.keys(data) },
    });
  });

  return { id: property.id };
}

// ── Вспомогательное ──────────────────────────────────────────────────────────

function decimal(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

function digits(value: string): string {
  return value.replace(/\D/gu, '');
}

async function namesOf(ids: Array<string | null>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => id !== null))];
  if (unique.length === 0) return new Map();

  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, fullName: true },
  });
  return new Map(users.map((user) => [user.id, user.fullName]));
}

/**
 * Связи, по которым объект ведёт и другая команда компании.
 *
 * ИНВАРИАНТ 9, СТРОКА 2. Это пометка, а не запрет: конкуренция между
 * командами разрешена владельцем, и скрывать её означало бы выдавать
 * штатное поведение за дефект. Агент должен знать, что по этому собственнику
 * уже кто-то работает, — чтобы не звонить ему третьим за день.
 */
async function sharedLinks(
  ctx: AuthContext,
  linkIds: Array<string | null>,
  ownTeamIds: string[],
): Promise<Set<string>> {
  const unique = [...new Set(linkIds.filter((id): id is string => id !== null))];
  if (unique.length === 0) return new Set();

  const rows = await prisma.property.findMany({
    where: {
      companyId: ctx.companyId,
      propertyLinkId: { in: unique },
      teamId: { notIn: [...new Set(ownTeamIds)] },
    },
    select: { propertyLinkId: true },
  });

  return new Set(rows.map((row) => row.propertyLinkId).filter((id): id is string => id !== null));
}
