import { Prisma, RoleCode, prisma } from '@kleekto/db';

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
  /**
   * Личный профиль публикации — имя и телефон, под которыми объявления
   * этого человека выходят на площадку.
   *
   * Показывается прямо в карточке сотрудника: это лицо агентства
   * в публичном объявлении, и увидеть его должно быть можно, не открывая
   * отдельный раздел. `null` — личного профиля нет, применяется профиль
   * компании по умолчанию.
   */
  publishProfile: { displayName: string; phone: string } | null;
}

/**
 * Один и тот же набор связей нужен и списку, и созданию, и изменению.
 * Держится в одном месте: разъехавшиеся копии этого include — причина того,
 * что новое поле появляется на одном экране и отсутствует на другом.
 */
const SUMMARY_INCLUDE = {
  role: true,
  teamMemberships: { include: { team: true } },
  // Личных профилей у человека может быть несколько; в карточке нужен
  // тот, что применяется по умолчанию, а если такого нет — любой.
  publishProfiles: {
    select: { displayName: true, phoneOriginal: true, isDefault: true },
    orderBy: { isDefault: 'desc' },
    take: 1,
  },
} as const;

type UserWithSummaryRelations = Prisma.UserGetPayload<{ include: typeof SUMMARY_INCLUDE }>;

function toSummary(user: UserWithSummaryRelations): UserSummary {
  const membership = user.teamMemberships[0];
  const profile = user.publishProfiles[0];

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role.code,
    isActive: user.isActive,
    teamId: membership?.teamId ?? null,
    teamName: membership?.team.name ?? null,
    publishProfile:
      profile === undefined
        ? null
        : { displayName: profile.displayName, phone: profile.phoneOriginal },
  };
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
      include: SUMMARY_INCLUDE,
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

  return toSummary(created);
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
    include: SUMMARY_INCLUDE,
    orderBy: { createdAt: 'asc' },
  });

  return users.map(toSummary);
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

// ── Изменение сотрудника ─────────────────────────────────────────────────────

export interface UpdateUserInput {
  fullName?: string | undefined;
  role?: RoleCode | undefined;
  teamId?: string | null | undefined;
  locale?: string | undefined;
  /** Отключённого можно вернуть: промах мышью не должен быть окончательным. */
  isActive?: boolean | undefined;
}

/**
 * Меняет карточку сотрудника.
 *
 * ЧТО КОМУ ПОЗВОЛЕНО. Область берётся из матрицы (`user.update`): администратор
 * правит всю компанию, менеджер — свою команду, агент — только себя. Агенту
 * при этом доступны лишь имя и язык: роль и команда — решение руководителя,
 * а не собственный выбор, иначе право «править себя» означало бы право
 * назначить себя администратором.
 *
 * СВОЮ РОЛЬ НЕ МЕНЯЕТ НИКТО, включая администратора. Единственный админ
 * компании, понизивший себя до агента, запирает компанию без возможности
 * восстановления — пригласить нового администратора будет некому.
 */
