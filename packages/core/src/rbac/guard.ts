import type { AuthContext } from '../auth/context';
import { ForbiddenError, NotFoundError } from '../errors';
import { permissionScope, type Action, type Resource, type Scope } from './permissions';

/**
 * Проверка права. Первая строка каждого сценария — до чтения данных.
 *
 * Возвращает область, а не `true`: вызывающий обязан знать, насколько широко
 * фильтровать выборку. Функция, возвращающая булево, молча приглашает
 * забыть про область.
 */
export function requirePermission(ctx: AuthContext, resource: Resource, action: Action): Scope {
  const scope = permissionScope(ctx.role, resource, action);

  if (scope === null) {
    throw new ForbiddenError(`Роль ${ctx.role} не может выполнить ${action} над ${resource}`);
  }

  return scope;
}

/**
 * Проверка принадлежности ресурса компании из контекста.
 *
 * Бросает NotFoundError, а НЕ ForbiddenError: снаружи «чужой компании»
 * и «не существует» обязаны быть неразличимы (риск R-04, api-contracts.md §1).
 */
export function assertSameCompany(ctx: AuthContext, resource: { companyId: string } | null): void {
  if (resource === null || resource.companyId !== ctx.companyId) {
    throw new NotFoundError();
  }
}

/**
 * Проверка области после того, как ресурс найден и принадлежит компании.
 *
 * `own` требует явного владельца: если сценарий не может его назвать,
 * значит область применена не к тому ресурсу, и это ошибка проектирования,
 * а не повод разрешить.
 */
export function assertScope(
  ctx: AuthContext,
  scope: Scope,
  resource: { companyId: string; teamId?: string | null; ownerUserId?: string | null },
): void {
  switch (scope) {
    case 'company':
    case 'global':
      return;

    case 'team': {
      if (ctx.teamId === null || resource.teamId !== ctx.teamId) {
        throw new ForbiddenError('Ресурс вне вашей команды');
      }
      return;
    }

    case 'own': {
      if (resource.ownerUserId !== ctx.userId) {
        throw new ForbiddenError('Изменять можно только свои записи');
      }
      return;
    }

    case 'self': {
      if (resource.ownerUserId !== ctx.userId) {
        throw new ForbiddenError('Изменять можно только собственную учётную запись');
      }
      return;
    }
  }
}

/**
 * Условие выборки по области. Возвращает фрагмент `where` для Prisma.
 *
 * Существует, чтобы область читалась и применялась одинаково во всех списках.
 * Два разных фильтра для одних данных рано или поздно разойдутся.
 */
export function scopeFilter(
  ctx: AuthContext,
  scope: Scope,
  fields: { teamField?: string; ownerField?: string } = {},
): Record<string, unknown> {
  const base: Record<string, unknown> = { companyId: ctx.companyId };

  switch (scope) {
    case 'company':
    case 'global':
      return base;

    case 'team': {
      const field = fields.teamField ?? 'teamId';
      // Пользователь без команды не видит ничего в командной области —
      // это честнее, чем показать всё.
      base[field] = ctx.teamId;
      return base;
    }

    case 'own':
    case 'self': {
      const field = fields.ownerField ?? 'userId';
      base[field] = ctx.userId;
      return base;
    }
  }
}
