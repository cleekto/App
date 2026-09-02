import { RoleCode, prisma } from '@kleekto/db';

import { ACTIVITY, ENTITY } from '../activity/actions';
import { writeActivity } from '../activity/write';
import type { AuthContext } from '../auth/context';
import { hashPassword } from '../auth/password';
import { normalizeEmail, revokeAllSessions } from '../auth/use-cases';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { requirePermission, scopeFilter } from '../rbac/guard';

export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  role: RoleCode;
  isActive: boolean;
  teamId: string | null;
  teamName: string | null;
}

export interface CreateUserInput {
  email: string;
  password: string;
  fullName: string;
  role: RoleCode;
  teamId?: string | null | undefined;
  locale?: string | undefined;
}

/**
 * Создание пользователя.
 *
 * Менеджер создаёт ТОЛЬКО агентов и только в своей команде (Q2). Иначе роль
 * менеджера превращается в администратора за два клика: достаточно завести
 * себе второго менеджера или админа.
 *
 * Матрица прав отвечает на вопрос «можно ли создавать», а вот «кого именно» —
 * решение сценария: в таблице прав такое условие выразить нечем.
 */
export async function createUser(ctx: AuthContext, input: CreateUserInput): Promise<UserSummary> {
  const scope = requirePermission(ctx, 'user', 'create');
  const email = normalizeEmail(input.email);

  if (ctx.role === RoleCode.MANAGER) {
    if (input.role !== RoleCode.AGENT) {
      throw new ForbiddenError('Менеджер может создавать только агентов');
    }
    if (ctx.teamId === null) {
      throw new ForbiddenError('Менеджер без команды не может создавать пользователей');
    }
  }

  // Команда обязательна для всех, кроме администратора: область дедупликации
  // и видимости — команда, и агент без неё не увидит ничего.
  const teamId = scope === 'team' ? ctx.teamId : (input.teamId ?? null);

  if (teamId === null && input.role !== RoleCode.ADMIN) {
    throw new ValidationError('Для этой роли нужно указать команду', { fields: ['teamId'] });
  }

  if (teamId !== null) {
    // Команда обязана принадлежать компании из контекста, а не любой
    // существующей: иначе через teamId можно было бы дотянуться до чужой.
    const team = await prisma.team.findFirst({
      where: { id: teamId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (team === null) {
      throw new NotFoundError('Команда не найдена');
    }
  }

  const role = await prisma.role.findUnique({ where: { code: input.role } });
  if (role === null) {
    throw new ValidationError('Неизвестная роль', { fields: ['role'] });
  }

  const passwordHash = await hashPassword(input.password);

  const existing = await prisma.user.findFirst({
    where: { companyId: ctx.companyId, email },
    select: { id: true },
  });
  if (existing !== null) {
    throw new ConflictError('Пользователь с таким адресом уже есть в компании');
  }

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        // Из контекста, не из входных данных (правило 5).
        companyId: ctx.companyId,
        roleId: role.id,
        email,
        passwordHash,
        fullName: input.fullName.trim(),
        locale: input.locale ?? ctx.locale,
        ...(teamId === null
          ? {}
          : { teamMemberships: { create: { companyId: ctx.companyId, teamId } } }),
      },
      include: { role: true, teamMemberships: { include: { team: true } } },
    });

    await writeActivity(tx, ctx, {
      entityType: ENTITY.USER,
      entityId: user.id,
      action: ACTIVITY.USER_CREATED,
      // Пароля и хеша здесь нет и быть не может (правило 10).
      after: { email, role: input.role, teamId },
    });

    return user;
  });

  const membership = created.teamMemberships[0];

  return {
    id: created.id,
    email: created.email,
    fullName: created.fullName,
    role: created.role.code,
    isActive: created.isActive,
    teamId: membership?.teamId ?? null,
    teamName: membership?.team.name ?? null,
  };
}

/** Список пользователей в области, доступной роли (Q1, Q5). */
export async function listUsers(ctx: AuthContext): Promise<UserSummary[]> {
  const scope = requirePermission(ctx, 'user', 'read');

  // У пользователя нет собственного teamId — членство лежит в TeamMember,
  // поэтому командная область выражается через связь, а не через колонку.
  const where =
    scope === 'team'
      ? { companyId: ctx.companyId, teamMemberships: { some: { teamId: ctx.teamId ?? '' } } }
      : scopeFilter(ctx, scope);

  const users = await prisma.user.findMany({
    where,
    include: { role: true, teamMemberships: { include: { team: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return users.map((user) => {
    const membership = user.teamMemberships[0];
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role.code,
      isActive: user.isActive,
      teamId: membership?.teamId ?? null,
      teamName: membership?.team.name ?? null,
    };
  });
}

/**
 * Отключение пользователя.
 *
 * Не удаление: за пользователем числятся записи журнала, и физическое
 * удаление разрушило бы историю. Активные сессии отзываются немедленно —
 * иначе отключённый работал бы ещё столько, сколько живёт его access-токен.
 */
export async function deactivateUser(ctx: AuthContext, userId: string): Promise<void> {
  requirePermission(ctx, 'user', 'delete');

  const user = await prisma.user.findFirst({
    where: { id: userId, companyId: ctx.companyId },
    select: { id: true, isActive: true },
  });

  if (user === null) {
    throw new NotFoundError();
  }

  if (user.id === ctx.userId) {
    throw new ValidationError('Нельзя отключить самого себя');
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { isActive: false, tokenVersion: { increment: 1 } },
    });

    await writeActivity(tx, ctx, {
      entityType: ENTITY.USER,
      entityId: userId,
      action: ACTIVITY.USER_DEACTIVATED,
      before: { isActive: true },
      after: { isActive: false },
    });
  });

  await revokeAllSessions(userId);
}