export async function updateUser(
  ctx: AuthContext,
  userId: string,
  input: UpdateUserInput,
): Promise<UserSummary> {
  const scope = requirePermission(ctx, 'user', 'update');

  if (scope === 'self' && userId !== ctx.userId) {
    throw new ForbiddenError('Можно менять только свою учётную запись');
  }

  const target = await prisma.user.findFirst({
    // companyId из контекста (правило 5): чужого сотрудника этим не достать.
    where: { id: userId, companyId: ctx.companyId },
    include: { role: true, teamMemberships: true },
  });
  if (target === null) {
    throw new NotFoundError('Сотрудник не найден');
  }

  if (scope === 'team') {
    const inTeam = target.teamMemberships.some((m) => m.teamId === ctx.teamId);
    if (!inTeam) {
      throw new ForbiddenError('Сотрудник не в вашей команде');
    }
  }

  const wantsRole = input.role !== undefined && input.role !== target.role.code;
  const wantsTeam = input.teamId !== undefined;
  const wantsActive = input.isActive !== undefined && input.isActive !== target.isActive;

  if (scope === 'self' && (wantsRole || wantsTeam || wantsActive)) {
    throw new ForbiddenError('Роль, команду и доступ меняет руководитель');
  }

  if (wantsRole && userId === ctx.userId) {
    throw new ValidationError('Нельзя изменить собственную роль', { fields: ['role'] });
  }

  if (wantsActive && userId === ctx.userId) {
    throw new ValidationError('Нельзя отключить самого себя', { fields: ['isActive'] });
  }

  if (ctx.role === RoleCode.MANAGER && wantsRole && input.role !== RoleCode.AGENT) {
    throw new ForbiddenError('Менеджер может назначать только роль агента');
  }

  // Менеджер распоряжается своей командой, а перевод человека в другую или
  // «в никуда» задевает чужую область — так же, как при создании, где выбор
  // команды у менеджера просто игнорируется в пользу собственной.
  if (scope === 'team' && wantsTeam && input.teamId !== ctx.teamId) {
    throw new ForbiddenError('Менеджер может держать сотрудника только в своей команде');
  }

  // Последний администратор компании — единственный, кто может пригласить
  // следующего. Отключив его, компанию не восстановить.
  //
  // Проверка срабатывает только тогда, когда администратора ТЕРЯЮТ: отключают
  // действующего или снимают с него роль. Включение обратно и правка имени
  // компанию без администратора не оставляют, и запрещать их нечего —
  // ровно на этом первая версия проверки и попалась: она не давала вернуть
  // отключённого администратора.
  const losesActiveAdmin =
    target.role.code === RoleCode.ADMIN &&
    target.isActive &&
    ((wantsActive && input.isActive === false) || wantsRole);

  if (losesActiveAdmin) {
    const admins = await prisma.user.count({
      where: { companyId: ctx.companyId, isActive: true, role: { code: RoleCode.ADMIN } },
    });
    if (admins <= 1) {
      throw new ValidationError('В компании должен остаться хотя бы один администратор');
    }
  }

  const roleRow =
    input.role === undefined ? null : await prisma.role.findUnique({ where: { code: input.role } });
  if (input.role !== undefined && roleRow === null) {
    throw new ValidationError('Неизвестная роль', { fields: ['role'] });
  }

  if (input.teamId !== undefined && input.teamId !== null) {
    const team = await prisma.team.findFirst({
      where: { id: input.teamId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (team === null) {
      throw new NotFoundError('Команда не найдена');
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        ...(input.fullName === undefined ? {} : { fullName: input.fullName }),
        ...(input.locale === undefined ? {} : { locale: input.locale }),
        ...(roleRow === null ? {} : { roleId: roleRow.id }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        // Смена роли, команды или доступа обесценивает выданные токены:
        // права лежат в подписанном токене и живут до пятнадцати минут.
        ...(wantsRole || wantsTeam || wantsActive ? { tokenVersion: { increment: 1 } } : {}),
      },
    });

    if (wantsTeam) {
      await tx.teamMember.deleteMany({ where: { userId } });
      if (input.teamId !== null && input.teamId !== undefined) {
        await tx.teamMember.create({
          data: { userId, teamId: input.teamId, companyId: ctx.companyId },
        });
      }
    }

    await writeActivity(tx, ctx, {
      entityType: ENTITY.USER,
      entityId: userId,
      action: ACTIVITY.USER_UPDATED,
      // Ни имени, ни адреса: в журнале только факт и что именно менялось
      // (правило 10).
      before: { role: target.role.code, isActive: target.isActive },
      after: {
        role: input.role ?? target.role.code,
        isActive: input.isActive ?? target.isActive,
        teamChanged: wantsTeam,
      },
    });
  });

  // Отключённый обязан вылететь немедленно, каким бы путём его ни отключили.
  // Поднятого `tokenVersion` мало: он гасит access-токен, а refresh-токен
  // остался бы годным, и человек выписал бы себе новый доступ. `DELETE`
  // (то есть `deactivateUser`) делает ровно это же — два пути отключения
  // обязаны заканчиваться одинаково.
  if (wantsActive && input.isActive === false) {
    await revokeAllSessions(userId);
  }

  // Читается напрямую по id, а не через listUsers: список ограничен областью
  // вызывающего, и человек, только что выведенный из его команды, в этот
  // список уже не попадает — изменение бы прошло, а ответ был бы «не найден».
  const updated = await prisma.user.findFirstOrThrow({
    where: { id: userId, companyId: ctx.companyId },
    include: SUMMARY_INCLUDE,
  });

  return toSummary(updated);
}
