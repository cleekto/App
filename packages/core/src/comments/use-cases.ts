import { Prisma, prisma } from '@cleekto/db';

import { ACTIVITY, ENTITY } from '../activity/actions';
import { writeActivity } from '../activity/write';
import type { AuthContext } from '../auth/context';
import { NotFoundError, ValidationError } from '../errors';
import { assertScope, requirePermission, scopeFilter } from '../rbac/guard';

/**
 * Комментарии к объекту.
 *
 * DESIGN §21: обсуждение, а не документ. Автор, дата, текст — и ничего
 * больше; метаданные держатся неброско.
 */

export interface CommentItem {
  id: string;
  propertyId: string;
  body: string;
  authorUserId: string | null;
  /** `null` означает, что автор больше не работает в компании. */
  authorName: string | null;
  createdAt: string;
}

const MAX_BODY = 5000;

export async function addComment(
  ctx: AuthContext,
  propertyId: string,
  body: string,
): Promise<CommentItem> {
  // По `rbac.md` §3 создавать комментарии может только `AGENT`. Похоже
  // на упущение документа, но исправлять его молча нельзя: права — не то
  // место, где стоит догадываться. Вынесено вопросом `Q56`.
  const scope = requirePermission(ctx, 'comment', 'create');

  const text = body.trim();
  if (text === '') {
    throw new ValidationError('Пустой комментарий не сохраняется', { fields: ['body'] });
  }
  if (text.length > MAX_BODY) {
    throw new ValidationError('Комментарий слишком длинный', { fields: ['body'] });
  }

  const property = await prisma.property.findFirst({
    where: { id: propertyId, companyId: ctx.companyId },
    select: { id: true, companyId: true, teamId: true },
  });
  if (property === null) throw new NotFoundError();
  assertScope(ctx, scope, { companyId: property.companyId, teamId: property.teamId });

  const created = await prisma.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: {
        companyId: ctx.companyId,
        teamId: property.teamId,
        propertyId: property.id,
        body: text,
        authorUserId: ctx.userId,
      },
    });

    await writeActivity(tx, ctx, {
      entityType: ENTITY.COMMENT,
      entityId: comment.id,
      action: ACTIVITY.COMMENT_ADDED,
      // Текст комментария в журнал не пишется: он может содержать что угодно,
      // включая пересказ разговора с собственником (правило 10).
      after: { propertyId: property.id },
    });

    return comment;
  });

  const names = await namesOf([created.authorUserId]);
  return toItem(created, names);
}

export async function listComments(ctx: AuthContext, propertyId: string): Promise<CommentItem[]> {
  const scope = requirePermission(ctx, 'comment', 'read');

  const where: Prisma.CommentWhereInput = {
    ...(scopeFilter(ctx, scope) as Prisma.CommentWhereInput),
    propertyId,
  };

  const rows = await prisma.comment.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: 200,
  });

  const names = await namesOf(rows.map((row) => row.authorUserId));
  return rows.map((row) => toItem(row, names));
}

function toItem(
  row: {
    id: string;
    propertyId: string;
    body: string;
    authorUserId: string | null;
    createdAt: Date;
  },
  names: Map<string, string>,
): CommentItem {
  return {
    id: row.id,
    propertyId: row.propertyId,
    body: row.body,
    authorUserId: row.authorUserId,
    authorName: row.authorUserId === null ? null : (names.get(row.authorUserId) ?? null),
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
