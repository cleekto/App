import { Prisma, TaskStatus, prisma } from '@kleekto/db';

import { ACTIVITY, ENTITY } from '../activity/actions';
import { writeActivity } from '../activity/write';
import type { AuthContext } from '../auth/context';
import { NotFoundError, ValidationError } from '../errors';
import { assertScope, requirePermission, scopeFilter } from '../rbac/guard';

/**
 * Задачи агента.
 *
 * DESIGN §20 прямо предупреждает: не превращать задачи MVP в систему
 * управления проектами. Поэтому здесь нет ни подзадач, ни приоритетов,
 * ни меток — только то, без чего задача не работает: что сделать, по какому
 * объекту, кто и до когда.
 */

export interface TaskItem {
  id: string;
  propertyId: string;
  title: string;
  description: string | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  dueAt: string | null;
  status: TaskStatus;
  /** Срок прошёл, а задача открыта. Считается на сервере: часовой пояс один. */
  overdue: boolean;
  createdAt: string;
}

export interface CreateTaskInput {
  propertyId: string;
  title: string;
  description?: string | null | undefined;
  assignedUserId?: string | null | undefined;
  dueAt?: string | null | undefined;
}

export async function createTask(ctx: AuthContext, input: CreateTaskInput): Promise<TaskItem> {
  const scope = requirePermission(ctx, 'task', 'create');

  const title = input.title.trim();
  if (title === '') {
    throw new ValidationError('Задача без заголовка не создаётся', { fields: ['title'] });
  }

  // Задача всегда привязана к объекту: задача «просто так» в CRM агентства
  // смысла не имеет и превращает список в свалку.
  const property = await prisma.property.findFirst({
    where: { id: input.propertyId, companyId: ctx.companyId },
    select: { id: true, companyId: true, teamId: true, assignedUserId: true },
  });
  if (property === null) throw new NotFoundError();
  assertScope(ctx, scope, {
    companyId: property.companyId,
    teamId: property.teamId,
    // Область агента — свои объекты: задача заводится там, где он работает.
    ownerUserId: property.assignedUserId,
  });

  /*
   * НЕ НАЗВАЛ ИСПОЛНИТЕЛЯ — ЗНАЧИТ, СЕБЕ.
   *
   * Раньше такая задача оставалась ничьей: `assignedUserId` был `null`,
   * и в «мои задачи» она не попадала, потому что список фильтрует
   * по назначенному. Человек записывал себе «позвонить в четверг»
   * и не находил этого нигде — ни в списке, ни в напоминании.
   *
   * Назначить другого по-прежнему можно только с правом `assign`: умолчание
   * ничего не разрешает, оно лишь называет очевидное.
   */
  const assignedUserId =
    input.assignedUserId === undefined || input.assignedUserId === null
      ? ctx.userId
      : await validAssignee(ctx, input.assignedUserId);

  const created = await prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        // Область — из контекста и из объекта, не из тела запроса (правило 5).
        companyId: ctx.companyId,
        teamId: property.teamId,
        propertyId: property.id,
        title,
        description: input.description ?? null,
        assignedUserId,
        dueAt: input.dueAt === undefined || input.dueAt === null ? null : new Date(input.dueAt),
        createdByUserId: ctx.userId,
      },
    });

    await writeActivity(tx, ctx, {
      entityType: ENTITY.TASK,
      entityId: task.id,
      action: ACTIVITY.TASK_CREATED,
      after: { title, propertyId: property.id, assignedUserId },
    });

    return task;
  });

  const names = await namesOf([created.assignedUserId]);
  return toItem(created, names);
}

export interface TaskListFilters {
  propertyId?: string | undefined;
  /** Только задачи текущего пользователя — главный список агента. */
  mine?: boolean | undefined;
  status?: TaskStatus | undefined;
  /** Только просроченные и сегодняшние. */
  dueBefore?: string | undefined;
  limit?: number | undefined;
}

