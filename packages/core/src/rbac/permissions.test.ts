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
    /*
     * ИСКЛЮЧЕНИЕ ОДНО, И ОНО НЕ ДЫРА, А ОГРАНИЧЕНИЕ.
     *
     * У сообщения чата создание и правка идут в области `own` у всех ролей,
     * администратора включая. Это не «администратора урезали»: `own` здесь
     * не про территорию, а про авторство. Писать и править можно только
     * СВОИ слова — приписать реплику коллеге не должен и администратор,
     * иначе переписка перестаёт быть свидетельством.
     *
     * `own` строго уже `company`, поэтому послабления в правах это
     * не создаёт: расширить доступ таким исключением нельзя, только сузить.
     * Удаление чужого сообщения у администратора при этом есть — там
     * область именно `company`.
     */
    const authorshipOnly = new Set(['chatMessage.create', 'chatMessage.update']);

    for (const resource of RESOURCES) {
      for (const action of ACTIONS) {
        const scope = permissionScope(RoleCode.ADMIN, resource, action);
        if (scope === null) continue;

        if (authorshipOnly.has(`${resource}.${action}`)) {
          expect(scope, `${resource}.${action}`).toBe('own');
          continue;
        }

        expect(scope, `${resource}.${action}`).toBe('company');
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

  it('публикует любая роль — это главный сценарий продукта', () => {
    // Решение владельца 2026-09-03: отдельной сущности «профиль публикации»
    // больше нет, объявление выходит под именем и номером того, кто его
    // размещает. Размещают агенты, поэтому право на публикацию есть у всех
    // трёх ролей: без него встал бы главный цикл.
    for (const role of Object.values(RoleCode)) {
      expect(permissionScope(role, 'publication', 'create'), role).not.toBeNull();
      expect(permissionScope(role, 'publication', 'read'), role).not.toBeNull();
    }

    // Но не шире своей команды: объявление соседней команды агент
    // не размещает, и менеджер тоже.
    expect(permissionScope(RoleCode.AGENT, 'publication', 'create')).toBe('team');
    expect(permissionScope(RoleCode.MANAGER, 'publication', 'create')).toBe('team');
    expect(permissionScope(RoleCode.ADMIN, 'publication', 'create')).toBe('company');
  });

  it('воронку настраивают руководители, агент её только читает', () => {
    // Решение владельца 2026-09-03: стадии заводит, переименовывает и удаляет
    // и менеджер тоже. Агент двигает по воронке объекты, но состав стадий
    // не меняет — иначе доска у команды разъезжалась бы под руками.
    for (const action of ['create', 'update', 'delete'] as const) {
      expect(permissionScope(RoleCode.ADMIN, 'pipelineStatus', action), action).toBe('company');
      expect(permissionScope(RoleCode.MANAGER, 'pipelineStatus', action), action).toBe('company');
      expect(permissionScope(RoleCode.AGENT, 'pipelineStatus', action), action).toBeNull();
    }

    // Читают все: без списка стадий доска не рисуется.
    for (const role of [RoleCode.ADMIN, RoleCode.MANAGER, RoleCode.AGENT]) {
      expect(permissionScope(role, 'pipelineStatus', 'read'), role).toBe('company');
    }
  });
});

describe('requirePermission', () => {
  it('возвращает область, а не булево', () => {
    expect(requirePermission(ctx(RoleCode.AGENT), 'user', 'read')).toBe('team');
    expect(requirePermission(ctx(RoleCode.ADMIN), 'user', 'read')).toBe('company');
  });

  it('запрещённое действие бросает ForbiddenError', () => {
    expect(() => requirePermission(ctx(RoleCode.AGENT), 'team', 'create')).toThrow(ForbiddenError);
    expect(() => requirePermission(ctx(RoleCode.AGENT), 'pipelineStatus', 'delete')).toThrow(
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
