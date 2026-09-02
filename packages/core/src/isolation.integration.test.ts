import { RoleCode, prisma } from '@kleekto/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthContext } from './auth/context';
import { currentUser } from './auth/use-cases';
import { ForbiddenError, NotFoundError } from './errors';
import { listPipelineStatuses } from './pipeline/use-cases';
import {
  createPublishProfile,
  deletePublishProfile,
  listPublishProfiles,
} from './publish-profiles/use-cases';
import { seed } from './seed/seed';
import { createTeam, listTeams } from './teams/use-cases';
import { createUser, deactivateUser, listUsers } from './users/use-cases';

/**
 * ГЕЙТ ФАЗЫ 3. Без этих тестов фаза не закрывается (правило 5, DoD §3.Ф3).
 *
 * Проверяется на настоящей базе с двумя настоящими компаниями. Тест
 * с пустой второй компанией проходил бы просто потому, что у неё ничего нет,
 * и не проверял бы ничего.
 */

interface Actors {
  adminA: AuthContext;
  managerA: AuthContext;
  agentA: AuthContext;
  agentAOtherTeam: AuthContext;
  adminB: AuthContext;
  agentB: AuthContext;
}

let actors: Actors;
let companyBTeamId: string;
let companyBUserId: string;
let companyBProfileId: string;

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

beforeAll(async () => {
  await seed();

  actors = {
    adminA: await contextFor('admin@tbilisi-estate.test'),
    managerA: await contextFor('manager@tbilisi-estate.test'),
    agentA: await contextFor('agent1@tbilisi-estate.test'),
    agentAOtherTeam: await contextFor('agent3@tbilisi-estate.test'),
    adminB: await contextFor('admin@batumi-property.test'),
    agentB: await contextFor('agent1@batumi-property.test'),
  };

  const teamB = await prisma.team.findFirstOrThrow({
    where: { companyId: actors.adminB.companyId },
  });
  companyBTeamId = teamB.id;
  companyBUserId = actors.agentB.userId;

  const profileB = await prisma.publishProfile.create({
    data: {
      companyId: actors.adminB.companyId,
      displayName: 'Batumi Property — расходный',
      phoneOriginal: '+995 577 21 21 21',
      phoneNormalized: '+995577212121',
    },
  });
  companyBProfileId = profileB.id;
}, 60_000);

