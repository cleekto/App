import { ObservationStateValue, prisma, SellerKind, SellerResolution } from '@kleekto/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthContext } from '../auth/context';
import { importListing, type ImportInput } from '../import/use-cases';
import { seed } from '../seed/seed';
import { harvestSearchResults, type HarvestCard } from './harvest';
import { markObservation, workFeed } from './use-cases';

/**
 * Рабочая лента: сбор с выдачи, опознание продавца, отбор в ленту.
 *
 * Проверяется то единственное, ради чего лента существует: агент видит
 * объявления СОБСТВЕННИКОВ и не видит ничего другого. Ошибка в эту сторону
 * стоит агенту звонка посреднику, а ошибка в обратную — потерянного лида,
 * и обе проверяются здесь на живой базе, а не рассуждением.
 */

let vake: AuthContext;
let saburtalo: AuthContext;
let batumi: AuthContext;

let seq = 0;

async function contextFor(email: string): Promise<AuthContext> {
  const user = await prisma.user.findFirstOrThrow({
    where: { email },
    include: { role: true, teamMemberships: true },
  });

  return {
    userId: user.id,
    companyId: user.companyId,
    teamId: user.teamMemberships[0]?.teamId ?? null,
    role: user.role.code,
    locale: user.locale,
  };
}

/** Карточка выдачи. Номер уникален на прогон: индекс общий и не чистится. */
function card(over: Partial<HarvestCard> = {}): HarvestCard {
  seq += 1;
  const id = `feed-${String(Date.now())}-${String(seq)}`;

  return {
    externalId: id,
    url: `https://www.myhome.ge/udzravi-qoneba/iyideba-bina-${id}`,
    price: 100_000,
    currency: 'USD',
    area: 56,
    rooms: 2,
    district: 'Vake',
    propertyType: 'APARTMENT',
    transactionType: 'SALE',
    sellerKind: 'owner',
    sellerExternalId: `seller-${id}`,
    sellerName: 'Nino',
    ...over,
  };
}

/** Нашлось ли объявление в ленте агента. */
async function inFeed(ctx: AuthContext, externalId: string): Promise<boolean> {
  const items = await workFeed(ctx, { limit: 200 });
  return items.some((item) => item.url.includes(externalId));
}

beforeAll(async () => {
  await seed();
  vake = await contextFor('agent1@tbilisi-estate.test');
  saburtalo = await contextFor('agent3@tbilisi-estate.test');
  batumi = await contextFor('agent1@batumi-property.test');
}, 60_000);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('в ленту попадают только объявления собственников', () => {
  it('объявление собственника видно', async () => {
    const one = card();
    await harvestSearchResults(vake, 'MYHOME_GE', [one]);

    expect(await inFeed(vake, one.externalId)).toBe(true);
  });

  it('объявление посредника не видно', async () => {
    const one = card({ sellerKind: 'agency' });
    await harvestSearchResults(vake, 'MYHOME_GE', [one]);

    expect(await inFeed(vake, one.externalId)).toBe(false);
  });

  it('невыясненный тип НЕ ПОКАЗЫВАЕТСЯ (решение владельца: прятать до выяснения)', async () => {
    /*
     * «Не знаю» и «собственник» — разные вещи. Звонок посреднику вместо
     * собственника хуже, чем несделанный звонок: агент тратит время
     * и уходит от ленты.
     */
    const one = card({ sellerKind: null });
    await harvestSearchResults(vake, 'MYHOME_GE', [one]);

    expect(await inFeed(vake, one.externalId)).toBe(false);
  });
});

describe('индекс общий, а работа по нему — своя', () => {
  it('объявление, увиденное одной компанией, видно и другой', async () => {
    // Инвариант «индекс объявлений общий для всех компаний». Площадка
    // показала это объявление любому посетителю — прятать нечего.
    const one = card();
    await harvestSearchResults(vake, 'MYHOME_GE', [one]);

    expect(await inFeed(batumi, one.externalId)).toBe(true);
  });

  it('«просил не звонить» убирает объявление у всей компании, но не у чужой', async () => {
    const one = card();
    await harvestSearchResults(vake, 'MYHOME_GE', [one]);

    const observation = await prisma.listingObservation.findFirstOrThrow({
      where: { source: 'MYHOME_GE', externalId: one.externalId },
      select: { id: true },
    });

    await markObservation(vake, observation.id, {
      state: ObservationStateValue.refused,
      doNotCallCompanyWide: true,
    });

    // Своя компания — обе команды, включая ту, что не звонила.
    expect(await inFeed(vake, one.externalId)).toBe(false);
    expect(await inFeed(saburtalo, one.externalId)).toBe(false);

    // Чужая компания об этом разговоре не знает и знать не должна.
    expect(await inFeed(batumi, one.externalId)).toBe(true);
  });
});

