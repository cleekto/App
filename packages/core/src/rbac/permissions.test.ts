import { RoleCode } from '@kleekto/db';
import { describe, expect, it } from 'vitest';

import { ForbiddenError } from '../errors';
import type { AuthContext } from '../auth/context';
import { assertScope, requirePermission, scopeFilter } from './guard';
import { RESOURCES, permissionScope, type Action } from './permissions';

const ACTIONS: Action[] = ['create', 'read', 'update', 'delete', 'assign', 'manage'];

function ctx(role: RoleCode, over: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: 'user-1',
    companyId: 'company-1',
    teamId: 'team-1',
    role,
    locale: 'en',
    ...over,
  };
}

describe('матрица прав', () => {
  // Сверка с docs/architecture/rbac.md. Если документ и матрица разойдутся,
  // расхождение должно быть видно здесь, а не обнаружиться в проде.
  it('администратор работает в области компании везде, где вообще может', () => {
    for (const resource of RESOURCES) {
      for (const action of ACTIONS) {
        const scope = permissionScope(RoleCode.ADMIN, resource, action);
        if (scope !== null) {
          expect(scope, `${resource}.${action}`).toBe('company');
        }
      }
    }
  });

  it('агент нигде не получает область компании на изменение', () => {
    for (const resource of RESOURCES) {
      for (const action of ['create', 'update', 'delete', 'manage'] as Action[]) {
        const scope = permissionScope(RoleCode.AGENT, resource, action);
        expect(['company', 'global'], `${resource}.${action}`).not.toContain(scope);
      }
    }
  });

  it('отсутствие записи означает запрет, а не разрешение по умолчанию', () => {
    // Роль не может назначать ответственных за пользователей — такого
    // действия в матрице нет вовсе.
    expect(permissionScope(RoleCode.ADMIN, 'user', 'assign')).toBeNull();
    expect(permissionScope(RoleCode.AGENT, 'company', 'update')).toBeNull();
  });

  it('справочник ролей никто не редактирует (Q28)', () => {
    for (const role of Object.values(RoleCode)) {
      expect(permissionScope(role, 'role', 'create')).toBeNull();
      expect(permissionScope(role, 'role', 'update')).toBeNull();
      expect(permissionScope(role, 'role', 'delete')).toBeNull();
    }
  });

  it('профили публикации читают все роли, ведут только ADMIN и MANAGER (I15)', () => {
    for (const role of Object.values(RoleCode)) {
      expect(permissionScope(role, 'publishProfile', 'read')).toBe('company');
    }
    expect(permissionScope(RoleCode.AGENT, 'publishProfile', 'create')).toBeNull();
    expect(permissionScope(RoleCode.MANAGER, 'publishProfile', 'create')).toBe('company');
    expect(permissionScope(RoleCode.ADMIN, 'publishProfile', 'create')).toBe('company');
  });

  it('статусы воронки меняет только администратор (инвариант 4)', () => {
    expect(permissionScope(RoleCode.MANAGER, 'pipelineStatus', 'update')).toBeNull();
    expect(permissionScope(RoleCode.AGENT, 'pipelineStatus', 'update')).toBeNull();
    expect(permissionScope(RoleCode.ADMIN, 'pipelineStatus', 'update')).toBe('company');
  });
});

describe('requirePermission', () => {
  it('возвращает область, а не булево', () => {
    expect(requirePermission(ctx(RoleCode.AGENT), 'user', 'read')).toBe('team');
    expect(requirePermission(ctx(RoleCode.ADMIN), 'user', 'read')).toBe('company');
  });

  it('запрещённое действие бросает ForbiddenError', () => {
    expect(() => requirePermission(ctx(RoleCode.AGENT), 'team', 'create')).toThrow(ForbiddenError);
    expect(() => requirePermission(ctx(RoleCode.MANAGER), 'pipelineStatus', 'delete')).toThrow(
      ForbiddenError,
    );
  });
});

describe('области выборки', () => {
  it('всегда фильтруют по компании, какой бы ни была область', () => {
    for (const scope of ['company', 'team', 'own'] as const) {
      expect(scopeFilter(ctx(RoleCode.AGENT), scope)).toMatchObject({ companyId: 'company-1' });
    }
  });

  it('командная область у пользователя без команды не раскрывает всё', () => {
    // Пользователь без команды должен не видеть ничего, а не видеть всё:
    // отсутствие фильтра здесь было бы утечкой внутри компании.
    //
    // НЕ `null`: колонка `teamId` у `Property` и не только обязательная,
    // и Prisma отклоняет буквальный `null` как ошибку валидации — агент без
    // команды получал бы 500 вместо пустого списка. `IN ()` даёт то же
    // «ничего не найдено», не упираясь в тип конкретной колонки. Поймано
    // первым ручным входом агента без команды — этот тест раньше проверял
    // форму фильтра, а не то, что Prisma с ней делает.
    const filter = scopeFilter(ctx(RoleCode.AGENT, { teamId: null }), 'team');
    expect(filter['teamId']).toEqual({ in: [] });
  });

  it('own фильтрует по пользователю', () => {
    expect(scopeFilter(ctx(RoleCode.AGENT), 'own')).toMatchObject({ userId: 'user-1' });
  });
});

describe('assertScope', () => {
  it('командная область пропускает свою команду и отклоняет чужую', () => {
    expect(() =>
      assertScope(ctx(RoleCode.AGENT), 'team', { companyId: 'company-1', teamId: 'team-1' }),
    ).not.toThrow();

    expect(() =>
      assertScope(ctx(RoleCode.AGENT), 'team', { companyId: 'company-1', teamId: 'team-2' }),
    ).toThrow(ForbiddenError);
  });

  it('own пропускает только свои записи', () => {
    expect(() =>
      assertScope(ctx(RoleCode.AGENT), 'own', { companyId: 'company-1', ownerUserId: 'user-1' }),
    ).not.toThrow();

    expect(() =>
      assertScope(ctx(RoleCode.AGENT), 'own', { companyId: 'company-1', ownerUserId: 'user-2' }),
    ).toThrow(ForbiddenError);
  });
});
