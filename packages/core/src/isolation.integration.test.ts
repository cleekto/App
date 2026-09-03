import { RoleCode, prisma } from '@kleekto/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthContext } from './auth/context';
import { currentUser } from './auth/use-cases';
import { ForbiddenError, NotFoundError, ValidationError } from './errors';
import {
  createPipelineStatus,
  deletePipelineStatus,
  listPipelineStatuses,
  reorderPipelineStatuses,
  updatePipelineStatus,
} from './pipeline/use-cases';
import { seed } from './seed/seed';
import { createTeam, deleteTeam, listTeams, updateTeam } from './teams/use-cases';
import { createUser, deactivateUser, listUsers, updateUser } from './users/use-cases';

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

  it('администратор вписывает сотруднику рабочий телефон', async () => {
    const updated = await updateUser(actors.adminA, actors.agentAOtherTeam.userId, {
      phone: '+995 555 33 33 33',
    });
    expect(updated.phone).toBe('+995 555 33 33 33');
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

  it('список сотрудников не отдаёт рабочие телефоны другой компании', async () => {
    // Рабочий номер — то, чем агентство опознаёт свои объявления. Утечь
    // в соседнюю компанию он не должен: там он сломал бы дедупликацию,
    // исключив чужой номер из признаков собственника (I20).
    const usersA = await listUsers(actors.adminA);
    const usersB = await listUsers(actors.adminB);

    const phonesB = new Set(usersB.map((user) => user.phone).filter((phone) => phone !== null));
    expect(phonesB.size).toBeGreaterThan(0);
    expect(usersA.some((user) => user.phone !== null && phonesB.has(user.phone))).toBe(false);
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

  it('нельзя вписать телефон сотруднику другой компании', async () => {
    await expect(
      updateUser(actors.adminA, companyBUserId, { phone: '+995 555 99 99 99' }),
    ).rejects.toThrow(NotFoundError);

    const untouched = await prisma.user.findUniqueOrThrow({ where: { id: companyBUserId } });
    expect(untouched.phone).not.toBe('+995 555 99 99 99');
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

  it('агент не вписывает телефон ни себе, ни соседу', async () => {
    // Номер уходит в публичное объявление: подменив его, агент увёл бы к себе
    // звонки по объявлениям агентства (I15).
    await expect(
      updateUser(actors.agentA, actors.agentAOtherTeam.userId, { phone: '+995 555 44 44 44' }),
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

  it('агент не переименовывает и не удаляет команды', async () => {
    const teams = await listTeams(actors.agentA);
    const own = teams[0];
    if (own === undefined) throw new Error('у агента нет команды');

    await expect(updateTeam(actors.agentA, own.id, { name: 'Моя команда' })).rejects.toThrow(
      ForbiddenError,
    );
    await expect(deleteTeam(actors.agentA, own.id)).rejects.toThrow(ForbiddenError);
  });

  it('менеджер переименовывает свою команду, но не соседнюю', async () => {
    const teams = await listTeams(actors.adminA);
    const own = teams.find((team) => team.id === actors.managerA.teamId);
    const other = teams.find((team) => team.id !== actors.managerA.teamId);
    if (own === undefined || other === undefined) throw new Error('нужно две команды');

    const renamed = await updateTeam(actors.managerA, own.id, { name: 'Ваке — центр' });
    expect(renamed.name).toBe('Ваке — центр');

    // Соседняя команда — чужая область, и переименование её было бы
    // распоряжением не своим (та же граница, что и у людей).
    await expect(updateTeam(actors.managerA, other.id, { name: 'Захвачено' })).rejects.toThrow(
      ForbiddenError,
    );

    await updateTeam(actors.adminA, own.id, { name: own.name });
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

describe('рабочие телефоны не пересекают границу компании', () => {
  it('агент не читает список сотрудников соседней компании', async () => {
    const usersA = await listUsers(actors.agentA);
    const idsB = new Set((await listUsers(actors.adminB)).map((user) => user.id));

    expect(usersA.some((user) => idsB.has(user.id))).toBe(false);
  });

  it('телефон сотрудника другой компании недостижим ни одним сценарием', async () => {
    const phones = (await listUsers(actors.adminA)).map((user) => user.phone);

    // Номер сотрудника компании B из сида. Он не должен всплыть у компании A —
    // иначе сломается исключение своих номеров из дедупликации (I20).
    expect(phones).not.toContain('+995 577 20 20 21');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Изменение сотрудника: каждая защита проверяется попыткой её обойти
// ─────────────────────────────────────────────────────────────────────────────

describe('изменение сотрудника', () => {
  it('администратор переименовывает сотрудника своей компании', async () => {
    const updated = await updateUser(actors.adminA, actors.agentA.userId, {
      fullName: 'Агент Переименованный',
    });
    expect(updated.fullName).toBe('Агент Переименованный');
  });

  it('чужого сотрудника не достать даже с верным id', async () => {
    // companyId берётся из контекста (правило 5), поэтому существующий
    // id из компании B выглядит отсюда как несуществующий.
    await expect(
      updateUser(actors.adminA, companyBUserId, { fullName: 'Захвачен' }),
    ).rejects.toThrow(NotFoundError);

    const untouched = await prisma.user.findUniqueOrThrow({ where: { id: companyBUserId } });
    expect(untouched.fullName).not.toBe('Захвачен');
  });

  it('агент меняет своё имя, но не свою роль', async () => {
    const renamed = await updateUser(actors.agentA, actors.agentA.userId, {
      fullName: 'Агент Сам Себя',
    });
    expect(renamed.fullName).toBe('Агент Сам Себя');

    await expect(
      updateUser(actors.agentA, actors.agentA.userId, { role: RoleCode.ADMIN }),
    ).rejects.toThrow();
  });

  it('агент не меняет соседа', async () => {
    await expect(
      updateUser(actors.agentA, actors.agentAOtherTeam.userId, { fullName: 'Чужое имя' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('менеджер не назначает роль выше агента', async () => {
    for (const role of [RoleCode.MANAGER, RoleCode.ADMIN]) {
      await expect(updateUser(actors.managerA, actors.agentA.userId, { role })).rejects.toThrow(
        ForbiddenError,
      );
    }
  });

  it('менеджер не трогает человека вне своей команды', async () => {
    await expect(
      updateUser(actors.managerA, actors.agentAOtherTeam.userId, { fullName: 'Не моя команда' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('менеджер не выводит человека из своей команды', async () => {
    // Иначе перевод в соседнюю команду — распоряжение чужой областью.
    await expect(
      updateUser(actors.managerA, actors.agentA.userId, { teamId: null }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('никто не меняет собственную роль', async () => {
    await expect(
      updateUser(actors.adminA, actors.adminA.userId, { role: RoleCode.AGENT }),
    ).rejects.toThrow(ValidationError);
  });

  it('никто не отключает сам себя', async () => {
    await expect(
      updateUser(actors.adminA, actors.adminA.userId, { isActive: false }),
    ).rejects.toThrow(ValidationError);
  });

  it('последнего администратора компании отключить нельзя', async () => {
    const admins = await prisma.user.count({
      where: {
        companyId: actors.adminA.companyId,
        isActive: true,
        role: { code: RoleCode.ADMIN },
      },
    });
    expect(admins).toBe(1);

    // Отключает не сам себя, а второй администратор — иначе сработала бы
    // защита «сам себя» и настоящая проверка осталась бы непройденной.
    const second = await createUser(actors.adminA, {
      email: 'second-admin@tbilisi-estate.test',
      password: 'long-enough-password',
      fullName: 'Второй администратор',
      role: RoleCode.ADMIN,
    });
    const secondCtx = await contextFor('second-admin@tbilisi-estate.test');

    // Пока администраторов двое — отключение проходит.
    await updateUser(secondCtx, actors.adminA.userId, { isActive: false });

    // И теперь последнего оставшегося отключить уже нельзя.
    await expect(updateUser(actors.adminA, second.id, { isActive: false })).rejects.toThrow(
      ValidationError,
    );

    // И это тоже проверка, а не уборка: включение администратора обратно
    // никого прав не лишает, и запрещать его нельзя. Первая версия защиты
    // считала администраторов до изменения и на этой строке падала.
    const restored = await updateUser(secondCtx, actors.adminA.userId, { isActive: true });
    expect(restored.isActive).toBe(true);
  });

  it('отключение через изменение гасит сессии так же, как отдельное отключение', async () => {
    // Отключить можно двумя путями — `DELETE` и правкой доступа. Если один
    // из них оставляет живой refresh-токен, отключённый выпишет себе новый
    // доступ и продолжит работать.
    const target = actors.agentAOtherTeam.userId;

    const token = await prisma.refreshToken.create({
      data: {
        userId: target,
        tokenHash: `test-${Date.now()}`,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    await updateUser(actors.adminA, target, { isActive: false });

    const after = await prisma.refreshToken.findUniqueOrThrow({ where: { id: token.id } });
    expect(after.revokedAt).not.toBeNull();

    await updateUser(actors.adminA, target, { isActive: true });
  });

  it('отключённый и включённый обратно сотрудник виден в списке в обоих состояниях', async () => {
    const target = actors.agentAOtherTeam.userId;

    await updateUser(actors.adminA, target, { isActive: false });
    const off = await listUsers(actors.adminA);
    expect(off.find((user) => user.id === target)?.isActive).toBe(false);

    await updateUser(actors.adminA, target, { isActive: true });
    const on = await listUsers(actors.adminA);
    expect(on.find((user) => user.id === target)?.isActive).toBe(true);
  });

  it('смена роли обесценивает выданные токены', async () => {
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: actors.agentAOtherTeam.userId },
      select: { tokenVersion: true },
    });

    await updateUser(actors.adminA, actors.agentAOtherTeam.userId, { role: RoleCode.MANAGER });

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: actors.agentAOtherTeam.userId },
      select: { tokenVersion: true },
    });
    expect(after.tokenVersion).toBeGreaterThan(before.tokenVersion);

    await updateUser(actors.adminA, actors.agentAOtherTeam.userId, { role: RoleCode.AGENT });
  });

  it('переименование токены не трогает — человек не должен вылетать из сессии', async () => {
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: actors.agentA.userId },
      select: { tokenVersion: true },
    });

    await updateUser(actors.adminA, actors.agentA.userId, { fullName: 'Просто новое имя' });

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: actors.agentA.userId },
      select: { tokenVersion: true },
    });
    expect(after.tokenVersion).toBe(before.tokenVersion);
  });

  it('в карточке сотрудника виден его рабочий телефон', async () => {
    const updated = await updateUser(actors.adminA, actors.agentA.userId, {
      phone: '+995 599 10 10 10',
    });
    expect(updated.phone).toBe('+995 599 10 10 10');

    const card = (await listUsers(actors.adminA)).find((user) => user.id === actors.agentA.userId);
    expect(card?.phone).toBe('+995 599 10 10 10');

    // Нормализованный вид — то, по чему объявление опознаётся как своё.
    // Без него исключение номера из дедупликации молча перестало бы работать.
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: actors.agentA.userId },
      select: { phoneNormalized: true },
    });
    expect(stored.phoneNormalized).toBe('+995599101010');
  });

  it('агент не меняет свой рабочий телефон сам', async () => {
    // Номер уходит в публичное объявление: сменив его, агент увёл бы к себе
    // звонки по объявлениям агентства, и заметили бы это не сразу.
    await expect(
      updateUser(actors.agentA, actors.agentA.userId, { phone: '+995 599 99 99 99' }),
    ).rejects.toThrow(ForbiddenError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Настройка воронки: стадии заводит руководитель, агент их только читает
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Объект в базе — руками, минуя сценарии.
 *
 * Сид объектов не создаёт и создавать не должен: объект появляется только
 * по «Согласен» (правило 0). А проверяется здесь удаление стадии, а не импорт,
 * и гонять ради одной строки весь импорт значило бы завязать тест воронки
 * на исправность импорта.
 */
async function propertyInStatus(ctx: AuthContext, pipelineStatusId: string): Promise<string> {
  const row = await prisma.property.create({
    data: {
      companyId: ctx.companyId,
      teamId: ctx.teamId as string,
      pipelineStatusId,
      origin: 'manual',
      transactionType: 'SALE',
      propertyType: 'APARTMENT',
      addressRaw: 'Тестовый адрес для стадии',
    },
    select: { id: true },
  });

  return row.id;
}

describe('стадии воронки', () => {
  it('агент не заводит, не переименовывает и не удаляет стадии', async () => {
    await expect(createPipelineStatus(actors.agentA, { name: 'Своя стадия' })).rejects.toThrow(
      ForbiddenError,
    );

    const statuses = await listPipelineStatuses(actors.agentA);
    const some = statuses[0];
    if (some === undefined) throw new Error('в сиде нет ни одной стадии');

    await expect(
      updatePipelineStatus(actors.agentA, some.id, { name: 'Переименовал' }),
    ).rejects.toThrow(ForbiddenError);
    await expect(deletePipelineStatus(actors.agentA, some.id)).rejects.toThrow(ForbiddenError);
    await expect(
      reorderPipelineStatuses(
        actors.agentA,
        statuses.map((status) => status.id),
      ),
    ).rejects.toThrow(ForbiddenError);

    // Читать — читает: без списка стадий доска не рисуется.
    expect(statuses.length).toBeGreaterThan(0);
  });

  it('менеджер заводит стадию, и её видят все в компании', async () => {
    const created = await createPipelineStatus(actors.managerA, { name: 'Показ назначен' });

    expect(created.nameIsCustom).toBe(true);
    expect(created.isSystem).toBe(false);

    // Стадия — настройка компании: её видит и агент соседней команды.
    for (const ctx of [actors.adminA, actors.agentA, actors.agentAOtherTeam]) {
      const visible = await listPipelineStatuses(ctx);
      expect(visible.map((status) => status.id)).toContain(created.id);
    }

    await deletePipelineStatus(actors.adminA, created.id);
  });

  it('стадия другой компании неотличима от несуществующей', async () => {
    const foreign = await prisma.pipelineStatus.findFirstOrThrow({
      where: { companyId: actors.adminB.companyId },
    });

    // companyId берётся из контекста (правило 5), поэтому существующий
    // идентификатор из компании B отсюда выглядит как ничей.
    await expect(
      updatePipelineStatus(actors.adminA, foreign.id, { name: 'Захвачено' }),
    ).rejects.toThrow(NotFoundError);
    await expect(deletePipelineStatus(actors.adminA, foreign.id)).rejects.toThrow(NotFoundError);

    const untouched = await prisma.pipelineStatus.findUniqueOrThrow({ where: { id: foreign.id } });
    expect(untouched.name).not.toBe('Захвачено');
  });

  it('переименование поднимает флаг своего имени, но код не трогает', async () => {
    const statuses = await listPipelineStatuses(actors.adminA);
    const inBase = statuses.find((status) => status.code === 'IN_BASE');
    if (inBase === undefined) throw new Error('в сиде нет стадии IN_BASE');

    const renamed = await updatePipelineStatus(actors.adminA, inBase.id, {
      name: 'В работе у нас',
    });

    // Код — ключ, на котором держатся переходы импорта и публикации.
    // Переименование обязано его не задевать, иначе «Согласен» перестанет
    // находить, куда ставить объект.
    expect(renamed.code).toBe('IN_BASE');
    expect(renamed.name).toBe('В работе у нас');
    expect(renamed.nameIsCustom).toBe(true);

    // Возвращается и имя, и флаг: через сценарий флаг обратно не опускается —
    // переименование в то же самое имя остаётся переименованием. Иначе
    // следующий тест увидел бы английское «In base» вместо перевода.
    await prisma.pipelineStatus.update({
      where: { id: inBase.id },
      data: { name: inBase.name, nameIsCustom: false },
    });
  });

  it('системную стадию удалить нельзя', async () => {
    const statuses = await listPipelineStatuses(actors.adminA);

    const system = statuses.filter((status) => status.isSystem);
    expect(system.length).toBeGreaterThan(0);

    for (const status of system) {
      // На них встают объекты при импорте и публикации. Удаление сломало бы
      // главный цикл, причём позже и в другом месте.
      await expect(deletePipelineStatus(actors.adminA, status.id)).rejects.toThrow(ValidationError);
    }
  });

  it('непустую стадию не удалить, не сказав, куда девать объекты', async () => {
    const target = await createPipelineStatus(actors.managerA, { name: 'Временная' });
    const propertyId = await propertyInStatus(actors.managerA, target.id);

    await expect(deletePipelineStatus(actors.adminA, target.id)).rejects.toThrow(ValidationError);

    // Стадия на месте, объект тоже: отказ ничего не испортил.
    const stillThere = await prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
    expect(stillThere.pipelineStatusId).toBe(target.id);

    const statuses = await listPipelineStatuses(actors.adminA);
    const home = statuses.find((status) => status.code === 'IN_BASE');
    if (home === undefined) throw new Error('в сиде нет стадии IN_BASE');

    const result = await deletePipelineStatus(actors.adminA, target.id, {
      moveToStatusId: home.id,
    });
    expect(result.movedProperties).toBe(1);

    // Объект переехал, а не исчез вместе со стадией.
    const moved = await prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
    expect(moved.pipelineStatusId).toBe(home.id);

    await prisma.property.delete({ where: { id: propertyId } });
  });

  it('объекты не переносятся в чужую стадию', async () => {
    const target = await createPipelineStatus(actors.managerA, { name: 'Ещё одна временная' });
    const propertyId = await propertyInStatus(actors.managerA, target.id);

    const foreign = await prisma.pipelineStatus.findFirstOrThrow({
      where: { companyId: actors.adminB.companyId },
    });

    // Чужая стадия как цель переноса — это чужая компания через параметр,
    // а не через контекст. Ровно то, что правило 5 и запрещает.
    await expect(
      deletePipelineStatus(actors.adminA, target.id, { moveToStatusId: foreign.id }),
    ).rejects.toThrow(NotFoundError);

    // Ни объект, ни стадия не пострадали от отказа.
    const untouched = await prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
    expect(untouched.pipelineStatusId).toBe(target.id);

    await prisma.property.delete({ where: { id: propertyId } });
    await deletePipelineStatus(actors.adminA, target.id);
  });

  it('порядок принимается только целиком и только своей воронкой', async () => {
    const statuses = await listPipelineStatuses(actors.adminA);
    const ids = statuses.map((status) => status.id);
    const first = ids[0];
    const second = ids[1];
    if (first === undefined || second === undefined) throw new Error('нужно две стадии');

    // Неполный список: стадия, не попавшая в него, осталась бы без порядка.
    await expect(reorderPipelineStatuses(actors.adminA, [first])).rejects.toThrow(ValidationError);

    // Повторы.
    await expect(
      reorderPipelineStatuses(actors.adminA, [...ids.slice(1), first, first]),
    ).rejects.toThrow(ValidationError);

    // Чужая стадия вместо своей.
    const foreign = await prisma.pipelineStatus.findFirstOrThrow({
      where: { companyId: actors.adminB.companyId },
    });
    await expect(
      reorderPipelineStatuses(actors.adminA, [...ids.slice(1), foreign.id]),
    ).rejects.toThrow(ValidationError);

    // А целиком и своей — принимается.
    const swapped = [second, first, ...ids.slice(2)];
    const result = await reorderPipelineStatuses(actors.adminA, swapped);
    expect(result.map((status) => status.id)).toEqual(swapped);

    await reorderPipelineStatuses(actors.adminA, ids);
  });

  it('пустое имя и неизвестный цвет отклоняются', async () => {
    await expect(createPipelineStatus(actors.adminA, { name: '   ' })).rejects.toThrow(
      ValidationError,
    );

    // Значение уходит в разметку доски: произвольная строка здесь означала бы
    // произвольный CSS на странице.
    await expect(
      createPipelineStatus(actors.adminA, { name: 'Цветная', colorToken: 'red; content: hack' }),
    ).rejects.toThrow(ValidationError);
  });
});
