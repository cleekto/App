import { PublicationStatus, prisma } from '@cleekto/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthContext } from '../auth/context';
import { ConflictError, NotFoundError } from '../errors';
import { importListing, type ImportInput } from '../import/use-cases';
import { createPublishProfile } from '../publish-profiles/use-cases';
import { seed } from '../seed/seed';
import {
  confirmPublication,
  createPublicationDraft,
  listPublications,
  publishCheck,
  reportPublicationFilled,
} from './use-cases';

/**
 * ГЕЙТ ФАЗЫ 4Б. Публикация работает на уровне API и покрыта тестами
 * до первой строки кода заполнения формы (DoD §3.Ф4Б).
 *
 * Chrome здесь не нужен по той же причине, что и в фазе 4: расширение —
 * только транспорт.
 */

interface Actors {
  vake: AuthContext;
  saburtalo: AuthContext;
  vakeAdmin: AuthContext;
  batumi: AuthContext;
  batumiAdmin: AuthContext;
}

let actors: Actors;
let counter = 5000;

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

function phoneFor(seq: number): string {
  return `+9955552${String(seq).padStart(5, '0')}`;
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
    district: 'Vake',
    address: 'Ваке, ул. Чавчавадзе 30',
    description: 'Светлая квартира',
    owner: { name: 'Гиорги', phone: phoneFor(seq) },
    parserVersion: 'ss.ge@1.0.0',
    outcome: 'consent',
    ...over,
  };
}

/** Создаёт объект и наполняет его описание для публикации. */
async function propertyWithDescription(
  ctx: AuthContext,
  publicDescription: string,
  over: Partial<ImportInput> = {},
): Promise<string> {
  const result = await importListing(ctx, payload(over));
  const propertyId = result.propertyId as string;
  await prisma.property.update({ where: { id: propertyId }, data: { publicDescription } });
  return propertyId;
}

beforeAll(async () => {
  await seed();
  actors = {
    vake: await contextFor('agent1@tbilisi-estate.test'),
    saburtalo: await contextFor('agent3@tbilisi-estate.test'),
    vakeAdmin: await contextFor('admin@tbilisi-estate.test'),
    batumi: await contextFor('agent1@batumi-property.test'),
    batumiAdmin: await contextFor('admin@batumi-property.test'),
  };
}, 60_000);

