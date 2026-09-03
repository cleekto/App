import { Prisma, prisma } from '@kleekto/db';
import type { PropertyOrigin, PropertyType, TransactionType } from '@kleekto/db';

import { ACTIVITY, ENTITY } from '../activity/actions';
import { writeActivity } from '../activity/write';
import type { AuthContext } from '../auth/context';
import { analyze, type DedupMatch } from '../dedup/engine';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { normalizeAddress } from '../normalize';
import { normalizePhone } from '../phone';
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
  /**
   * Код статуса. Нужен показу: по нему подставляется перевод, потому что
   * `pipelineStatusName` лежит в базе по-английски — его туда положила
   * регистрация, когда язык компании ещё не был известен (инвариант 4).
   */
  pipelineStatusCode: string;
  /** Запасное имя стадии: показывается там, где у языка своего нет. */
  pipelineStatusName: string;
  /** Имя стадии на каждом языке. Пусто — берётся запасное. */
  pipelineStatusNames: { ka: string | null; en: string | null; ru: string | null };
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

    // Ветка телефона добавляется, ТОЛЬКО если запрос и есть телефон —
    // то есть состоит из цифр и разделителей номера, и цифр в нём достаточно,
    // чтобы отбирать, а не совпадать со всем подряд.
    //
    // Проверять «есть ли в запросе хоть одна цифра» мало. «Абашидзе 15» —
    // самый обычный поиск по адресу, но при таком условии он сводился
    // к цифрам «15» и возвращал каждый объект, в чьём номере встречается «15»,
    // то есть почти всё. А запрос вовсе без цифр давал `contains: ''`,
    // совпадающий со всем. Оба случая выглядели исправно на пустой базе
    // и портились по мере её наполнения.
    if (PHONE_QUERY.test(query)) {
      const phoneDigits = digits(query);
      if (phoneDigits.length >= MIN_PHONE_DIGITS) {
        where.OR.push({
          ownerContact: { phones: { some: { phoneNormalized: { contains: phoneDigits } } } },
        });
      }
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
        pipelineStatus: {
          select: { id: true, code: true, name: true, nameKa: true, nameEn: true, nameRu: true },
        },
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
      pipelineStatusCode: row.pipelineStatus.code,
      pipelineStatusName: row.pipelineStatus.name,
      pipelineStatusNames: {
        ka: row.pipelineStatus.nameKa,
        en: row.pipelineStatus.nameEn,
        ru: row.pipelineStatus.nameRu,
      },
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
      pipelineStatus: {
        select: { id: true, code: true, name: true, nameKa: true, nameEn: true, nameRu: true },
      },
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
    pipelineStatusCode: row.pipelineStatus.code,
    pipelineStatusName: row.pipelineStatus.name,
    pipelineStatusNames: {
      ka: row.pipelineStatus.nameKa,
      en: row.pipelineStatus.nameEn,
      ru: row.pipelineStatus.nameRu,
    },
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

/**
 * Запрос-телефон: цифры и то, чем номер разделяют при наборе, — плюс,
 * пробелы, дефисы, скобки. Ни одной буквы. Агент, ищущий по номеру, букв
 * не печатает, а ищущий по адресу — печатает всегда.
 */
const PHONE_QUERY = /^[\d\s+()-]+$/u;

/**
 * Меньше четырёх цифр — не поиск, а совпадение со всем: «5» есть почти
 * в каждом грузинском мобильном номере. Четыре последние цифры — то, чем
 * номер и называют по памяти.
 */
const MIN_PHONE_DIGITS = 4;

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

// ── Ручное заведение объекта ─────────────────────────────────────────────────

export interface CreatePropertyInput {
  owner: { name?: string | null | undefined; phone: string };
  transactionType: TransactionType;
  propertyType: PropertyType;
  rooms?: number | null | undefined;
  areaTotal?: number | null | undefined;
  floor?: number | null | undefined;
  totalFloors?: number | null | undefined;
  district?: string | null | undefined;
  addressRaw?: string | null | undefined;
  price?: number | null | undefined;
  currency?: string | null | undefined;
  publicDescription?: string | null | undefined;
  /**
   * Дубли, которые агент увидел и всё равно настаивает.
   *
   * Тот же механизм, что у импорта: система предупреждает, но не запрещает.
   * Настаивать нельзя только на точном совпадении — там объект уже есть.
   */
  acknowledgedDuplicateOf?: readonly string[] | undefined;
}

export interface CreatePropertyResult {
  result: 'created' | 'duplicate';
  propertyId: string | null;
  /** Совпадения СВОЕЙ команды: они и останавливают заведение. */
  matches: DedupMatch[];
  /** Совпадения соседних команд компании: пометка, никогда не блокировка. */
  otherTeamMatches: DedupMatch[];
}

/**
 * Объект, заведённый руками.
 *
 * ИСКЛЮЧЕНИЕ ИЗ ПРАВИЛА 0, а не обход его. Объект появляется по «Согласен»,
 * и ручное заведение — один из двух названных правилом путей помимо него
 * (второй — миграция). Оба помечаются полем `origin`, и по нему всегда видно,
 * откуда объект взялся: `manual` здесь ставится явно и никогда не подменяется
 * на `consent`.
 *
 * Зачем он нужен. Собственник пришёл в офис, контакт передал коллега, объект
 * нашли не на площадке — во всех этих случаях объявления не существует,
 * а объект существует. Без этого пути агентство держало бы такие объекты
 * в тетради.
 *
 * ДЕДУПЛИКАЦИЯ ТА ЖЕ, ЧТО У ИМПОРТА. Иначе ручное заведение стало бы дырой
 * в ней: двое агентов завели бы одного собственника с разницей в час, и никто
 * бы не узнал. Объявления за объектом нет, поэтому два признака из пяти
 * не работают (см. `DedupInput`), а остальные — телефон, адрес, площадь,
 * комнатность — считаются как обычно.
 */
export async function createPropertyManually(
  ctx: AuthContext,
  input: CreatePropertyInput,
): Promise<CreatePropertyResult> {
  requirePermission(ctx, 'property', 'create');

  if (ctx.teamId === null) {
    throw new ForbiddenError('Объект принадлежит команде. Заводить объекты может её участник');
  }
  const teamId = ctx.teamId;

  /*
   * ТЕЛЕФОН СОБСТВЕННИКА ОБЯЗАТЕЛЕН.
   *
   * Он ключ дедупликации уровней 2 и 3. Объект без него не участвует
   * в поиске дублей ни сегодня, ни потом: он не найдётся, когда тот же
   * собственник придёт с площадки, и второй агент возьмётся за него заново.
   *
   * Требование то же, что и у импорта (правило 11), и по той же причине —
   * дедупликация, а не формальность.
   */
  const phone = normalizePhone(input.owner.phone);

  const addressNormalized =
    input.addressRaw === null || input.addressRaw === undefined || input.addressRaw.trim() === ''
      ? null
      : normalizeAddress(input.addressRaw);

  const dedup = await analyze(ctx, {
    // Объявления нет — и это не пропуск, а факт (см. `DedupInput`).
    source: null,
    externalId: null,
    canonicalUrl: null,
    facts: {
      phones: [phone.normalized],
      addressNormalized,
      area: input.areaTotal ?? null,
      rooms: input.rooms ?? null,
      floor: input.floor ?? null,
      totalFloors: input.totalFloors ?? null,
      price: input.price ?? null,
      currency: input.currency ?? null,
      propertyType: input.propertyType,
      photos: [],
      district: input.district ?? null,
    },
  });

  const acknowledged = new Set(input.acknowledgedDuplicateOf ?? []);
  const blocking = dedup.teamMatches.filter(
    (match) =>
      !acknowledged.has(match.propertyId) &&
      (match.verdict === 'EXACT' || match.verdict === 'STRONG'),
  );

  if (blocking.length > 0) {
    // Заведение останавливается, но объект не создаётся и ничего не портится.
    // Агент увидит, на что похоже, и решит сам: открыть найденное или
    // настоять. Система настойчива только на точном совпадении.
    return {
      result: 'duplicate',
      propertyId: null,
      matches: blocking,
      otherTeamMatches: dedup.companyMatches,
    };
  }

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
      await tx.property.update({ where: { id: crossTeam.propertyId }, data: { propertyLinkId } });
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
        // Помечен явно: по `origin` всегда видно, что объявления за ним нет.
        origin: 'manual',
        ownerContactId: ownerContact.id,
        transactionType: input.transactionType,
        propertyType: input.propertyType,
        rooms: input.rooms ?? null,
        areaTotal: input.areaTotal ?? null,
        floor: input.floor ?? null,
        totalFloors: input.totalFloors ?? null,
        district: input.district ?? null,
        addressRaw: input.addressRaw ?? null,
        addressNormalized,
        price: input.price ?? null,
        currency: input.currency ?? null,
        publicDescription: input.publicDescription ?? null,
        photos: [],
      },
      select: { id: true },
    });

    await writeActivity(tx, ctx, {
      entityType: ENTITY.PROPERTY,
      entityId: property.id,
      action: ACTIVITY.PROPERTY_CREATED_MANUALLY,
      // Ни имени собственника, ни телефона: в журнале только факт
      // и обстоятельства (правило 10).
      after: {
        origin: 'manual',
        acknowledgedDuplicates: acknowledged.size,
        linkedToOtherTeam: crossTeam !== undefined,
      },
    });

    return property;
  });

  return {
    result: 'created',
    propertyId: created.id,
    matches: [],
    otherTeamMatches: dedup.companyMatches,
  };
}
