import { prisma } from '@kleekto/db';

import { ACTIVITY, ENTITY } from '../activity/actions';
import { writeActivity } from '../activity/write';
import type { AuthContext } from '../auth/context';
import { ConflictError, ValidationError } from '../errors';
import { requirePermission } from '../rbac/guard';

export interface TeamSummary {
  id: string;
  name: string;
  memberCount: number;
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

  return { id: team.id, name: team.name, memberCount: 0 };
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
    include: { _count: { select: { members: true } } },
    orderBy: { name: 'asc' },
  });

  return teams.map((team) => ({
    id: team.id,
    name: team.name,
    memberCount: team._count.members,
  }));
}
