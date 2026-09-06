import { ObservationStateValue, prisma, SellerKind } from '@kleekto/db';
import type { Prisma, PropertyType, Source, TransactionType } from '@kleekto/db';

import type { AuthContext } from '../auth/context';
import { requirePermission } from '../rbac/guard';

/**
 * Рабочая лента: объявления от собственников, по которым ещё не звонили.
 *
 * ЧЕМ ОНА НЕ ЯВЛЯЕТСЯ. Это не список объектов и не воронка: объекта здесь
 * нет и не будет, пока собственник не согласится (правило 0). Лента — это
 * очередь звонков, и всё её устройство подчинено одному: чтобы агент утром
 * открыл её и пошёл сверху вниз, не думая, кому звонить.
 *
 * ТОЛЬКО СОБСТВЕННИКИ (решение владельца 2026-09-06). Обе площадки говорят
 * это сами: у ss.ge `userEntityType`, у myhome `user_type.type`. Не выяснено
 * — значит, не показываем: «не знаю» и «собственник» — разные вещи,
 * и звонить посреднику вместо собственника хуже, чем не позвонить вовсе.
 *
 * ЛЕНТА НИКОГО НЕ СОЗДАЁТ И НИКОМУ НЕ ЗВОНИТ. Она только показывает.
 * Объект появляется исключительно действием «Согласен» после разговора
 * (правило 0, инвариант 17).
 */

export interface WorkFeedItem {
  observationId: string;
  source: Source;
  /** Адрес объявления на площадке. Строка ведёт туда, и только туда. */
  url: string;
  price: number | null;
  currency: string | null;
  area: number | null;
  rooms: number | null;
  floor: number | null;
  totalFloors: number | null;
  district: string | null;
  propertyType: PropertyType | null;
  transactionType: TransactionType | null;
  /** Фото с площадки. Строка ленты без него читается как пустая. */
  thumbnailUrl: string | null;
  /** Имя, под которым площадка показывает подавшего. Не контакт. */
  sellerName: string | null;
  /** Когда объявление видели в последний раз. По нему лента и упорядочена. */
  lastSeenAt: string;
  /** Цена менялась — повод позвонить даже по давнему объявлению. */
  lastPriceChangeAt: string | null;
  /**
   * Похоже на посредника, зарегистрированного частным лицом: его телефон
   * встречается у многих объявлений. Не прячем, но помечаем — решает агент.
   */
  looksLikeAgency: boolean;
}

export interface WorkFeedFilters {
  propertyType?: PropertyType | undefined;
  transactionType?: TransactionType | undefined;
  district?: string | undefined;
  priceMax?: number | undefined;
  limit?: number | undefined;
}

const MAX_LIMIT = 200;

