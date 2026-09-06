import { prisma, SellerKind, SellerResolution } from '@kleekto/db';
import type { PropertyType, Source, TransactionType } from '@kleekto/db';

import type { AuthContext } from '../auth/context';
import { canonicalizeUrl } from '../normalize';
import { requirePermission } from '../rbac/guard';

/**
 * Приём объявлений, увиденных агентом на странице выдачи.
 *
 * НИ ОДНОГО ЛИШНЕГО ОБРАЩЕНИЯ К ПЛОЩАДКЕ. Расширение читает страницу,
 * которую агент открыл сам, и присылает то, что там уже было. Мы не ходим
 * по сайту, не листаем выдачу за человека и не открываем карточки — со
 * стороны площадки это обычный посетитель, и блокировать нечего.
 *
 * ТЕЛЕФОНОВ ЗДЕСЬ НЕТ И БЫТЬ НЕ МОЖЕТ. В выдаче их не отдают, а на странице
 * объявления телефон лежит в данных ещё до нажатия «показать номер» — и
 * именно поэтому карточки автоматически не открываются. Номер попадает
 * в систему только тогда, когда агент открыл объявление и раскрыл номер
 * сам (правило 11).
 */

/** Карточка из выдачи в том виде, в каком её прислало расширение. */
export interface HarvestCard {
  externalId: string;
  url: string;
  price?: number | null | undefined;
  currency?: string | null | undefined;
  area?: number | null | undefined;
  rooms?: number | null | undefined;
  floor?: number | null | undefined;
  totalFloors?: number | null | undefined;
  district?: string | null | undefined;
  propertyType?: PropertyType | null | undefined;
  transactionType?: TransactionType | null | undefined;
  thumbnailUrl?: string | null | undefined;
  sellerExternalId?: string | null | undefined;
  sellerName?: string | null | undefined;
  sellerKind?: 'owner' | 'agency' | null | undefined;
}

export interface HarvestResult {
  /** Сколько карточек принято к обработке (после отбрасывания повторов). */
  accepted: number;
  /** Из них увидены впервые. */
  created: number;
  /** Сколько продавцов опознано этой пачкой. */
  sellersResolved: number;
}

/**
 * Сколько объявлений превращают продавца в посредника.
 *
 * СОБСТВЕННИК ПОДАЁТ ОДНО-ДВА. Пять — уже не собственник: это либо частный
 * маклер, либо застройщик. Порог намеренно щедрый и ошибается в безопасную
 * сторону: спрятать настоящего собственника с пятью квартирами дешевле,
 * чем показать агенту маклера и потратить его звонок.
 *
 * Нужен только для ss.ge: myhome называет тип сам.
 */
const AGENCY_VOLUME = 5;

/** Валюта по умолчанию: обе площадки показывают цены в долларах. */
const DEFAULT_CURRENCY = 'USD';

function toSellerKind(value: 'owner' | 'agency' | null | undefined): SellerKind | null {
  if (value === 'owner') return SellerKind.owner;
  if (value === 'agency') return SellerKind.agency;
  return null;
}

/** Плоское значение или `null`: `undefined` в Prisma означает «не трогать». */
function orNull<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