describe('опознание продавца', () => {
  it('тип, названный площадкой, записывается на продавца', async () => {
    const key = `seller-told-${String(Date.now())}`;
    await harvestSearchResults(vake, 'MYHOME_GE', [
      card({ sellerExternalId: key, sellerKind: 'owner' }),
    ]);

    const seller = await prisma.listingSeller.findFirstOrThrow({
      where: { source: 'MYHOME_GE', externalUserId: key },
    });

    expect(seller.entityType).toBe(SellerKind.owner);
    expect(seller.resolvedFrom).toBe(SellerResolution.search);
  });

  it('пять объявлений подряд — это уже не собственник', async () => {
    /*
     * Единственный признак, работающий там, где площадка тип не сообщает.
     * Порог щедрый и ошибается в безопасную сторону: спрятать собственника
     * с пятью квартирами дешевле, чем отдать агенту маклера.
     */
    const key = `seller-many-${String(Date.now())}`;
    const many = Array.from({ length: 5 }, () => card({ sellerExternalId: key, sellerKind: null }));

    await harvestSearchResults(vake, 'MYHOME_GE', many);

    const seller = await prisma.listingSeller.findFirstOrThrow({
      where: { source: 'MYHOME_GE', externalUserId: key },
    });

    expect(seller.entityType).toBe(SellerKind.agency);
    expect(seller.resolvedFrom).toBe(SellerResolution.volume);
  });

  it('повторный проход по той же выдаче не превращает собственника в посредника', async () => {
    /*
     * Прямая проверка ловушки: агент обновляет страницу выдачи, и без учёта
     * «видели раньше» счётчик объявлений рос бы на каждом обновлении.
     */
    const key = `seller-repeat-${String(Date.now())}`;
    const pair = [
      card({ sellerExternalId: key, sellerKind: null }),
      card({ sellerExternalId: key, sellerKind: null }),
    ];

    for (let pass = 0; pass < 5; pass += 1) {
      await harvestSearchResults(vake, 'MYHOME_GE', pair);
    }

    const seller = await prisma.listingSeller.findFirstOrThrow({
      where: { source: 'MYHOME_GE', externalUserId: key },
    });

    expect(seller.listingsSeen).toBe(2);
    expect(seller.entityType).toBeNull();
  });

  it('страница объявления опознаёт продавца и его прошлые объявления', async () => {
    /*
     * ГЛАВНЫЙ МЕХАНИЗМ ДЛЯ ss.ge. В его выдаче тип продавца не виден, и все
     * объявления сначала лежат «невыясненными». Агент открывает ОДНО из них
     * сам, там площадка называет тип — и остальные попадают в ленту без
     * единого обращения к площадке.
     */
    const key = `seller-listing-${String(Date.now())}`;
    const unknown = card({ sellerExternalId: key, sellerKind: null });
    await harvestSearchResults(vake, 'MYHOME_GE', [unknown]);

    expect(await inFeed(vake, unknown.externalId)).toBe(false);

    seq += 1;
    const opened: ImportInput = {
      source: 'MYHOME_GE',
      sourceUrl: `https://www.myhome.ge/udzravi-qoneba/opened-${key}`,
      externalId: `opened-${key}`,
      propertyType: 'APARTMENT',
      transactionType: 'SALE',
      // Национальная часть грузинского номера — девять цифр.
      owner: { name: 'Nino', phone: `+995555${String(seq).padStart(6, '0')}` },
      parserVersion: 'myhome.ge@1.0.0',
      sellerKind: 'owner',
      sellerExternalId: key,
      // «Недозвон» выбран намеренно: объект не создаётся (правило 0),
      // а продавец всё равно опознаётся.
      outcome: 'no_answer',
    };

    await importListing(vake, opened);

    expect(await inFeed(vake, unknown.externalId)).toBe(true);
  });
});

