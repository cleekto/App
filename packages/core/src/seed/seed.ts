import { RoleCode, prisma } from '@cleekto/db';

import { hashPassword } from '../auth/password';
import { ensureRoles } from '../auth/roles';
import { normalizePhone } from '../phone';
import { DEFAULT_PIPELINE_STATUSES } from '../pipeline/defaults';

/**
 * Тестовые данные.
 *
 * ДВЕ КОМПАНИИ — не для красоты. Изоляция арендаторов проверяется негативными
 * тестами на каждом эндпоинте (правило 5, DoD фазы 3), а для этого нужна
 * вторая компания с настоящими данными, а не пустая заготовка.
 *
 * Пароли одинаковые и заведомо тестовые: сид никогда не выполняется на боевой
 * базе, и это проверяется в самом начале.
 */

const SEED_PASSWORD = 'cleekto-local-dev-password';

interface SeededUser {
  email: string;
  fullName: string;
  role: RoleCode;
  team: string | null;
}

interface SeededCompany {
  name: string;
  locale: string;
  teams: readonly string[];
  users: readonly SeededUser[];
  publishProfile: { displayName: string; phone: string };
}

const COMPANIES: readonly SeededCompany[] = [
  {
    name: 'Tbilisi Estate',
    locale: 'ka',
    teams: ['Vake', 'Saburtalo'],
    users: [
      {
        email: 'admin@tbilisi-estate.test',
        fullName: 'Nino Beridze',
        role: RoleCode.ADMIN,
        team: null,
      },
      {
        email: 'manager@tbilisi-estate.test',
        fullName: 'Giorgi Kapanadze',
        role: RoleCode.MANAGER,
        team: 'Vake',
      },
      {
        email: 'agent1@tbilisi-estate.test',
        fullName: 'Ana Tsiklauri',
        role: RoleCode.AGENT,
        team: 'Vake',
      },
      {
        email: 'agent2@tbilisi-estate.test',
        fullName: 'Levan Gogoladze',
        role: RoleCode.AGENT,
        team: 'Vake',
      },
      {
        email: 'agent3@tbilisi-estate.test',
        fullName: 'Mariam Chkheidze',
        role: RoleCode.AGENT,
        team: 'Saburtalo',
      },
    ],
    publishProfile: { displayName: 'Tbilisi Estate', phone: '+995 555 10 10 10' },
  },
  {
    // Вторая компания существует ради негативных тестов изоляции.
    // Её данные должны быть настоящими, иначе тест «компания A не видит
    // компанию B» проходил бы просто потому, что у B ничего нет.
    name: 'Batumi Property',
    locale: 'ru',
    teams: ['Центр', 'Новый бульвар'],
    users: [
      {
        email: 'admin@batumi-property.test',
        fullName: 'Дато Кванталиани',
        role: RoleCode.ADMIN,
        team: null,
      },
      {
        email: 'manager@batumi-property.test',
        fullName: 'Тамара Джапаридзе',
        role: RoleCode.MANAGER,
        team: 'Центр',
      },
      {
        email: 'agent1@batumi-property.test',
        fullName: 'Ираклий Мчедлишвили',
        role: RoleCode.AGENT,
        team: 'Центр',
      },
    ],
    publishProfile: { displayName: 'Batumi Property', phone: '+995 577 20 20 20' },
  },
];

export interface SeedResult {
  companies: Array<{ id: string; name: string; users: number; teams: number }>;
  password: string;
}

/**
 * Заполняет базу тестовыми данными, предварительно очистив её.
 *
 * Очистка обязательна: сид, дописывающий поверх существующего, через неделю
 * даёт базу, состояние которой никто не может воспроизвести.
 */
export async function seed(): Promise<SeedResult> {
  assertNotProduction();

  // Порядок обратный зависимостям: сначала то, что ссылается.
  //
  // ListingObservation чистится ЯВНО, хотя каскада от компании к нему нет
  // и быть не может: индекс общий для всех компаний (инвариант 16). Без
  // этой строки наблюдения пережили бы пересев, и тесты видели бы данные
  // предыдущего прогона.
  await prisma.observationState.deleteMany();
  await prisma.observationPriceHistory.deleteMany();
  await prisma.listingObservation.deleteMany();
  await prisma.sourceListingPriceHistory.deleteMany();
  await prisma.sourceListing.deleteMany();
  await prisma.property.deleteMany();
  await prisma.propertyLink.deleteMany();
  await prisma.ownerContactPhone.deleteMany();
  await prisma.ownerContact.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.publishProfile.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.pipelineStatus.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();
  await prisma.company.deleteMany();

  const roles = await ensureRoles(prisma);
  const passwordHash = await hashPassword(SEED_PASSWORD);

  const result: SeedResult['companies'] = [];

  for (const spec of COMPANIES) {
    const company = await prisma.company.create({
      data: {
        name: spec.name,
        locale: spec.locale,
        pipelineStatuses: { create: [...DEFAULT_PIPELINE_STATUSES] },
        teams: { create: spec.teams.map((name) => ({ name })) },
      },
      include: { teams: true },
    });

    const teamByName = new Map(company.teams.map((team) => [team.name, team.id]));

    for (const spec_user of spec.users) {
      const teamId = spec_user.team === null ? null : (teamByName.get(spec_user.team) ?? null);

      await prisma.user.create({
        data: {
          companyId: company.id,
          roleId: roles[spec_user.role],
          email: spec_user.email,
          passwordHash,
          fullName: spec_user.fullName,
          locale: spec.locale,
          ...(teamId === null
            ? {}
            : { teamMemberships: { create: { companyId: company.id, teamId } } }),
        },
      });
    }

    const phone = normalizePhone(spec.publishProfile.phone);
    await prisma.publishProfile.create({
      data: {
        companyId: company.id,
        displayName: spec.publishProfile.displayName,
        phoneOriginal: phone.original,
        phoneNormalized: phone.normalized,
        isDefault: true,
      },
    });

    result.push({
      id: company.id,
      name: company.name,
      users: spec.users.length,
      teams: spec.teams.length,
    });
  }

  return { companies: result, password: SEED_PASSWORD };
}

/**
 * Сид стирает базу целиком. Запускать его на боевой — катастрофа,
 * поэтому проверка стоит до первого запроса, а не в документации.
 */
function assertNotProduction(): void {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('Сид не выполняется при NODE_ENV=production: он стирает базу целиком.');
  }

  const url = process.env['DATABASE_URL'] ?? '';
  if (/localhost|127\.0\.0\.1|@postgres[:/]/u.test(url)) return;

  /**
   * Удалённая база — только если её ИМЯ НАЗВАНО ЯВНО.
   *
   * Понадобилось для веток разработки в Neon: локального Postgres может
   * не быть, а ветка — расходная копия, которую и надо засевать.
   *
   * Ключ устроен так, что повернуть его случайно нельзя: недостаточно
   * выставить флаг «да, я уверен» — надо вписать хост той самой базы,
   * которую сейчас сотрут. Опечатка означает отказ, а не стирание чужого.
   */
  const declared = process.env['SEED_TARGET_HOST'] ?? '';
  const actual = hostOf(url);

  if (declared !== '' && actual !== null && declared === actual) return;

  throw new Error(
    `DATABASE_URL не выглядит локальным (${actual ?? 'хост не разобран'}). ` +
      'Сид стирает базу целиком. Чтобы засеять удалённую ветку разработки, ' +
      'назовите её хост в SEED_TARGET_HOST — тем самым подтвердив, что именно её и стираете.',
  );
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