afterAll(async () => {
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────────────────────────
// Позитивные: каждая роль делает разрешённое
// ─────────────────────────────────────────────────────────────────────────────

describe('позитивные сценарии по ролям', () => {
  it('администратор видит всех пользователей своей компании', async () => {
    const users = await listUsers(actors.adminA);
    expect(users.length).toBe(5);
  });

  it('менеджер видит только свою команду', async () => {
    const users = await listUsers(actors.managerA);
    expect(users.length).toBeGreaterThan(0);
    expect(users.every((user) => user.teamId === actors.managerA.teamId)).toBe(true);
  });

  it('агент видит свою команду и не видит соседнюю', async () => {
    const users = await listUsers(actors.agentA);
    expect(users.every((user) => user.teamId === actors.agentA.teamId)).toBe(true);

    const otherTeamUsers = await listUsers(actors.agentAOtherTeam);
    const idsHere = new Set(users.map((user) => user.id));
    expect(otherTeamUsers.some((user) => idsHere.has(user.id))).toBe(false);
  });

  it('все роли читают статусы воронки, и их пять (§5Б.4)', async () => {
    for (const ctx of [actors.adminA, actors.managerA, actors.agentA]) {
      const statuses = await listPipelineStatuses(ctx);
      expect(statuses.length).toBe(5);
      expect(statuses.map((status) => status.code)).toEqual([
        'IN_BASE',
        'IN_PROGRESS',
        'OFFERED',
        'CLOSED',
        'ARCHIVED',
      ]);
    }
  });

  it('администратор создаёт команду', async () => {
    const team = await createTeam(actors.adminA, 'Gldani');
    expect(team.name).toBe('Gldani');
  });

  it('менеджер создаёт агента в своей команде', async () => {
    const user = await createUser(actors.managerA, {
      email: 'new-agent@tbilisi-estate.test',
      password: 'another-long-password',
      fullName: 'Salome Kiknadze',
      role: RoleCode.AGENT,
    });

    expect(user.role).toBe(RoleCode.AGENT);
    // Область менеджера — команда: агент попадает в его команду,
    // а не в ту, которую менеджер укажет.
    expect(user.teamId).toBe(actors.managerA.teamId);
  });

  it('администратор создаёт профиль публикации', async () => {
    const profile = await createPublishProfile(actors.adminA, {
      displayName: 'Tbilisi Estate — Vake',
      phone: '+995 555 33 33 33',
    });
    expect(profile.phone).toBe('+995 555 33 33 33');
  });

  it('в журнал попадают действия (инвариант 7)', async () => {
    const entries = await prisma.activityLog.findMany({
      where: { companyId: actors.adminA.companyId },
    });
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((entry) => entry.action === 'COMPANY_REGISTERED')).toBe(false);
    expect(entries.some((entry) => entry.action === 'TEAM_CREATED')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Негативные: изоляция арендаторов
// ─────────────────────────────────────────────────────────────────────────────

describe('изоляция компаний — ни один сценарий не отдаёт чужие данные', () => {
  it('список пользователей не содержит пользователей другой компании', async () => {
    const usersA = await listUsers(actors.adminA);
    const usersB = await listUsers(actors.adminB);

    const idsB = new Set(usersB.map((user) => user.id));
    expect(usersA.some((user) => idsB.has(user.id))).toBe(false);
    expect(usersA.every((user) => !user.email.includes('batumi'))).toBe(true);
  });

  it('список команд не содержит команд другой компании', async () => {
    const teamsA = await listTeams(actors.adminA);
    const teamsB = await listTeams(actors.adminB);

    const idsB = new Set(teamsB.map((team) => team.id));
    expect(teamsA.some((team) => idsB.has(team.id))).toBe(false);
  });

  it('список профилей публикации не содержит профилей другой компании', async () => {
    const profilesA = await listPublishProfiles(actors.adminA);
    const profilesB = await listPublishProfiles(actors.adminB);

    const idsB = new Set(profilesB.map((profile) => profile.id));
    expect(profilesA.some((profile) => idsB.has(profile.id))).toBe(false);
    expect(profilesA.every((profile) => profile.displayName !== 'Batumi Property')).toBe(true);
  });

  it('статусы воронки не пересекаются между компаниями', async () => {
    const statusesA = await listPipelineStatuses(actors.adminA);
    const statusesB = await listPipelineStatuses(actors.adminB);

    const idsB = new Set(statusesB.map((status) => status.id));
    expect(statusesA.some((status) => idsB.has(status.id))).toBe(false);
  });

  it('нельзя создать пользователя в команде другой компании', async () => {
    // Через teamId можно было бы дотянуться до чужой команды, если бы
    // сценарий не проверял её принадлежность компании из контекста.
    await expect(
      createUser(actors.adminA, {
        email: 'intruder@tbilisi-estate.test',
        password: 'long-enough-password',
        fullName: 'Intruder',
        role: RoleCode.AGENT,
        teamId: companyBTeamId,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('нельзя привязать профиль публикации к сотруднику другой компании', async () => {
    await expect(
      createPublishProfile(actors.adminA, {
        displayName: 'Чужой сотрудник',
        phone: '+995 555 99 99 99',
        userId: companyBUserId,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('нельзя удалить профиль публикации другой компании', async () => {
    await expect(deletePublishProfile(actors.adminA, companyBProfileId)).rejects.toThrow(
      NotFoundError,
    );

    // И профиль остался на месте.
    const survived = await prisma.publishProfile.findUnique({ where: { id: companyBProfileId } });
    expect(survived).not.toBeNull();
  });

  it('нельзя отключить пользователя другой компании', async () => {
    await expect(deactivateUser(actors.adminA, companyBUserId)).rejects.toThrow(NotFoundError);

    const survived = await prisma.user.findUniqueOrThrow({ where: { id: companyBUserId } });
    expect(survived.isActive).toBe(true);
  });

  it('подделанный контекст с чужой компанией не даёт доступа', async () => {
    // Именно этот случай защищает правило 5: даже если бы companyId пришёл
    // из запроса, сценарий не нашёл бы пользователя.
    const forged: AuthContext = { ...actors.adminA, companyId: actors.adminB.companyId };
    await expect(currentUser(forged)).rejects.toThrow(NotFoundError);
  });

  it('чужая компания неотличима от отсутствующего ресурса', async () => {
    // NOT_FOUND, а не FORBIDDEN: 403 подтвердил бы существование объекта,
    // и по перебору идентификаторов оценивался бы размер базы конкурента.
    // Проверяется на пользователе, а не на профиле: предыдущий тест уже
    // трогал профиль, и повторная проверка на нём зависела бы от его исхода.
    await expect(deactivateUser(actors.adminA, companyBUserId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Негативные: агент не выполняет действия менеджера
// ─────────────────────────────────────────────────────────────────────────────

describe('роли — агент не выполняет действия менеджера', () => {
  it('агент не создаёт команду', async () => {
    await expect(createTeam(actors.agentA, 'Самовольная команда')).rejects.toThrow(ForbiddenError);
  });

  it('агент не создаёт пользователей', async () => {
    await expect(
      createUser(actors.agentA, {
        email: 'agent-made@tbilisi-estate.test',
        password: 'long-enough-password',
        fullName: 'Кто-то',
        role: RoleCode.AGENT,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('агент не заводит профиль публикации', async () => {
    // Профиль — лицо агентства в публичном объявлении. Иначе агент подставит
    // личный номер вместо рабочего (I15).
    await expect(
      createPublishProfile(actors.agentA, {
        displayName: 'Личный номер агента',
        phone: '+995 555 44 44 44',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('агент не отключает пользователей', async () => {
    await expect(deactivateUser(actors.agentA, actors.agentAOtherTeam.userId)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('менеджер не создаёт менеджера и не создаёт администратора', async () => {
    // Иначе роль менеджера превращается в администратора за два клика (Q2).
    for (const role of [RoleCode.MANAGER, RoleCode.ADMIN]) {
      await expect(
        createUser(actors.managerA, {
          email: `escalation-${role}@tbilisi-estate.test`,
          password: 'long-enough-password',
          fullName: 'Повышение прав',
          role,
        }),
      ).rejects.toThrow(ForbiddenError);
    }
  });

  it('менеджер не отключает пользователей', async () => {
    await expect(deactivateUser(actors.managerA, actors.agentA.userId)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('администратор не может отключить самого себя', async () => {
    await expect(deactivateUser(actors.adminA, actors.adminA.userId)).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Отдельно: профили публикации между компаниями (DoD §3.Ф3)
// ─────────────────────────────────────────────────────────────────────────────

describe('профили публикации не пересекают границу компании', () => {
  it('агент компании A видит профили только своей компании', async () => {
    const profiles = await listPublishProfiles(actors.agentA);
    expect(profiles.length).toBeGreaterThan(0);

    const companyIds = await prisma.publishProfile.findMany({
      where: { id: { in: profiles.map((profile) => profile.id) } },
      select: { companyId: true },
    });
    expect(companyIds.every((row) => row.companyId === actors.agentA.companyId)).toBe(true);
  });

  it('телефон профиля другой компании недостижим ни одним сценарием', async () => {
    const profiles = await listPublishProfiles(actors.adminA);
    const phones = profiles.map((profile) => profile.phone);

    // Номер компании B из сида. Он не должен всплыть у компании A —
    // иначе сломается исключение своих номеров из дедупликации (I20).
    expect(phones).not.toContain('+995 577 20 20 20');
  });
});
