import type { Prisma, PrismaClient } from '@cleekto/db';

import type { AuthContext } from '../auth/context';
import type { ActivityAction, ActivityEntity } from './actions';

/** Клиент или транзакция: журнал обязан писаться в той же транзакции, что и действие. */
export type DbClient = PrismaClient | Prisma.TransactionClient;

export interface ActivityInput {
  entityType: ActivityEntity;
  entityId?: string | null;
  action: ActivityAction;
  /** Заполняется для смены статуса и переназначения (Q30). */
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}

/**
 * Запись в журнал действий.
 *
 * ПРАВИЛО 10: персональных данных в `before` и `after` быть не должно.
 * Смена телефона собственника пишется как факт изменения, а не со значением.
 * Гарантировать это типом нельзя — маскирование остаётся на вызывающем коде,
 * и на ревью это отдельный пункт.
 */
export async function writeActivity(
  db: DbClient,
  ctx: AuthContext,
  input: ActivityInput,
): Promise<void> {
  await db.activityLog.create({
    data: {
      // Из контекста, не из входных данных (правило 5).
      companyId: ctx.companyId,
      teamId: ctx.teamId,
      userId: ctx.userId,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      action: input.action,
      ...(input.before === undefined ? {} : { before: input.before }),
      ...(input.after === undefined ? {} : { after: input.after }),
    },
  });
}

/**
 * Запись о действии, у которого нет пользователя: регистрация компании,
 * сид, обслуживание. `userId` остаётся пустым — это честнее, чем приписать
 * действие первому попавшемуся администратору.
 */
export async function writeSystemActivity(
  db: DbClient,
  companyId: string,
  input: ActivityInput,
): Promise<void> {
  await db.activityLog.create({
    data: {
      companyId,
      teamId: null,
      userId: null,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      action: input.action,
      ...(input.before === undefined ? {} : { before: input.before }),
      ...(input.after === undefined ? {} : { after: input.after }),
    },
  });
}