export async function listTasks(
  ctx: AuthContext,
  filters: TaskListFilters = {},
): Promise<TaskItem[]> {
  const scope = requirePermission(ctx, 'task', 'read');

  /*
   * «СВОЁ» У ЗАДАЧИ — ЭТО ДВЕ КОЛОНКИ, а не одна: и назначенная мне,
   * и заведённая мной. Одной не хватает: руководитель ставит задачу агенту
   * (тогда своя она по `assignedUserId`), а агент заводит её себе сам —
   * и тогда, если он же и назначен, обе совпадают, но задача без
   * назначенного осталась бы ничьей и пропала бы из списка автора.
   *
   * Поэтому область складывается через `AND` с готовым `OR`, а не слиянием:
   * при слиянии фильтр `mine` затёр бы условие области.
   */
  const own: Prisma.TaskWhereInput[] =
    scope === 'own'
      ? [
          { companyId: ctx.companyId },
          { OR: [{ assignedUserId: ctx.userId }, { createdByUserId: ctx.userId }] },
        ]
      : [scopeFilter(ctx, scope) as Prisma.TaskWhereInput];

  const where: Prisma.TaskWhereInput = {
    AND: own,
    ...(filters.propertyId === undefined ? {} : { propertyId: filters.propertyId }),
    ...(filters.status === undefined ? {} : { status: filters.status }),
    ...(filters.mine === true ? { assignedUserId: ctx.userId } : {}),
    ...(filters.dueBefore === undefined ? {} : { dueAt: { lte: new Date(filters.dueBefore) } }),
  };

  const rows = await prisma.task.findMany({
    where,
    // Открытые вперёд, внутри — по сроку. Задача без срока уходит в конец:
    // она не горит, и показывать её выше просроченной было бы обманом.
    orderBy: [{ status: 'asc' }, { dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    take: Math.min(filters.limit ?? 100, 200),
  });

  const names = await namesOf(rows.map((row) => row.assignedUserId));
  return rows.map((row) => toItem(row, names));
}

/**
 * Смена состояния задачи.
 *
 * Отмена отличается от выполнения: по отменённой работу не сделали,
 * и для отчётности это разные вещи.
 */
export async function setTaskStatus(
  ctx: AuthContext,
  taskId: string,
  status: TaskStatus,
): Promise<TaskItem> {
  const scope = requirePermission(ctx, 'task', 'update');

  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId: ctx.companyId },
  });
  if (task === null) throw new NotFoundError();

  assertScope(ctx, scope, {
    companyId: task.companyId,
    teamId: task.teamId,
    ownerUserId: task.assignedUserId ?? task.createdByUserId,
  });

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.task.update({
      where: { id: task.id },
      data: {
        status,
        completedAt: status === TaskStatus.done ? new Date() : null,
      },
    });

    if (status !== TaskStatus.open) {
      await writeActivity(tx, ctx, {
        entityType: ENTITY.TASK,
        entityId: task.id,
        action: status === TaskStatus.done ? ACTIVITY.TASK_COMPLETED : ACTIVITY.TASK_CANCELLED,
        before: { status: task.status },
        after: { status },
      });
    }

    return row;
  });

  const names = await namesOf([updated.assignedUserId]);
  return toItem(updated, names);
}

// ── Вспомогательное ──────────────────────────────────────────────────────────

/**
 * Кому можно поставить задачу.
 *
 * СЕБЕ — ВСЕГДА, ДРУГОМУ — ТОЛЬКО ПО ПРАВУ `assign` (решение владельца
 * 2026-09-06: командные задачи ставит руководитель). Без этой проверки
 * «личные задачи» оставались бы личными лишь на словах: завести задачу
 * на коллегу — то же самое, что войти в его список и добавить туда строку.
 */
async function validAssignee(
  ctx: AuthContext,
  assignedUserId: string | null | undefined,
): Promise<string | null> {
  if (assignedUserId === undefined || assignedUserId === null) return null;

  if (assignedUserId !== ctx.userId) {
    requirePermission(ctx, 'task', 'assign');
  }

  const user = await prisma.user.findFirst({
    where: { id: assignedUserId, companyId: ctx.companyId },
    select: { id: true },
  });
  // Пользователь чужой компании неотличим от несуществующего (риск R-04).
  if (user === null) throw new NotFoundError();

  return user.id;
}

function toItem(
  row: {
    id: string;
    propertyId: string;
    title: string;
    description: string | null;
    assignedUserId: string | null;
    dueAt: Date | null;
    status: TaskStatus;
    createdAt: Date;
  },
  names: Map<string, string>,
): TaskItem {
  return {
    id: row.id,
    propertyId: row.propertyId,
    title: row.title,
    description: row.description,
    assignedUserId: row.assignedUserId,
    assignedUserName: row.assignedUserId === null ? null : (names.get(row.assignedUserId) ?? null),
    dueAt: row.dueAt?.toISOString() ?? null,
    status: row.status,
    overdue:
      row.status === TaskStatus.open && row.dueAt !== null && row.dueAt.getTime() < Date.now(),
    createdAt: row.createdAt.toISOString(),
  };
}

async function namesOf(ids: Array<string | null>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => id !== null))];
  if (unique.length === 0) return new Map();

  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, fullName: true },
  });
  return new Map(users.map((user) => [user.id, user.fullName]));
}
