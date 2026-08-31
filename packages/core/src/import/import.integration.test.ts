import { PropertyOrigin, prisma } from '@cleekto/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthContext } from '../auth/context';
import { ValidationError } from '../errors';
import { createPublishProfile } from '../publish-profiles/use-cases';
import { seed } from '../seed/seed';
import { importListing, type ImportInput } from './use-cases';

/**
 * ГЕЙТ ФАЗЫ 4. Импорт и дедупликация работают и покрыты тестами до того,
 * как написана первая строка расширения (DoD §3.Ф4).
 *
 * Chrome здесь не нужен: расширение — только транспорт. Всё, что можно
 * проверить без браузера, проверяется без браузера.
 */

interface Actors {
  /** Команда Vake компании «Tbilisi Estate». */
  vake: AuthContext;
  /** Второй агент той же команды: дубли между ними блокируются. */
  vakeSecond: AuthContext;
  /** Команда Saburtalo той же компании: конкуренция разрешена. */
  saburtalo: AuthContext;
  /** Другая компания: её данные не пересекаются никогда. */
  batumi: AuthContext;
}

let actors: Actors;
let counter = 0;

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

/** Уникальный грузинский номер: 9 цифр национальной части. */
function phoneFor(seq: number): string {
  return `+9955551${String(seq).padStart(5, '0')}`;
}

function payload(over: Partial<ImportInput> = {}): ImportInput {
  counter += 1;
  const seq = counter;

  return {
    source: 'SS_GE',
    sourceUrl: `https://ss.ge/ru/listing/${seq}`,
    externalId: `ss-${seq}`,
    propertyType: 'APARTMENT',
    transactionType: 'SALE',
    price: 145000,
    currency: 'USD',
    area: 78,
    rooms: 3,
    floor: 5,
    totalFloors: 12,
    district: 'Saburtalo',
    address: 'Сабуртало, ул. Вашлованская 12',
    description: 'Светлая квартира',
    photos: [`https://ss.ge/photo/${seq}.jpg`],
    owner: { name: 'Гиорги', phone: phoneFor(seq) },
    parserVersion: 'ss.ge@1.0.0',
    missingFields: [],
    outcome: 'consent',
    ...over,
  };
}

beforeAll(async () => {
  await seed();
  actors = {
    vake: await contextFor('agent1@tbilisi-estate.test'),
    vakeSecond: await contextFor('agent2@tbilisi-estate.test'),
    saburtalo: await contextFor('agent3@tbilisi-estate.test'),
    batumi: await contextFor('agent1@batumi-property.test'),
  };
}, 60_000);

