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

export type Action =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'assign'
  | 'manage'
  /**
   * Применить, не видя списка.
   *
   * Появилось для профилей публикации: агент публикует объявление от имени
   * профиля, но самих профилей в настройках не видит (решение владельца
   * 2026-09-03). Раньше и то и другое покрывалось `read`, и снятие чтения
   * молча сломало бы главный сценарий — публикацию.
   */
  | 'apply';

export type Resource =
  | 'company'
  | 'team'
  | 'user'
  | 'role'
  | 'pipelineStatus'
  | 'publishProfile'
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
    create: { ADMIN: 'company' },
    read: { ADMIN: 'company', MANAGER: 'company', AGENT: 'company' },
    update: { ADMIN: 'company' },
    delete: { ADMIN: 'company' },
    manage: { ADMIN: 'company' },
  },

  publishProfile: {
    // Профиль — лицо агентства в публичном объявлении, и заводить его агент
    // не может: иначе он подставит личный номер вместо рабочего (I15).
    //
    // ЧИТАТЬ СПИСОК ЕМУ ТОЖЕ НЕ НУЖНО — решение владельца 2026-09-03.
    // Раньше чтение было открыто, чтобы агент видел, от чьего имени выходит
    // объявление. Но видит он это не из списка: имя и телефон приходят
    // в черновике публикации, который собирает сервер (§6А.4), и в отчёте
    // о заполнении. Список же — настройка компании, и агенту в нём делать
    // нечего.
    create: { ADMIN: 'company', MANAGER: 'company' },
    read: { ADMIN: 'company', MANAGER: 'company' },
    update: { ADMIN: 'company', MANAGER: 'company' },
    delete: { ADMIN: 'company', MANAGER: 'company' },
    manage: { ADMIN: 'company' },
    // Публикует агент — значит, применять профиль он обязан уметь.
    // Имя и телефон он при этом видит в черновике и в отчёте о заполнении,
    // а не в списке настроек.
    apply: { ADMIN: 'company', MANAGER: 'company', AGENT: 'company' },
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