export async function harvestSearchResults(
  ctx: AuthContext,
  source: Source,
  incoming: readonly HarvestCard[],
): Promise<HarvestResult> {
  /*
   * Право — на чтение объекта, область не применяется. Индекс объявлений
   * общий для всех компаний (архитектурный инвариант), и присылать в него
   * может любой работающий агент: его браузер и есть источник. Проверка
   * нужна, чтобы в индекс не писал тот, кому в продукте нечего делать.
   */
  requirePermission(ctx, 'property', 'read');

  // Одна страница выдачи иногда показывает объявление дважды (закреплённые
  // сверху повторяются в списке). Внутри пачки такой повтор — не новость.
  const cards = [...new Map(incoming.map((card) => [card.externalId, card])).values()];
  if (cards.length === 0) return { accepted: 0, created: 0, sellersResolved: 0 };

  /*
   * Два запроса на всю пачку вместо двух на карточку. Это не преждевременная
   * оптимизация: сбор идёт на каждой странице выдачи, которую агент открыл,
   * и десятки запросов в цикле упёрлись бы в пул соединений — тот самый,
   * про который предупреждает CLAUDE.md.
   */
  const sellerKeys = [
    ...new Set(
      cards
        .map((card) => card.sellerExternalId)
        .filter((id): id is string => id !== null && id !== undefined && id !== ''),
    ),
  ];

  const [seenRows, sellerRows] = await Promise.all([
    prisma.listingObservation.findMany({
      /*
       * Ищем и по номеру объявления, и по адресу. У таблицы два условия
       * уникальности, и объявление могло попасть в индекс со страницы,
       * где номер не разобрался: создать его второй раз означало бы
       * упереться в `@@unique([source, canonicalUrl])` посреди пачки.
       */
      where: {
        source,
        OR: [
          { externalId: { in: cards.map((card) => card.externalId) } },
          { canonicalUrl: { in: cards.map((card) => canonicalizeUrl(card.url)) } },
        ],
      },
      select: { id: true, externalId: true, canonicalUrl: true, price: true },
    }),
    sellerKeys.length === 0
      ? Promise.resolve([])
      : prisma.listingSeller.findMany({
          where: { source, externalUserId: { in: sellerKeys } },
          select: { id: true, externalUserId: true, entityType: true, listingsSeen: true },
        }),
  ]);

  const seen = new Map<string, (typeof seenRows)[number]>();
  for (const row of seenRows) {
    if (row.externalId !== null) seen.set(row.externalId, row);
    seen.set(row.canonicalUrl, row);
  }

  /** Уже видели это объявление — под любым из двух ключей. */
  const known = (card: HarvestCard): (typeof seenRows)[number] | null =>
    seen.get(card.externalId) ?? seen.get(canonicalizeUrl(card.url)) ?? null;
  const sellers = new Map(sellerRows.map((row) => [row.externalUserId, row]));

  let sellersResolved = 0;

  /*
   * ПРОДАВЕЦ ЗАПОМИНАЕТСЯ ОТДЕЛЬНО, и в этом весь замысел.
   *
   * У ss.ge тип продавца в выдаче не виден: частный маклер там неотличим
   * от собственника (проверено на живых страницах). Зато виден его
   * идентификатор — и как только тип станет известен хоть из одного
   * источника, он распространится на все объявления этого продавца
   * без единого обращения к площадке.
   */
  const resolved = new Map<string, { id: string; entityType: SellerKind | null }>();

  for (const key of sellerKeys) {
    const mine = cards.filter((card) => card.sellerExternalId === key);

    // Тип берём из карточек, где площадка его назвала.
    const told = mine.map((card) => toSellerKind(card.sellerKind)).find((kind) => kind !== null);
    const name = mine
      .map((card) => card.sellerName)
      .find((value) => value !== null && value !== undefined && value !== '');

    /*
     * Счётчик растёт только на НОВЫХ объявлениях: иначе повторный проход
     * агента по той же выдаче превратил бы собственника в посредника
     * за пару обновлений страницы.
     */
    const fresh = mine.filter((card) => known(card) === null).length;

    const before = sellers.get(key) ?? null;
    const listingsSeen = (before?.listingsSeen ?? 0) + fresh;

    /*
     * Что уже знали — тем и остаёмся: знание со страницы объявления надёжнее
     * выдачи, а «не знаю» никогда не затирает «знаю».
     */
    let entityType = before?.entityType ?? told ?? null;

    // Слишком много объявлений для собственника — считаем посредником.
    let resolvedFrom: SellerResolution | null =
      before?.entityType !== null && before?.entityType !== undefined
        ? null
        : entityType === null
          ? null
          : SellerResolution.search;

    if (entityType === null && listingsSeen >= AGENCY_VOLUME) {
      entityType = SellerKind.agency;
      resolvedFrom = SellerResolution.volume;
    }

    if ((before?.entityType ?? null) === null && entityType !== null) sellersResolved += 1;

    const row = await prisma.listingSeller.upsert({
      where: { source_externalUserId: { source, externalUserId: key } },
      create: {
        source,
        externalUserId: key,
        displayName: orNull(name),
        entityType,
        resolvedFrom,
        listingsSeen,
      },
      update: {
        lastSeenAt: new Date(),
        listingsSeen,
        ...(name === null || name === undefined ? {} : { displayName: name }),
        ...(resolvedFrom === null || entityType === null ? {} : { entityType, resolvedFrom }),
      },
      select: { id: true },
    });

    resolved.set(key, { id: row.id, entityType });
  }

  let created = 0;

  for (const card of cards) {
    const seller =
      card.sellerExternalId === null || card.sellerExternalId === undefined
        ? null
        : (resolved.get(card.sellerExternalId) ?? null);

    const facts = {
      price: orNull(card.price),
      currency: orNull(card.currency),
      area: orNull(card.area),
      rooms: orNull(card.rooms),
      floor: orNull(card.floor),
      totalFloors: orNull(card.totalFloors),
      district: orNull(card.district),
      propertyType: orNull(card.propertyType),
      transactionType: orNull(card.transactionType),
      thumbnailUrl: orNull(card.thumbnailUrl),
      sellerId: seller?.id ?? null,
      sellerKind: seller?.entityType ?? toSellerKind(card.sellerKind),
    };

    const existing = known(card);

    if (existing === null) {
      const row = await prisma.listingObservation.create({
        data: {
          source,
          externalId: card.externalId,
          canonicalUrl: canonicalizeUrl(card.url),
          ...facts,
        },
        select: { id: true },
      });
      created += 1;

      if (card.price !== null && card.price !== undefined) {
        await prisma.observationPriceHistory.create({
          data: {
            observationId: row.id,
            price: card.price,
            currency: card.currency ?? DEFAULT_CURRENCY,
          },
        });
      }
      continue;
    }

    const priceChanged =
      card.price !== null &&
      card.price !== undefined &&
      (existing.price === null || Number(existing.price) !== card.price);

    /*
     * ПУСТОЕ НЕ ЗАТИРАЕТ ЗАПОЛНЕННОЕ.
     *
     * В карточке выдачи полей меньше, чем на странице объявления, и там,
     * где площадка промолчала, у нас стоит `null`. Записав его поверх,
     * мы стёрли бы то, что уже знали, — прежде всего тип продавца,
     * узнанный со страницы, которую агент открыл сам. Одно такое затирание
     * убрало бы объявление из ленты насовсем, и понять почему было бы
     * невозможно: в базе просто «не выяснено».
     */
    const changed = Object.fromEntries(Object.entries(facts).filter(([, value]) => value !== null));

    await prisma.listingObservation.update({
      where: { id: existing.id },
      data: {
        ...changed,
        lastSeenAt: new Date(),
        ...(priceChanged ? { lastPriceChangeAt: new Date() } : {}),
      },
    });

    if (priceChanged && card.price !== null && card.price !== undefined) {
      /*
       * История цены — главная ценность индекса, и единственное, чего
       * нельзя получить задним числом. Поэтому её копят с первого дня,
       * даже пока лента ещё не работает (правило 16).
       */
      await prisma.observationPriceHistory.create({
        data: {
          observationId: existing.id,
          price: card.price,
          currency: card.currency ?? DEFAULT_CURRENCY,
        },
      });
    }
  }

  return { accepted: cards.length, created, sellersResolved };
}