afterAll(async () => {
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────────────────────────
// Правило 13: контакты собственника не уходят на площадку
// ─────────────────────────────────────────────────────────────────────────────

describe('черновик не содержит контактов собственника', () => {
  it('в черновике нет блока owner ни под каким именем', async () => {
    const propertyId = await propertyWithDescription(actors.vake, 'Хорошая квартира');
    const { draft } = await createPublicationDraft(actors.vake, propertyId, {
      targetSource: 'SS_GE',
    });

    // Проверяется не наличие поля, а отсутствие данных: сериализуем целиком
    // и ищем всё, что могло бы оказаться контактом собственника.
    const serialized = JSON.stringify(draft);

    expect(serialized).not.toContain('owner');
    expect(serialized).not.toContain('Гиорги');
    expect(serialized).not.toContain('ownerContact');
  });

  it('номер собственника не проходит ни в одной нормализации', async () => {
    const phone = phoneFor(6001);
    const propertyId = await propertyWithDescription(
      actors.vake,
      'Продаётся квартира. Хозяин Гиорги, звоните.',
      { owner: { name: 'Гиорги', phone } },
    );

    const { draft } = await createPublicationDraft(actors.vake, propertyId, {
      targetSource: 'SS_GE',
    });

    const serialized = JSON.stringify(draft);
    const digits = serialized.replace(/\D/gu, '');
    const national = phone.replace(/\D/gu, '').slice(-9);

    expect(digits).not.toContain(national);
    expect(serialized).not.toContain('Гиорги');
  });

  it('описание с телефоном внутри теряет телефон, а не смысл', async () => {
    const propertyId = await propertyWithDescription(
      actors.vake,
      'Отличная квартира в Ваке. Звонить +995 577 11 22 33 после 18:00. Свежий ремонт.',
    );

    const { draft, sanitized } = await createPublicationDraft(actors.vake, propertyId, {
      targetSource: 'SS_GE',
    });

    expect(draft.publicDescription).not.toContain('577');
    expect(sanitized.removedPhones).toBeGreaterThan(0);
    // Текст объявления при этом остался пригодным.
    expect(draft.publicDescription).toContain('Ваке');
    expect(draft.publicDescription).toContain('ремонт');
  });

  it('в черновике стоит контакт агентства, а не собственника', async () => {
    const propertyId = await propertyWithDescription(actors.vake, 'Квартира');
    const { draft } = await createPublicationDraft(actors.vake, propertyId, {
      targetSource: 'SS_GE',
    });

    const profile = await prisma.publishProfile.findFirstOrThrow({
      where: { companyId: actors.vake.companyId, isDefault: true },
    });

    expect(draft.publisher.phone).toBe(profile.phoneOriginal);
    expect(draft.publisher.displayName).toBe(profile.displayName);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Жизненный цикл публикации
// ─────────────────────────────────────────────────────────────────────────────

describe('жизненный цикл draft → filled → published', () => {
  it('черновик создаётся в статусе draft', async () => {
    const propertyId = await propertyWithDescription(actors.vake, 'Квартира');
    const { publicationId } = await createPublicationDraft(actors.vake, propertyId, {
      targetSource: 'SS_GE',
    });

    const publication = await prisma.publication.findUniqueOrThrow({
      where: { id: publicationId },
    });
    expect(publication.status).toBe(PublicationStatus.draft);
  });

  it('отчёт о заполнении переводит объект в «Принято в работу»', async () => {
    // Статус воронки меняется по факту ЗАПОЛНЕНИЯ, а не публикации:
    // расширение не знает, нажал ли агент «Опубликовать» (J13, инвариант 13).
    const propertyId = await propertyWithDescription(actors.vake, 'Квартира');
    const { publicationId } = await createPublicationDraft(actors.vake, propertyId, {
      targetSource: 'SS_GE',
    });

    await reportPublicationFilled(actors.vake, publicationId, {
      formVersion: 'ss.ge-form@1.0.0',
      filled: ['price', 'area', 'rooms'],
      unfilled: [{ field: 'photos', reason: 'manual_only' }],
    });

    const publication = await prisma.publication.findUniqueOrThrow({
      where: { id: publicationId },
    });
    expect(publication.status).toBe(PublicationStatus.filled);
    expect(publication.filledAt).not.toBeNull();

    const property = await prisma.property.findUniqueOrThrow({
      where: { id: propertyId },
      include: { pipelineStatus: true },
    });
    expect(property.pipelineStatus.code).toBe('IN_PROGRESS');
  });

  it('без подтверждения статус остаётся filled', async () => {
    // Дыра, названная в C-19: объявление живёт на площадке, а мы об этом
    // не знаем. Закрывается запасными признаками самоимпорта.
    const propertyId = await propertyWithDescription(actors.vake, 'Квартира');
    const { publicationId } = await createPublicationDraft(actors.vake, propertyId, {
      targetSource: 'SS_GE',
    });
    await reportPublicationFilled(actors.vake, publicationId, {
      formVersion: 'ss.ge-form@1.0.0',
      filled: [],
      unfilled: [],
    });

    const publication = await prisma.publication.findUniqueOrThrow({
      where: { id: publicationId },
    });
    expect(publication.status).not.toBe(PublicationStatus.published);
    expect(publication.externalId).toBeNull();
  });

  it('подтверждение переводит в published и пишет LISTING_PUBLISHED', async () => {
    const propertyId = await propertyWithDescription(actors.vake, 'Квартира');
    const { publicationId } = await createPublicationDraft(actors.vake, propertyId, {
      targetSource: 'SS_GE',
    });

    await confirmPublication(actors.vake, publicationId, {
      externalId: 'ss-published-1',
      externalUrl: 'https://ss.ge/ru/listing/published-1',
    });

    const publication = await prisma.publication.findUniqueOrThrow({
      where: { id: publicationId },
    });
    expect(publication.status).toBe(PublicationStatus.published);
    expect(publication.publishedAt).not.toBeNull();

    const entry = await prisma.activityLog.findFirst({
      where: { entityId: publicationId, action: 'LISTING_PUBLISHED' },
    });
    expect(entry).not.toBeNull();
  });

  it('повторное подтверждение — конфликт, а не молчаливое обновление', async () => {
    // Два разных externalId у одной записи означают, что что-то пошло не так,
    // и это должно быть видно.
    const propertyId = await propertyWithDescription(actors.vake, 'Квартира');
    const { publicationId } = await createPublicationDraft(actors.vake, propertyId, {
      targetSource: 'SS_GE',
    });

    await confirmPublication(actors.vake, publicationId, {
      externalUrl: 'https://ss.ge/ru/listing/published-2',
    });

    await expect(
      confirmPublication(actors.vake, publicationId, {
        externalUrl: 'https://ss.ge/ru/listing/published-3',
      }),
    ).rejects.toThrow(ConflictError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Петля «своё объявление вернулось обратно» (§5.5)
// ─────────────────────────────────────────────────────────────────────────────

describe('самоимпорт', () => {
  it('импорт своего опубликованного объявления привязывается к объекту', async () => {
    const propertyId = await propertyWithDescription(actors.vake, 'Квартира');
    const { publicationId } = await createPublicationDraft(actors.vake, propertyId, {
      targetSource: 'MYHOME_GE',
    });

    await confirmPublication(actors.vake, publicationId, {
      externalId: 'mh-self-1',
      externalUrl: 'https://myhome.ge/ru/pr/self-1',
    });

    // Через неделю агент находит это объявление на площадке и импортирует.
    const reimport = await importListing(
      actors.vake,
      payload({
        source: 'MYHOME_GE',
        sourceUrl: 'https://myhome.ge/ru/pr/self-1',
        externalId: 'mh-self-1',
      }),
    );

    expect(reimport.result).toBe('linked_to_existing');
    expect(reimport.propertyId).toBe(propertyId);
    expect(reimport.reasonHuman).toContain('агентство');
  });

  it('работает и когда агент не нажал подтверждение', async () => {
    // Ровно тот случай, ради которого добавлен запасной признак (Q31, C-19):
    // объявление живёт на площадке, externalId у нас нет.
    const propertyId = await propertyWithDescription(actors.vake, 'Квартира');
    const { publicationId } = await createPublicationDraft(actors.vake, propertyId, {
      targetSource: 'MYHOME_GE',
    });
    await reportPublicationFilled(actors.vake, publicationId, {
      formVersion: 'myhome-form@1.0.0',
      filled: ['price'],
      unfilled: [],
    });

    // Ссылку записал не агент, а расширение при распознавании страницы.
    await prisma.publication.update({
      where: { id: publicationId },
      data: { externalUrl: 'https://myhome.ge/ru/pr/self-2' },
    });

    const reimport = await importListing(
      actors.vake,
      payload({
        source: 'MYHOME_GE',
        sourceUrl: 'https://myhome.ge/ru/pr/self-2',
        externalId: null,
      }),
    );

    expect(reimport.result).toBe('linked_to_existing');
    expect(reimport.propertyId).toBe(propertyId);
  });

  it('объявление соседней команды тоже опознаётся как своё', async () => {
    // Область проверки — компания, не команда: разместить могла соседняя
    // команда, и её публикация — тоже публикация нашего агентства.
    const propertyId = await propertyWithDescription(actors.vake, 'Квартира');
    const { publicationId } = await createPublicationDraft(actors.vake, propertyId, {
      targetSource: 'MYHOME_GE',
    });
    await confirmPublication(actors.vake, publicationId, {
      externalId: 'mh-self-3',
      externalUrl: 'https://myhome.ge/ru/pr/self-3',
    });

    const reimport = await importListing(
      actors.saburtalo,
      payload({
        source: 'MYHOME_GE',
        sourceUrl: 'https://myhome.ge/ru/pr/self-3',
        externalId: 'mh-self-3',
      }),
    );

    expect(reimport.result).toBe('linked_to_existing');
    expect(reimport.propertyId).toBe(propertyId);
  });

  it('телефон профиля публикации не порождает дублей между объектами компании', async () => {
    const agencyPhone = phoneFor(6100);
    await createPublishProfile(actors.vakeAdmin, {
      displayName: 'Tbilisi Estate — второй',
      phone: agencyPhone,
    });

    const first = await importListing(
      actors.vake,
      payload({ owner: { name: 'Агентство', phone: agencyPhone }, area: 51, rooms: 2 }),
    );
    const second = await importListing(
      actors.vake,
      payload({ owner: { name: 'Агентство', phone: agencyPhone }, area: 51, rooms: 2 }),
    );

    expect(first.result).toBe('created');
    expect(second.result).toBe('created');
    expect(second.phoneExcluded).toBe('publish_profile');
    expect(second.propertyId).not.toBe(first.propertyId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Изоляция арендаторов
// ─────────────────────────────────────────────────────────────────────────────

describe('публикации и профили другой компании недоступны', () => {
  it('нельзя собрать черновик для объекта другой компании', async () => {
    const propertyId = await propertyWithDescription(actors.batumi, 'Квартира в Батуми');

    await expect(
      createPublicationDraft(actors.vake, propertyId, { targetSource: 'SS_GE' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('нельзя применить профиль публикации другой компании', async () => {
    const propertyId = await propertyWithDescription(actors.vake, 'Квартира');
    const foreignProfile = await prisma.publishProfile.findFirstOrThrow({
      where: { companyId: actors.batumi.companyId },
    });

    await expect(
      createPublicationDraft(actors.vake, propertyId, {
        targetSource: 'SS_GE',
        publishProfileId: foreignProfile.id,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('нельзя подтвердить публикацию другой компании', async () => {
    const propertyId = await propertyWithDescription(actors.batumi, 'Квартира в Батуми');
    const { publicationId } = await createPublicationDraft(actors.batumi, propertyId, {
      targetSource: 'SS_GE',
    });

    await expect(
      confirmPublication(actors.vake, publicationId, {
        externalUrl: 'https://ss.ge/ru/listing/foreign',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('список публикаций не пересекает границу компании', async () => {
    const propertyId = await propertyWithDescription(actors.batumi, 'Квартира в Батуми');
    await createPublicationDraft(actors.batumi, propertyId, { targetSource: 'SS_GE' });

    await expect(listPublications(actors.vake, propertyId)).rejects.toThrow(NotFoundError);

    const own = await listPublications(actors.batumi, propertyId);
    expect(own.length).toBeGreaterThan(0);
  });

  it('самоимпорт не опознаётся по публикации ЧУЖОЙ компании', async () => {
    // Иначе объявление другого агентства привязалось бы к нашему объекту.
    const foreignProperty = await propertyWithDescription(actors.batumi, 'Квартира');
    const { publicationId } = await createPublicationDraft(actors.batumi, foreignProperty, {
      targetSource: 'MYHOME_GE',
    });
    await confirmPublication(actors.batumi, publicationId, {
      externalId: 'mh-foreign-1',
      externalUrl: 'https://myhome.ge/ru/pr/foreign-1',
    });

    const ours = await importListing(
      actors.vake,
      payload({
        source: 'MYHOME_GE',
        sourceUrl: 'https://myhome.ge/ru/pr/foreign-1',
        externalId: 'mh-foreign-1',
      }),
    );

    expect(ours.result).toBe('created');
    expect(ours.propertyId).not.toBe(foreignProperty);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Предупреждение перед публикацией
// ─────────────────────────────────────────────────────────────────────────────

describe('проверка «объект уже размещён»', () => {
  it('предупреждает об объявлении, из которого объект импортирован', async () => {
    const result = await importListing(actors.vake, payload({ source: 'SS_GE' }));
    const check = await publishCheck(actors.vake, result.propertyId as string, 'SS_GE');

    expect(check.alreadyPublished).toBe(true);
    expect(check.actions).toContain('publish_anyway');
    expect(check.reasonHuman).toBeTruthy();
  });

  it('на другой площадке предупреждения нет', async () => {
    const result = await importListing(actors.vake, payload({ source: 'SS_GE' }));
    const check = await publishCheck(actors.vake, result.propertyId as string, 'MYHOME_GE');

    expect(check.alreadyPublished).toBe(false);
    expect(check.actions).toEqual(['proceed']);
  });

  it('учитывает публикацию соседней команды через связку объектов', async () => {
    // Публиковать одну квартиру дважды от имени одного агентства нельзя,
    // даже если её ведут разные команды (ADR-0006).
    const phone = phoneFor(6200);
    const shape = { owner: { name: 'Кето', phone }, area: 83, rooms: 3 };

    const inVake = await importListing(actors.vake, payload(shape));
    const inSaburtalo = await importListing(actors.saburtalo, payload(shape));

    const { publicationId } = await createPublicationDraft(
      actors.vake,
      inVake.propertyId as string,
      { targetSource: 'MYHOME_GE' },
    );
    await confirmPublication(actors.vake, publicationId, {
      externalUrl: 'https://myhome.ge/ru/pr/cross-team-1',
    });

    const check = await publishCheck(
      actors.saburtalo,
      inSaburtalo.propertyId as string,
      'MYHOME_GE',
    );
    expect(check.alreadyPublished).toBe(true);
  });
});