export async function workFeed(
  ctx: AuthContext,
  filters: WorkFeedFilters = {},
): Promise<WorkFeedItem[]> {
  /*
   * Право спрашивается на ЧТЕНИЕ ОБЪЕКТА, но область не применяется.
   *
   * Это не оплошность. Лента показывает не объекты компании, а объявления
   * площадки — то, что площадка отдаёт любому посетителю по одному клику.
   * Сужать её до «своих» бессмысленно: своих здесь нет вовсе, они появятся
   * только после звонка.
   *
   * Проверка нужна, чтобы ленту не открыл тот, кому в продукте вообще
   * нечего делать.
   */
  requirePermission(ctx, 'property', 'read');

  /*
   * ЧТО УЖЕ ОТРАБОТАНО — то в ленте не место.
   *
   * Два условия, и оба выбраны владельцем:
   *
   * 1. Объект уже в базе компании. Совпадение ищется по телефону
   *    собственника — это ключ дедупликации уровней 2 и 3, и он же
   *    единственное, что связывает объявление с заведённым объектом,
   *    когда адрес на площадке написан иначе.
   *
   * 2. Собственник просил не звонить. Единственное состояние, которое
   *    действует на всю компанию (инвариант 18): отказ одной команде —
   *    ещё не отказ агентству, а просьба не звонить — уже просьба.
   *    Добавлено сверх выбранного владельцем, и намеренно: цена ошибки
   *    здесь не техническая.
   */
  const [ownPhones, doNotCall] = await Promise.all([
    prisma.ownerContactPhone.findMany({
      where: { ownerContact: { companyId: ctx.companyId } },
      select: { phoneNormalized: true },
    }),
    prisma.observationState.findMany({
      where: { companyId: ctx.companyId, doNotCallCompanyWide: true },
      select: { observationId: true },
    }),
  ]);

  const where: Prisma.ListingObservationWhereInput = {
    // Не выяснено — не показываем: «не знаю» и «собственник» не одно и то же.
    sellerKind: SellerKind.owner,
    ...(ownPhones.length === 0
      ? {}
      : { phoneNormalized: { notIn: ownPhones.map((row) => row.phoneNormalized) } }),
    ...(doNotCall.length === 0 ? {} : { id: { notIn: doNotCall.map((row) => row.observationId) } }),
    ...(filters.propertyType === undefined ? {} : { propertyType: filters.propertyType }),
    ...(filters.transactionType === undefined ? {} : { transactionType: filters.transactionType }),
    ...(filters.district === undefined
      ? {}
      : { district: { contains: filters.district, mode: 'insensitive' } }),
    ...(filters.priceMax === undefined ? {} : { price: { lte: filters.priceMax } }),
  };

  const rows = await prisma.listingObservation.findMany({
    where,
    include: { seller: { select: { displayName: true } } },
    /*
     * Сверху — то, что видели последним. Это не «выгодность»: ранжирование
     * по отклонению цены от медианы — отдельная работа, и делать вид, что
     * порядок умный, когда он просто хронологический, нельзя. Свежее сверху
     * — честный и понятный порядок, и он же самый полезный: по объявлению,
     * которое висит третий месяц, уже звонили все.
     */
    orderBy: [{ lastSeenAt: 'desc' }],
    take: Math.min(filters.limit ?? 100, MAX_LIMIT),
  });

  return rows.map((row) => ({
    observationId: row.id,
    source: row.source,
    url: row.canonicalUrl,
    price: row.price === null ? null : Number(row.price),
    currency: row.currency,
    area: row.area === null ? null : Number(row.area),
    rooms: row.rooms,
    floor: row.floor,
    totalFloors: row.totalFloors,
    district: row.district,
    propertyType: row.propertyType,
    transactionType: row.transactionType,
    thumbnailUrl: row.thumbnailUrl,
    sellerName: row.seller?.displayName ?? null,
    lastSeenAt: row.lastSeenAt.toISOString(),
    lastPriceChangeAt: row.lastPriceChangeAt?.toISOString() ?? null,
    looksLikeAgency: row.isAgencyGuess,
  }));
}

/**
 * Отметить объявление из ленты.
 *
 * Четыре исхода разговора из §5Б.2, и ни один из них не создаёт объект:
 * объект появляется только по «Согласен» (правило 0). Здесь — «отказ»,
 * «недозвон», «перезвонить» и «пропустить».
 *
 * СОСТОЯНИЕ ПРИВЯЗАНО К КОМАНДЕ, а не к человеку: у объявления одно
 * состояние на команду (`@@unique([observationId, teamId])`), и отказ,
 * полученный одним агентом, — это ответ всей команде.
 */
export async function markObservation(
  ctx: AuthContext,
  observationId: string,
  input: {
    state: ObservationStateValue;
    note?: string | null | undefined;
    callbackAt?: string | null | undefined;
    doNotCallCompanyWide?: boolean | undefined;
  },
): Promise<{ observationId: string; state: ObservationStateValue }> {
  requirePermission(ctx, 'property', 'read');

  if (ctx.teamId === null) {
    // Состояние живёт на паре «объявление × команда». Человеку без команды
    // его записать некуда, и придумывать ему команду нельзя.
    throw new Error('Состояние обзвона принадлежит команде: у вас её нет');
  }
  const teamId = ctx.teamId;

  const observation = await prisma.listingObservation.findUnique({
    where: { id: observationId },
    select: { id: true },
  });
  if (observation === null) {
    throw new Error('Объявление не найдено');
  }

  const state = await prisma.observationState.upsert({
    where: { observationId_teamId: { observationId, teamId } },
    create: {
      observationId,
      companyId: ctx.companyId,
      teamId,
      state: input.state,
      note: input.note ?? null,
      callbackAt:
        input.callbackAt === undefined || input.callbackAt === null
          ? null
          : new Date(input.callbackAt),
      doNotCallCompanyWide: input.doNotCallCompanyWide ?? false,
      updatedByUserId: ctx.userId,
    },
    update: {
      state: input.state,
      note: input.note ?? null,
      callbackAt:
        input.callbackAt === undefined || input.callbackAt === null
          ? null
          : new Date(input.callbackAt),
      ...(input.doNotCallCompanyWide === undefined
        ? {}
        : { doNotCallCompanyWide: input.doNotCallCompanyWide }),
      updatedByUserId: ctx.userId,
    },
    select: { state: true },
  });

  return { observationId, state: state.state };
}