describe('чего лента не делает', () => {
  it('не создаёт объектов', async () => {
    const before = await prisma.property.count({ where: { companyId: vake.companyId } });
    await harvestSearchResults(vake, 'MYHOME_GE', [card(), card(), card()]);
    const after = await prisma.property.count({ where: { companyId: vake.companyId } });

    // Правило 0: объект появляется только по «Согласен».
    expect(after).toBe(before);
  });

  it('не принимает телефон: в индекс он попадает только через импорт', async () => {
    const one = card();
    await harvestSearchResults(vake, 'MYHOME_GE', [
      // Лишнее поле игнорируется формой карточки; проверяем результат в базе.
      { ...one, ownerPhone: '+995555000111' } as HarvestCard,
    ]);

    const observation = await prisma.listingObservation.findFirstOrThrow({
      where: { source: 'MYHOME_GE', externalId: one.externalId },
    });

    // Правило 11. Номер собственника появляется только после того, как агент
    // раскрыл его сам на странице объявления.
    expect(observation.ownerPhone).toBeNull();
    expect(observation.phoneNormalized).toBeNull();
  });

  it('копит историю цены: задним числом её не получить', async () => {
    const one = card({ price: 100_000 });
    await harvestSearchResults(vake, 'MYHOME_GE', [one]);
    await harvestSearchResults(vake, 'MYHOME_GE', [{ ...one, price: 92_000 }]);

    const observation = await prisma.listingObservation.findFirstOrThrow({
      where: { source: 'MYHOME_GE', externalId: one.externalId },
      include: { priceHistory: { orderBy: { observedAt: 'asc' } } },
    });

    expect(observation.priceHistory.map((row) => Number(row.price))).toEqual([100_000, 92_000]);
    expect(observation.lastPriceChangeAt).not.toBeNull();

    // Смена цены — повод позвонить: лента показывает это отдельной строкой.
    const items = await workFeed(vake, { limit: 200 });
    const item = items.find((one2) => one2.url.includes(one.externalId));
    expect(item?.lastPriceChangeAt).not.toBeNull();
  });

  it('пустое поле выдачи не затирает то, что узнали со страницы', async () => {
    /*
     * Тихая поломка, которая опустошила бы ленту. В карточке выдачи полей
     * меньше, чем на странице объявления. Запиши мы «площадка промолчала»
     * поверх «мы знаем» — объявление ушло бы из ленты навсегда, и в базе
     * значилось бы просто «не выяснено», без следа причины.
     */
    const one = card({ sellerKind: 'owner', district: 'Vake' });
    await harvestSearchResults(vake, 'MYHOME_GE', [one]);

    await harvestSearchResults(vake, 'MYHOME_GE', [
      { ...one, sellerKind: null, sellerExternalId: null, district: null, price: null },
    ]);

    const observation = await prisma.listingObservation.findFirstOrThrow({
      where: { source: 'MYHOME_GE', externalId: one.externalId },
    });

    expect(observation.sellerKind).toBe(SellerKind.owner);
    expect(observation.district).toBe('Vake');
    expect(await inFeed(vake, one.externalId)).toBe(true);
  });

  it('повтор внутри пачки не создаёт двух записей', async () => {
    const one = card();
    const result = await harvestSearchResults(vake, 'MYHOME_GE', [one, one, one]);

    expect(result.accepted).toBe(1);
    expect(result.created).toBe(1);

    const count = await prisma.listingObservation.count({
      where: { source: 'MYHOME_GE', externalId: one.externalId },
    });
    expect(count).toBe(1);
  });
});

describe('фильтры ленты', () => {
  it('сужают показ, а не права', async () => {
    const one = card({ district: 'Digomi', price: 55_000 });
    await harvestSearchResults(vake, 'MYHOME_GE', [one]);

    const matching = await workFeed(vake, { district: 'digomi', priceMax: 60_000, limit: 200 });
    expect(matching.some((item) => item.url.includes(one.externalId))).toBe(true);

    const tooExpensive = await workFeed(vake, { priceMax: 10_000, limit: 200 });
    expect(tooExpensive.some((item) => item.url.includes(one.externalId))).toBe(false);
  });
});