/**
 * Запомнить продавца по странице объявления, которую агент открыл сам.
 *
 * ВОЗВРАЩАЕТ ССЫЛКУ НА ПРОДАВЦА, чтобы вызывающий привязал к нему
 * объявление. `null` — площадка не назвала идентификатора; тогда привязывать
 * нечего, и это нормально.
 *
 * ЗАЧЕМ ЭТО ВСЁ. В списке объявлений ss.ge тип продавца не виден: частный
 * маклер там неотличим от собственника (проверено на живых страницах).
 * На странице объявления виден. Одно открытие — и все объявления этого
 * продавца, прошлые и будущие, получают тип, а площадка не получает от нас
 * ни одного лишнего запроса. Ради этого сущность продавца и заведена.
 */
export async function resolveSellerFromListing(
  source: Source,
  externalUserId: string | null | undefined,
  kind: 'owner' | 'agency' | null | undefined,
  displayName?: string | null | undefined,
): Promise<string | null> {
  if (externalUserId === null || externalUserId === undefined || externalUserId === '') {
    return null;
  }

  const entityType = toSellerKind(kind);

  const seller = await prisma.listingSeller.upsert({
    where: { source_externalUserId: { source, externalUserId } },
    create: {
      source,
      externalUserId,
      displayName: orNull(displayName),
      entityType,
      resolvedFrom: entityType === null ? null : SellerResolution.listing,
      listingsSeen: 1,
    },
    update: {
      lastSeenAt: new Date(),
      ...(displayName === null || displayName === undefined ? {} : { displayName }),
      /*
       * «Не знаю» никогда не затирает «знаю», а знание со страницы объявления
       * перекрывает и выдачу, и вывод по числу объявлений: там площадка
       * назвала тип прямо, здесь мы его угадывали.
       */
      ...(entityType === null ? {} : { entityType, resolvedFrom: SellerResolution.listing }),
    },
    select: { id: true },
  });

  if (entityType !== null) {
    // Разом обновляем все объявления продавца: ради этого всё и затевалось.
    await prisma.listingObservation.updateMany({
      where: { sellerId: seller.id },
      data: { sellerKind: entityType },
    });
  }

  return seller.id;
}
