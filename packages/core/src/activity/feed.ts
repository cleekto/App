import { ObservationStateValue, Prisma, prisma } from '@cleekto/db';

import type { AuthContext } from '../auth/context';
import { NotFoundError } from '../errors';
import { assertScope, requirePermission, scopeFilter } from '../rbac/guard';
import { ENTITY } from './actions';

/**
 * Лента активности объекта и список фоллоу-апов.
 *
 * Оба читают уже записанное: журнал пишется с первого дня (инвариант 7),
 * а состояние обзвона — расширением при исходе разговора. Здесь только
 * выборка, никакой новой записи.
 */

export interface ActivityEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorUserId: string | null;
  actorName: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
}

/**
 * История объекта.
 *
 * Показывается всё, что случилось с объектом, а не только смены статуса:
 * DESIGN §19 — это линия времени, по которой новый агент понимает,
 * что с объектом уже делали.
 */
export async function propertyActivity(
  ctx: AuthContext,
  propertyId: string,
  limit = 100,
): Promise<ActivityEntry[]> {
  // Право читается на объект, а не на журнал: агент, который видит объект,
  // видит и его историю. Иначе карточка получилась бы наполовину слепой.
  const scope = requirePermission(ctx, 'property', 'read');

  const property = await prisma.property.findFirst({
    where: { id: propertyId, companyId: ctx.companyId },
    select: { id: true, companyId: true, teamId: true },
  });
  if (property === null) throw new NotFoundError();
  assertScope(ctx, scope, { companyId: property.companyId, teamId: property.teamId });

  // Связанные записи: задачи и комментарии этого объекта попадают в ленту
  // наравне со сменами статуса — иначе история распадается на три ленты,
  // и ни одна не отвечает на вопрос «что тут происходило».
  const [taskIds, commentIds] = await Promise.all([
    prisma.task.findMany({ where: { propertyId }, select: { id: true } }),
    prisma.comment.findMany({ where: { propertyId }, select: { id: true } }),
  ]);

  const rows = await prisma.activityLog.findMany({
    where: {
      companyId: ctx.companyId,
      OR: [
        { entityType: ENTITY.PROPERTY, entityId: propertyId },
        { entityType: ENTITY.TASK, entityId: { in: taskIds.map((task) => task.id) } },
        { entityType: ENTITY.COMMENT, entityId: { in: commentIds.map((c) => c.id) } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 200),
  });

  const names = await namesOf(rows.map((row) => row.userId));

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    actorUserId: row.userId,
    actorName: row.userId === null ? null : (names.get(row.userId) ?? null),
    before: row.before,
    after: row.after,
    createdAt: row.createdAt.toISOString(),
  }));
}

export interface FollowUp {
  observationId: string;
  callbackAt: string;
  note: string | null;
  source: string;
  url: string;
  district: string | null;
  rooms: number | null;
  price: number | null;
  currency: string | null;
  /** Просрочен ли перезвон. Считается на сервере, чтобы час был один. */
  overdue: boolean;
}

/**
 * Список фоллоу-апов: объявления с наступившей датой перезвона.
 *
 * ЖИВЁТ НА ОБЪЯВЛЕНИИ, А НЕ НА ОБЪЕКТЕ. Объекта здесь ещё нет: агент
 * договорился перезвонить, а не получил согласие (инвариант 10). Именно
 * поэтому список берётся из `ObservationState`, а не из воронки.
 *
 * Область — команда: состояние обзвона границу компании не покидает.
 */
export async function listFollowUps(ctx: AuthContext, limit = 50): Promise<FollowUp[]> {
  const scope = requirePermission(ctx, 'property', 'read');

  const where: Prisma.ObservationStateWhereInput = {
    ...(scopeFilter(ctx, scope) as Prisma.ObservationStateWhereInput),
    state: ObservationStateValue.callback,
    callbackAt: { lte: new Date() },
  };

  const rows = await prisma.observationState.findMany({
    where,
    orderBy: { callbackAt: 'asc' },
    take: Math.min(limit, 200),
    include: {
      observation: {
        select: {
          source: true,
          canonicalUrl: true,
          district: true,
          rooms: true,
          price: true,
          currency: true,
        },
      },
    },
  });

  const now = Date.now();
  return rows
    .filter((row) => row.callbackAt !== null)
    .map((row) => ({
      observationId: row.observationId,
      callbackAt: (row.callbackAt as Date).toISOString(),
      note: row.note,
      source: row.observation.source,
      url: row.observation.canonicalUrl,
      district: row.observation.district,
      rooms: row.observation.rooms,
      price: row.observation.price === null ? null : Number(row.observation.price),
      currency: row.observation.currency,
      overdue: (row.callbackAt as Date).getTime() < now,
    }));
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
