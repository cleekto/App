import type { RoleCode } from '@kleekto/db';

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
  | 'company'
  | 'team'
  | 'user'
  | 'role'
  | 'pipelineStatus'
  | 'publication'
  | 'property'
  | 'task'
  | 'comment'
  | 'activityLog';

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
    // Воронку настраивают руководители — админ и менеджер (решение владельца
    // 2026-09-03. Область — КОМПАНИЯ, а не команда: статус привязан к компании
    // (инвариант 4), и доска у всех команд агентства одна. Менеджер, меняющий
    // воронку, меняет её и соседней команде — это следствие модели данных,
    // а не недосмотр прав.
    create: { ADMIN: 'company', MANAGER: 'company' },
    read: { ADMIN: 'company', MANAGER: 'company', AGENT: 'company' },
    update: { ADMIN: 'company', MANAGER: 'company' },
    delete: { ADMIN: 'company', MANAGER: 'company' },
    // Агент воронку только читает: он двигает по ней объекты, а состав
    // стадий — настройка агентства.
    manage: { ADMIN: 'company' },
  },

  publication: {
    /**
     * Публикация — работа агента (правило 12: кнопку «Опубликовать» жмёт
     * человек). Объявление выходит под его именем и его номером, отдельного
     * «профиля публикации» больше нет — решение владельца 2026-09-03.
     *
     * Область — КОМАНДА, а не компания: агент нигде не пишет шире своей
     * команды, и публикация не исключение. Прежнее право было шире, и это
     * был недосмотр — объявление соседней команды агент размещать не должен.
     *
     * Распознавание своих объявлений при обратном импорте от этого не
     * страдает: оно смотрит в базу напрямую по компании, а не через права.
     */
    create: { ADMIN: 'company', MANAGER: 'team', AGENT: 'team' },
    read: { ADMIN: 'company', MANAGER: 'team', AGENT: 'team' },
  },

  /**
   * Объект. Агент создаёт (через «Согласен» и вручную) и читает по команде,
   * но меняет только свои: чужой объект он видит, чтобы не звонить дважды,
   * а не чтобы переписывать (rbac.md §3).
   */
  property: {
    create: { ADMIN: 'company', MANAGER: 'team', AGENT: 'team' },
    read: { ADMIN: 'company', MANAGER: 'team', AGENT: 'team' },
    update: { ADMIN: 'company', MANAGER: 'team', AGENT: 'own' },
    delete: { ADMIN: 'company', MANAGER: 'team' },
    assign: { ADMIN: 'company', MANAGER: 'team' },
  },

  task: {
    create: { ADMIN: 'company', MANAGER: 'team', AGENT: 'team' },
    read: { ADMIN: 'company', MANAGER: 'team', AGENT: 'team' },
    update: { ADMIN: 'company', MANAGER: 'team', AGENT: 'own' },
    delete: { ADMIN: 'company', MANAGER: 'team', AGENT: 'own' },
    assign: { MANAGER: 'team' },
  },

  /**
   * Комментарий.
   *
   * ВНИМАНИЕ: по `rbac.md` §3 создавать комментарии может только `AGENT`.
   * Матрица повторяет документ буквально, потому что документ — источник
   * истины по правам. Похоже на упущение (менеджер, читающий обсуждение,
   * но не способный ответить, — странная CRM), поэтому вынесено вопросом
   * `Q56`, а не исправлено молча.
   */
  comment: {
    create: { AGENT: 'team' },
    read: { ADMIN: 'company', MANAGER: 'team', AGENT: 'team' },
    update: { AGENT: 'own' },
    delete: { ADMIN: 'company', MANAGER: 'team', AGENT: 'own' },
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
