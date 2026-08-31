import type { RoleCode } from '@cleekto/db';

/**
 * Матрица прав. Источник: docs/architecture/rbac.md.
 *
 * Таблица, а не набор `if` по коду: так права можно прочитать целиком,
 * сравнить с документом и покрыть тестом. Разбросанные проверки читаются
 * только исполнением.
 */

/** Область права. Право без области — это дыра. */
export type Scope =
  | 'company'
  | 'team'
  | 'own'
  /** Собственная учётная запись. */
  | 'self'
  /** Общий индекс объявлений — единственное место без границы компании. */
  | 'global';

export type Action = 'create' | 'read' | 'update' | 'delete' | 'assign' | 'manage';

export type Resource =
  'company' | 'team' | 'user' | 'role' | 'pipelineStatus' | 'publishProfile' | 'activityLog';

type RoleScopes = Partial<Record<RoleCode, Scope>>;

/**
 * Отсутствие роли в записи означает запрет. Пустое место в таблице — это
 * «нельзя», а не «забыли»: добавлять права надо осознанно.
 */
const MATRIX: Record<Resource, Partial<Record<Action, RoleScopes>>> = {
  company: {
    read: { ADMIN: 'company', MANAGER: 'company', AGENT: 'company' },
    update: { ADMIN: 'company' },
  },

  team: {
    create: { ADMIN: 'company' },
    read: { ADMIN: 'company', MANAGER: 'company', AGENT: 'team' },
    update: { ADMIN: 'company', MANAGER: 'team' },
    delete: { ADMIN: 'company' },
  },

  user: {
    // Менеджер создаёт ТОЛЬКО агентов и только в своей команде.
    // Проверка роли создаваемого пользователя — отдельная, в сценарии:
    // матрица описывает «можно ли создавать», а не «кого именно».
    create: { ADMIN: 'company', MANAGER: 'team' },
    read: { ADMIN: 'company', MANAGER: 'team', AGENT: 'team' },
    update: { ADMIN: 'company', MANAGER: 'team', AGENT: 'self' },
    // Пользователь не удаляется, а отключается — см. схему.
    delete: { ADMIN: 'company' },
    manage: { ADMIN: 'company' },
  },

  role: {
    read: { ADMIN: 'company', MANAGER: 'company', AGENT: 'company' },
  },

  pipelineStatus: {
    create: { ADMIN: 'company' },
    read: { ADMIN: 'company', MANAGER: 'company', AGENT: 'company' },
    update: { ADMIN: 'company' },
    delete: { ADMIN: 'company' },
    manage: { ADMIN: 'company' },
  },

  publishProfile: {
    // Профиль — лицо агентства в публичном объявлении. Агент его читает,
    // чтобы видеть, от чьего имени размещается объявление, но не заводит:
    // иначе он подставит личный номер вместо рабочего (I15).
    create: { ADMIN: 'company', MANAGER: 'company' },
    read: { ADMIN: 'company', MANAGER: 'company', AGENT: 'company' },
    update: { ADMIN: 'company', MANAGER: 'company' },
    delete: { ADMIN: 'company', MANAGER: 'company' },
    manage: { ADMIN: 'company' },
  },

  activityLog: {
    read: { ADMIN: 'company', MANAGER: 'team', AGENT: 'own' },
  },
};

/**
 * Область, в которой роль может выполнить действие, либо `null`, если нельзя.
 *
 * Возвращает именно область, а не булево: без неё вызывающий код не знает,
 * насколько широко фильтровать выборку, и рано или поздно отфильтрует шире,
 * чем следует.
 */
export function permissionScope(role: RoleCode, resource: Resource, action: Action): Scope | null {
  return MATRIX[resource][action]?.[role] ?? null;
}

/** Полная матрица — для тестов и для сверки с `rbac.md`. */
export function permissionMatrix(): typeof MATRIX {
  return MATRIX;
}

export const RESOURCES: readonly Resource[] = Object.keys(MATRIX) as Resource[];