afterAll(async () => {
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────────────────────────
// Правило R14: объект появляется только по «Согласен»
// ─────────────────────────────────────────────────────────────────────────────

describe('исход разговора решает, появится ли объект', () => {
  it('«Согласен» создаёт объект, объявление и контакт собственника', async () => {
    const result = await importListing(actors.vake, payload());

    expect(result.result).toBe('created');
    expect(result.propertyId).not.toBeNull();

    const property = await prisma.property.findUniqueOrThrow({
      where: { id: result.propertyId as string },
      include: {
        ownerContact: { include: { phones: true } },
        sourceListings: true,
        pipelineStatus: true,
      },
    });

    expect(property.origin).toBe(PropertyOrigin.consent);
    expect(property.pipelineStatus.code).toBe('IN_BASE');
    expect(property.sourceListings).toHaveLength(1);
    expect(property.ownerContact?.phones).toHaveLength(1);
    expect(property.teamId).toBe(actors.vake.teamId);
  });

  it.each(['refused', 'no_answer', 'callback'] as const)(
    '«%s» не создаёт ни объекта, ни контакта собственника',
    async (outcome) => {
      const before = await prisma.property.count({ where: { companyId: actors.vake.companyId } });
      const contactsBefore = await prisma.ownerContact.count({
        where: { companyId: actors.vake.companyId },
      });

      const result = await importListing(
        actors.vake,
        payload({
          outcome,
          ...(outcome === 'callback'
            ? { callbackAt: new Date(Date.now() + 86_400_000).toISOString() }
            : {}),
        }),
      );

      expect(result.result).toBe('observation_recorded');
      expect(result.propertyId).toBeNull();

      expect(await prisma.property.count({ where: { companyId: actors.vake.companyId } })).toBe(
        before,
      );
      expect(await prisma.ownerContact.count({ where: { companyId: actors.vake.companyId } })).toBe(
        contactsBefore,
      );

      // Состояние объявления при этом записано: иначе оно всплыло бы в ленте
      // завтра, и второй агент команды позвонил бы тому же собственнику.
      const state = await prisma.observationState.findFirstOrThrow({
        where: { observationId: result.observationId, teamId: actors.vake.teamId as string },
      });
      expect(state.state).toBe(outcome);
    },
  );

  it('телефон сохраняется в индексе даже при отказе (J6)', async () => {
    const input = payload({ outcome: 'refused' });
    const result = await importListing(actors.vake, input);

    const observation = await prisma.listingObservation.findUniqueOrThrow({
      where: { id: result.observationId },
    });
    expect(observation.phoneNormalized).toBe(input.owner.phone.replace(/\s/gu, ''));
  });

  it('«перезвонить» без даты отклоняется', async () => {
    await expect(importListing(actors.vake, payload({ outcome: 'callback' }))).rejects.toThrow(
      ValidationError,
    );
  });

  it('отметка «просил не звонить» действует на компанию, а не на команду', async () => {
    const result = await importListing(
      actors.vake,
      payload({ outcome: 'refused', doNotCallCompanyWide: true }),
    );

    const state = await prisma.observationState.findFirstOrThrow({
      where: { observationId: result.observationId },
    });
    expect(state.doNotCallCompanyWide).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Уровни дедупликации
// ─────────────────────────────────────────────────────────────────────────────

describe('уровень 1 — идемпотентность', () => {
  it('повторная отправка того же объявления не плодит объекты', async () => {
    const input = payload();
    const first = await importListing(actors.vake, input);
    const second = await importListing(actors.vake, input);

    expect(first.result).toBe('created');
    expect(second.result).toBe('duplicate_blocked');
    expect(second.verdict).toBe('EXACT');
    expect(second.propertyId).toBe(first.propertyId);

    const listings = await prisma.sourceListing.count({
      where: { propertyId: first.propertyId as string },
    });
    expect(listings).toBe(1);
  });

  it('повтор с изменившейся ценой обновляет её и пишет историю', async () => {
    // Цена в базе не должна протухать молча — это худший из вариантов (C-05).
    const input = payload({ price: 145000 });
    const first = await importListing(actors.vake, input);
    await importListing(actors.vake, { ...input, price: 138000 });

    const listing = await prisma.sourceListing.findFirstOrThrow({
      where: { propertyId: first.propertyId as string },
      include: { priceHistory: { orderBy: { changedAt: 'asc' } } },
    });

    expect(Number(listing.price)).toBe(138000);
    expect(listing.priceHistory.map((row) => Number(row.price))).toEqual([145000, 138000]);
  });

  it('без externalId ключом служит канонический адрес', async () => {
    const input = payload({ externalId: null });
    const first = await importListing(actors.vake, input);

    // Та же страница, открытая с рекламной меткой и завершающим слэшем.
    const second = await importListing(actors.vake, {
      ...input,
      sourceUrl: `${input.sourceUrl}/?utm_source=telegram`,
    });

    expect(second.result).toBe('duplicate_blocked');
    expect(second.propertyId).toBe(first.propertyId);
  });
});

describe('уровень 2–3 — телефон и параметры', () => {
  it('другой объект с тем же телефоном не считается точным совпадением', async () => {
    const phone = phoneFor(9001);
    await importListing(actors.vake, payload({ owner: { name: 'Гиорги', phone } }));

    // Другая квартира того же собственника: площадь и комнаты иные.
    const second = await importListing(
      actors.vake,
      payload({
        owner: { name: 'Гиорги', phone },
        area: 42,
        rooms: 1,
        address: 'Ваке, ул. Абашидзе 7',
      }),
    );

    expect(second.verdict).not.toBe('EXACT');
    expect(['STRONG', 'POSSIBLE']).toContain(second.verdict);
  });

  it('тот же объект в одной команде предупреждает, а не создаётся молча', async () => {
    const phone = phoneFor(9002);
    const shape = { owner: { name: 'Нино', phone }, area: 78, rooms: 3 };

    await importListing(actors.vake, payload(shape));
    const second = await importListing(actors.vakeSecond, payload(shape));

    expect(second.result).toBe('duplicate_warning');
    expect(second.verdict).toBe('STRONG');
    expect(second.propertyId).toBeNull();
    expect(second.actions).toContain('import_anyway');
  });

  it('агент может настоять на своём и создать объект всё равно', async () => {
    const phone = phoneFor(9003);
    const shape = { owner: { name: 'Леван', phone }, area: 78, rooms: 3 };

    const first = await importListing(actors.vake, payload(shape));
    const blocked = await importListing(actors.vakeSecond, payload(shape));
    expect(blocked.result).toBe('duplicate_warning');

    const forced = await importListing(
      actors.vakeSecond,
      payload({ ...shape, acknowledgedDuplicateOf: [first.propertyId as string] }),
    );

    expect(forced.result).toBe('created');
    expect(forced.propertyId).not.toBe(first.propertyId);
  });
});

describe('объявление с другой площадки', () => {
  it('привязывается к существующему объекту, а не создаёт копию', async () => {
    const phone = phoneFor(9010);
    const shape = {
      owner: { name: 'Мариам', phone },
      area: 64,
      rooms: 2,
      address: 'Ваке, ул. Чавчавадзе 30',
    };

    const first = await importListing(actors.vake, payload({ ...shape, source: 'SS_GE' }));

    const second = await importListing(
      actors.vake,
      payload({
        ...shape,
        source: 'MYHOME_GE',
        sourceUrl: 'https://myhome.ge/ru/pr/900100',
        externalId: 'mh-900100',
      }),
    );

    // Это не дубль, а полезный результат: объект рекламируется на двух
    // площадках. Ради различения этого случая и добавлен четвёртый исход.
    expect(second.result).toBe('linked_to_existing');
    expect(second.propertyId).toBe(first.propertyId);

    const listings = await prisma.sourceListing.findMany({
      where: { propertyId: first.propertyId as string },
      select: { source: true },
    });
    expect(listings.map((listing) => listing.source).sort()).toEqual(['MYHOME_GE', 'SS_GE']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Области проверок (инвариант 9, ADR-0006)
// ─────────────────────────────────────────────────────────────────────────────

describe('области: команда блокирует, компания помечает, арендатор изолирован', () => {
  it('одинаковые объекты в разных компаниях дублями не считаются никогда', async () => {
    const phone = phoneFor(9020);
    const shape = { owner: { name: 'Дато', phone }, area: 55, rooms: 2 };

    const inTbilisi = await importListing(actors.vake, payload(shape));
    const inBatumi = await importListing(actors.batumi, payload(shape));

    expect(inTbilisi.result).toBe('created');
    expect(inBatumi.result).toBe('created');
    expect(inBatumi.matches).toEqual([]);
    expect(inBatumi.otherTeamMatches).toEqual([]);
    expect(inBatumi.propertyId).not.toBe(inTbilisi.propertyId);
  });

  it('одинаковые объекты в разных командах одной компании создаются оба', async () => {
    // Решение владельца: конкуренция между командами допустима.
    const phone = phoneFor(9021);
    const shape = { owner: { name: 'Тамара', phone }, area: 90, rooms: 4 };

    const inVake = await importListing(actors.vake, payload(shape));
    const inSaburtalo = await importListing(actors.saburtalo, payload(shape));

    expect(inVake.result).toBe('created');
    expect(inSaburtalo.result).toBe('created');
    expect(inSaburtalo.propertyId).not.toBe(inVake.propertyId);

    // Но компания знает, что это одна квартира: связка нужна самоимпорту,
    // предупреждению о повторной публикации и отчётности.
    const properties = await prisma.property.findMany({
      where: { id: { in: [inVake.propertyId as string, inSaburtalo.propertyId as string] } },
      select: { propertyLinkId: true },
    });
    expect(properties[0]?.propertyLinkId).not.toBeNull();
    expect(properties[0]?.propertyLinkId).toBe(properties[1]?.propertyLinkId);
  });

  it('совпадение чужой команды приходит пометкой и не блокирует', async () => {
    const phone = phoneFor(9022);
    const shape = { owner: { name: 'Ираклий', phone }, area: 71, rooms: 3 };

    await importListing(actors.vake, payload(shape));
    const other = await importListing(actors.saburtalo, payload(shape));

    expect(other.result).toBe('created');
    expect(other.otherTeamMatches.length).toBeGreaterThan(0);
    expect(other.otherTeamMatches[0]?.scope).toBe('company');
  });

  it('телефон собственника чужой команды в пометке не показывается', async () => {
    const phone = phoneFor(9023);
    const shape = { owner: { name: 'Кето', phone }, area: 68, rooms: 3 };

    await importListing(actors.vake, payload(shape));
    const other = await importListing(actors.saburtalo, payload(shape));

    // Агент понимает «объект ведёт другая команда», но чужого контакта
    // не получает (Q40, C-06).
    expect(other.otherTeamMatches[0]?.preview.ownerPhone).toBeNull();
    expect(other.otherTeamMatches[0]?.preview.team).toBeTruthy();
  });
});

describe('телефон профиля публикации', () => {
  it('не порождает дублей ни в одной команде', async () => {
    // Иначе все объекты агентства станут дублями друг друга: у них один
    // контактный номер (I20). Область проверки — компания, не команда.
    const agencyPhone = phoneFor(9030);

    await createPublishProfile(
      { ...actors.vake, role: 'ADMIN' },
      { displayName: 'Tbilisi Estate — тест', phone: agencyPhone },
    );

    const first = await importListing(
      actors.vake,
      payload({ owner: { name: 'Агентство', phone: agencyPhone }, area: 50, rooms: 2 }),
    );
    const second = await importListing(
      actors.saburtalo,
      payload({ owner: { name: 'Агентство', phone: agencyPhone }, area: 50, rooms: 2 }),
    );

    expect(first.result).toBe('created');
    expect(second.result).toBe('created');
    expect(second.phoneExcluded).toBe('publish_profile');
    expect(second.matches).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Деградация на неполных данных
// ─────────────────────────────────────────────────────────────────────────────

describe('неполные данные', () => {
  it('отсутствие телефона отклоняется понятной ошибкой, а не падением', async () => {
    // ПРАВИЛО 11, вторая линия: расширение не должно было отправить запрос.
    await expect(
      importListing(actors.vake, payload({ owner: { name: 'Без номера', phone: '' } })),
    ).rejects.toThrow(ValidationError);
  });

  it('импорт без площади, адреса и фотографий проходит', async () => {
    const result = await importListing(
      actors.vake,
      payload({
        area: null,
        address: null,
        district: null,
        photos: [],
        floor: null,
        totalFloors: null,
        missingFields: ['area', 'address', 'photos'],
      }),
    );

    expect(result.result).toBe('created');

    const listing = await prisma.sourceListing.findFirstOrThrow({
      where: { propertyId: result.propertyId as string },
    });
    // Что извлечь не удалось — записано честно, а не молча (D9).
    expect(listing.missingFields).toEqual(['area', 'address', 'photos']);
  });

  it('импорт только с телефоном и ссылкой проходит', async () => {
    const result = await importListing(
      actors.vake,
      payload({
        price: null,
        currency: null,
        area: null,
        rooms: null,
        floor: null,
        totalFloors: null,
        district: null,
        address: null,
        description: null,
        photos: [],
      }),
    );

    expect(result.result).toBe('created');
  });
});

describe('журнал действий', () => {
  it('согласие пишется в ActivityLog без персональных данных', async () => {
    const result = await importListing(actors.vake, payload());

    const entry = await prisma.activityLog.findFirstOrThrow({
      where: { entityId: result.propertyId as string, action: 'OWNER_AGREED' },
    });

    expect(entry.companyId).toBe(actors.vake.companyId);

    // ПРАВИЛО 10: ни телефона, ни имени собственника в журнале нет.
    const serialized = JSON.stringify(entry.after);
    expect(serialized).not.toContain('+995');
    expect(serialized).not.toContain('Гиорги');
  });
});
