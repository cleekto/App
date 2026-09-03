import { RoleCode, prisma } from '@kleekto/db';

import { ACTIVITY, ENTITY } from '../activity/actions';
import { writeActivity } from '../activity/write';
import type { AuthContext } from '../auth/context';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { requirePermission } from '../rbac/guard';

export interface TeamMemberSummary {
  id: string;
  fullName: string;
  email: string;
  role: RoleCode;
  phone: string | null;
  isActive: boolean;
  /**
   * Команда у участника, разумеется, та же самая. Поле есть, потому что
   * карточка сотрудника одна и та же и в составе команды, и в списке тех,
   * кто вне команд, — и форма правки показывает в ней текущую команду.
   */
  teamId: string;
  teamName: string;
}

export interface TeamSummary {
  id: string;
  name: string;
  memberCount: number;
  /**
   * Менеджер команды — тот, кто за неё отвечает.
   *
   * Показывается на карточке команды: без имени руководителя список команд
   * читается как список слов, и понять, к кому идти с вопросом по команде,
   * по нему нельзя. Менеджеров в команде может не быть вовсе — тогда `null`,
   * и это видно.
   */
  managerName: string | null;
  /** Состав команды. Раскрывается на карточке, а не лежит отдельным списком. */
  members: TeamMemberSummary[];
}

export async function createTeam(ctx: AuthContext, name: string): Promise<TeamSummary> {
  requirePermission(ctx, 'team', 'create');

  const trimmed = name.trim();
  if (trimmed === '') {
    throw new ValidationError('Название команды не указано', { fields: ['name'] });
  }

  const existing = await prisma.team.findFirst({
    where: { companyId: ctx.companyId, name: trimmed },
    select: { id: true },
  });
  if (existing !== null) {
    throw new ConflictError('Команда с таким названием уже есть');
  }

  const team = await prisma.$transaction(async (tx) => {
    const created = await tx.team.create({
      // companyId из контекста (правило 5).
      data: { companyId: ctx.companyId, name: trimmed },
    });

    await writeActivity(tx, ctx, {
      entityType: ENTITY.TEAM,
      entityId: created.id,
      action: ACTIVITY.TEAM_CREATED,
      after: { name: trimmed },
    });

    return created;
  });

  return { id: team.id, name: team.name, memberCount: 0, managerName: null, members: [] };
}

/**
 * Список команд.
 *
 * Агент видит только свою: команда — его область видимости (Q1). Менеджер
 * и администратор видят все команды компании, потому что им нужно понимать
 * структуру агентства.
 */
export async function listTeams(ctx: AuthContext): Promise<TeamSummary[]> {
  const scope = requirePermission(ctx, 'team', 'read');

  const teams = await prisma.team.findMany({
    where: {
      companyId: ctx.companyId,
      ...(scope === 'team' ? { id: ctx.teamId ?? '' } : {}),
    },
    include: {
      // Состав приходит вместе со списком, а не отдельным запросом на каждую
      // карточку: команд у агентства единицы, а запрос на раскрытие карточки
      // означал бы ожидание там, где человек просто разглядывает структуру.
      members: {
        include: { user: { include: { role: true } } },
        orderBy: { user: { createdAt: 'asc' } },
      },
    },
    orderBy: { name: 'asc' },
  });

  return teams.map((team) => {
    const members = team.members.map((membership) => ({
      id: membership.user.id,
      fullName: membership.user.fullName,
      email: membership.user.email,
      role: membership.user.role.code,
      phone: membership.user.phone,
      isActive: membership.user.isActive,
      teamId: team.id,
      teamName: team.name,
    }));

    return {
      id: team.id,
      name: team.name,
      memberCount: members.length,
      // Менеджеров формально может быть несколько; на карточке показывается
      // первый по старшинству записи — тот, кого завели раньше.
      managerName: members.find((member) => member.role === RoleCode.MANAGER)?.fullName ?? null,
      members,
    };
  });
}

/** Переименование команды. */
export async function updateTeam(
  ctx: AuthContext,
  teamId: string,
  input: { name: string },
): Promise<TeamSummary> {
  const scope = requirePermission(ctx, 'team', 'update');

  const team = await prisma.team.findFirst({
    // companyId из контекста (правило 5): чужую команду этим не достать.
    where: { id: teamId, companyId: ctx.companyId },
  });
  if (team === null) throw new NotFoundError('Команда не найдена');

  // Менеджер правит только свою команду: его область — она, а переименование
  // соседней было бы распоряжением чужой.
  if (scope === 'team' && team.id !== ctx.teamId) {
    throw new ForbiddenError('Менеджер может переименовать только свою команду');
  }

  const name = input.name.trim();
  if (name === '') {
    throw new ValidationError('Название команды не указано', { fields: ['name'] });
  }

  const clash = await prisma.team.findFirst({
    where: { companyId: ctx.companyId, name, id: { not: teamId } },
    select: { id: true },
  });
  if (clash !== null) throw new ConflictError('Команда с таким названием уже есть');

  await prisma.$transaction(async (tx) => {
    await tx.team.update({ where: { id: teamId }, data: { name } });

    await writeActivity(tx, ctx, {
      entityType: ENTITY.TEAM,
      entityId: teamId,
      action: ACTIVITY.TEAM_UPDATED,
      before: { name: team.name },
      after: { name },
    });
  });

  const updated = await listTeams(ctx);
  const summary = updated.find((item) => item.id === teamId);
  if (summary === undefined) throw new NotFoundError('Команда не найдена');
  return summary;
}

/**
 * Удаление команды.
 *
 * Команда — область видимости и дедупликации: объекты принадлежат ей, а не
 * человеку. Удалить команду с объектами значит оставить их без области —
 * они пропали бы из всех списков, оставшись в базе. Поэтому непустая команда
 * не удаляется, и сказано, что именно мешает.
 */
export async function deleteTeam(ctx: AuthContext, teamId: string): Promise<void> {
  requirePermission(ctx, 'team', 'delete');

  const team = await prisma.team.findFirst({
    where: { id: teamId, companyId: ctx.companyId },
    select: { id: true, name: true },
  });
  if (team === null) throw new NotFoundError('Команда не найдена');

  /*
   * У отказа есть МАШИННЫЙ ПРИЗНАК ПРИЧИНЫ, а не только текст.
   *
   * Сообщение здесь русское — ядро о языках не знает, — и показывать его
   * грузинскому агенту нельзя (правило 18). Без признака экран мог сказать
   * только «не удалось сохранить», и человек не понимал, что именно мешает:
   * объекты в команде или люди. Признак переводится на месте показа.
   */
  const properties = await prisma.property.count({ where: { teamId, companyId: ctx.companyId } });
  if (properties > 0) {
    throw new ValidationError(
      'В команде ' + String(properties) + ' объектов. Сначала переведите их в другую команду',
      { fields: ['teamId'], reason: 'team_has_properties', count: properties },
    );
  }

  const members = await prisma.teamMember.count({ where: { teamId, companyId: ctx.companyId } });
  if (members > 0) {
    throw new ValidationError(
      'В команде ' + String(members) + ' сотрудников. Сначала переведите их в другую команду',
      { fields: ['teamId'], reason: 'team_has_members', count: members },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.team.delete({ where: { id: teamId } });

    await writeActivity(tx, ctx, {
      entityType: ENTITY.TEAM,
      entityId: teamId,
      action: ACTIVITY.TEAM_DELETED,
      before: { name: team.name },
    });
  });
}
