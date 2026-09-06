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
  | 'activityLog'
  | 'chatRoom'
  | 'chatMessage';

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
     * ОБЛАСТЬ АГЕНТА — СВОИ ОБЪЕКТЫ (решение владельца 2026-09-06). Раньше
     * была команда, и это открывало дыру: карточку чужого объекта агент
     * не видел, а черновик публикации по ней получал вместе с адресом
     * и ценой. Право на объект и право разместить его обязаны совпадать —
     * иначе узкая дверь ничего не значит, пока рядом стоит широкая.
     *
     * Распознавание своих объявлений при обратном импорте от этого не
     * страдает: оно смотрит в базу напрямую по компании, а не через права.
     */
    create: { ADMIN: 'company', MANAGER: 'team', AGENT: 'own' },
    read: { ADMIN: 'company', MANAGER: 'team', AGENT: 'own' },
  },

  /**
   * Объект.
   *
   * КТО ЧТО ВИДИТ — РЕШЕНИЕ ВЛАДЕЛЬЦА 2026-09-06: администратор — всю
   * компанию, менеджер — свою команду, агент — ТОЛЬКО СВОИ объекты.
   *
   * Прежде агент читал по команде, и в `rbac.md` §3 это объяснялось так:
   * чужой объект он видит, чтобы не звонить дважды. Довод снят, потому что
   * от повторного звонка защищает не показ, а проверка дублей: она идёт
   * на сервере в области КОМАНДЫ и на «Согласен» останавливает второго
   * агента независимо от того, видел он чужой объект или нет.
   *
   * Создаёт агент по-прежнему в области команды: объект принадлежит
   * команде, а не лично ему, и назначенным может оказаться коллега.
   */
  property: {
    create: { ADMIN: 'company', MANAGER: 'team', AGENT: 'team' },
    read: { ADMIN: 'company', MANAGER: 'team', AGENT: 'own' },
    update: { ADMIN: 'company', MANAGER: 'team', AGENT: 'own' },
    delete: { ADMIN: 'company', MANAGER: 'team' },
    assign: { ADMIN: 'company', MANAGER: 'team' },
  },

  /**
   * Задача.
   *
   * У АГЕНТА ЗАДАЧИ ЛИЧНЫЕ (решение владельца 2026-09-06). Он заводит их
   * себе и на своих объектах; чужую задачу не видит и не создаёт.
   *
   * КОМАНДНУЮ ЗАДАЧУ СТАВИТ ТОЛЬКО РУКОВОДИТЕЛЬ. «Поставить задачу другому»
   * — это `assign`, и его у агента нет: иначе личные задачи оставались бы
   * личными только на словах, ведь завести задачу на коллегу — то же самое,
   * что войти в его список.
   */
  task: {
    create: { ADMIN: 'company', MANAGER: 'team', AGENT: 'own' },
    read: { ADMIN: 'company', MANAGER: 'team', AGENT: 'own' },
    update: { ADMIN: 'company', MANAGER: 'team', AGENT: 'own' },
    delete: { ADMIN: 'company', MANAGER: 'team', AGENT: 'own' },
    // Администратор здесь был пропущен — недосмотр: он может всё, что может
    // менеджер, и назначение не исключение.
    assign: { ADMIN: 'company', MANAGER: 'team' },
  },

  /**
   * Комментарий.
   *
   * Область агента сужена до своих объектов вместе с самим объектом
   * (решение владельца 2026-09-06): обсуждение карточки, которую он
   * не видит, — та же дыра, что была у публикаций.
   *
   * ВНИМАНИЕ: по `rbac.md` §3 создавать комментарии может только `AGENT`.
   * Матрица повторяет документ буквально, потому что документ — источник
   * истины по правам. Похоже на упущение (менеджер, читающий обсуждение,
   * но не способный ответить, — странная CRM), поэтому вынесено вопросом
   * `Q56`, а не исправлено молча.
   */
  comment: {
    create: { AGENT: 'own' },
    read: { ADMIN: 'company', MANAGER: 'team', AGENT: 'own' },
    update: { AGENT: 'own' },
    delete: { ADMIN: 'company', MANAGER: 'team', AGENT: 'own' },
  },

  /**
   * Комната общего чата.
   *
   * Создают администратор и менеджер — решение владельца. Область создания
   * КОМПАНИЯ, а не команда: комната по определению общефирменная, и менеджер,
   * заводящий её «для своей команды», получил бы комнату, которую видят все,
   * — то есть не то, что просил.
   *
   * Удаления нет вовсе: вместе с комнатой исчезла бы переписка. Вместо него
   * архивирование, а это `update`.
   */
  chatRoom: {
    create: { ADMIN: 'company', MANAGER: 'company' },
    read: { ADMIN: 'company', MANAGER: 'company', AGENT: 'company' },
    update: { ADMIN: 'company', MANAGER: 'company' },
  },

  /**
   * Сообщение — в комнате или в личной переписке.
   *
   * ОБЛАСТЬ СОЗДАНИЯ — `own`, И ЭТО НЕ ХИТРОСТЬ, А ТОЧНОЕ ОПИСАНИЕ. Агент
   * не пишет «в области компании»; он пишет СВОЁ сообщение, у которого есть
   * автор — он сам. Область компании у него на `read`, потому что читает
   * он всё, что написали другие, — и инвариант «агент нигде не получает
   * область компании на изменение» этим не нарушен.
   *
   * Удаление: автор убирает своё, администратор — любое (решение владельца).
   * Менеджеру чужие сообщения не отдаются: модерация переписки коллег —
   * не его роль, а спорные случаи решает администратор.
   */
  chatMessage: {
    create: { ADMIN: 'own', MANAGER: 'own', AGENT: 'own' },
    read: { ADMIN: 'company', MANAGER: 'company', AGENT: 'company' },
    update: { ADMIN: 'own', MANAGER: 'own', AGENT: 'own' },
    delete: { ADMIN: 'company', MANAGER: 'own', AGENT: 'own' },
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
