import type { DeepPartial, Dictionary } from '../types';

/**
 * Русский. Намеренно `DeepPartial`, а не полный `Dictionary`.
 *
 * Требовать полноты типом означало бы заставлять разработчика вписывать
 * заглушку при добавлении каждого ключа — и через месяц половина словаря
 * состояла бы из скопированного английского, неотличимого от перевода.
 *
 * Непереведённый ключ виден на экране как дыра (см. `translate`), попадает
 * в отчёт о покрытии и не подменяется другим языком молча (ADR-0008).
 */
export const ru: DeepPartial<Dictionary> = {
  app: {
    name: 'kleekTo',
    tagline: 'CRM для агентств недвижимости',
  },
  health: {
    ok: 'Все системы работают',
    databaseUnavailable: 'База данных недоступна',
  },
  common: {
    loading: 'Загрузка',
    retry: 'Повторить',
    cancel: 'Отмена',
    save: 'Сохранить',
    close: 'Закрыть',
    notSignedIn: 'Вход не выполнен',
    showPassword: 'Показать пароль',
    hidePassword: 'Скрыть пароль',
  },
  dashboard: {
    title: 'Аналитика',
    scopeCompany: 'Всё агентство',
    scopeTeam: 'Ваша команда',
    newToday: 'Новых за день',
    newThisWeek: 'Новых за неделю',
    totalProperties: 'Объектов в базе',
    byStatus: 'По статусам',
    people: 'Люди',
    consentsThisWeek: 'Согласий за неделю',
    propertiesOwned: 'Объектов закреплено',
    quality: 'Качество',
    duplicateRate: 'Упёрлись в дубль',
    duplicateHint:
      'Высокая доля — не поломка: значит, команды звонят одним и тем же собственникам.',
    parserFailureRate: 'Объявлений с непрочитанными полями',
    parserHint: 'Так вы узнаёте, что площадка сменила вёрстку, а не от разозлённого агента.',
    topMissing: 'Чаще всего не читается',
    publishing: 'Публикация',
    filledToday: 'Форм заполнено за день',
    filledThisWeek: 'Форм заполнено за неделю',
    publishedThisWeek: 'Размещено за неделю',
    publishedShare: 'Объектов размещено где-либо',
    averageUnfilled: 'Полей остаётся на форму',
    fillFailureRate: 'Форм с незаполненным',
    chronicallyUnfilled: 'Почти всегда пусто',
    chronicHint:
      'Либо данных не хватает в CRM, либо в словаре адаптера дыра. И то и другое — работа.',
    noData: 'Пока нечего показать',
  },

  nav: {
    properties: 'Объекты',
    board: 'Доска',
    tasks: 'Задачи',
    settings: 'Настройки',
    signOut: 'Выйти',
    menu: 'Меню',
    closeMenu: 'Закрыть меню',
  },
  auth: {
    signIn: 'Войти',
    email: 'Почта',
    password: 'Пароль',
    failed: 'Неверная почта или пароль',
  },
  property: {
    type: {
      APARTMENT: 'Квартира',
      HOUSE: 'Дом',
      LAND: 'Участок',
      COMMERCIAL: 'Коммерция',
    },
    transaction: {
      SALE: 'Продажа',
      RENT: 'Аренда',
    },
    origin: {
      consent: 'Собственник согласился',
      manual: 'Заведён вручную',
      legacy_import: 'Перенесён из файла агентства',
    },
    rooms: 'комн.',
    floor: 'этаж',
    unassigned: 'Без ответственного',
    sharedWithOtherTeam: 'С этим собственником работает и другая команда',
    owner: 'Собственник',
    noOwner: 'Контакта собственника нет',
    listings: 'Объявления',
    sourceDescription: 'Описание из объявления',
    publicDescription: 'Описание для публикации',
    publicDescriptionHint: 'Пишете вы. Текст объявления — чужой.',
    activity: 'История',
    comments: 'Комментарии',
    tasks: 'Задачи',
    addComment: 'Добавить комментарий',
    send: 'Отправить',
    status: 'Статус',
    assignee: 'Ответственный',
    publish: 'Разместить',
    publications: 'Размещено на',
    notPublished: 'Пока нигде не размещён',
    openSource: 'Открыть объявление',
    empty: 'Объектов пока нет',
    emptyHint: 'Объект появляется, когда собственник согласился по телефону.',
    search: 'Поиск по адресу, району или телефону',
    found: 'найдено',
    reset: 'Сбросить',
    allStatuses: 'Все статусы',
    allTypes: 'Все типы',
    publishCheckOpenExisting: 'Открыть существующее',
    publishCheckAnyway: 'Разместить всё равно',
    publishCheckCancel: 'Отмена',
  },
  board: {
    title: 'Доска',
    empty: 'В этом статусе пусто',

    manage: 'Настройка стадии',
    addStage: 'Добавить стадию',
    stageName: 'Название стадии',
    rename: 'Переименовать',
    color: 'Цвет',
    deleteStage: 'Удалить стадию',
    confirmDelete: 'Удалить — подтвердить',
    moveTo: 'Перенести объекты в',
    occupied: 'В стадии {count} объектов. Они переедут, а не пропадут.',
    systemStage: 'Сюда объекты встают при импорте и публикации, поэтому стадию нельзя удалить.',
    failed: 'Не удалось сохранить. Попробуйте ещё раз.',
    colors: {
      brand: 'Основной',
      success: 'Успех',
      warning: 'Внимание',
      danger: 'Тревога',
      neutral: 'Нейтральный',
    },
  },
  task: {
    title: 'Задачи',
    mine: 'Мои задачи',
    followUps: 'Пора перезвонить',
    empty: 'Сейчас делать нечего',
    noFollowUps: 'Перезвонов на сегодня нет',
    add: 'Новая задача',
    titleField: 'Что сделать',
    dueField: 'Срок',
    assigneeField: 'Исполнитель',
    due: 'Срок',
    overdue: 'Просрочено',
    done: 'Выполнено',
    cancel: 'Отменить',
    open: 'Открыта',
    create: 'Создать',
  },
  pipeline: {
    IN_BASE: 'В базе',
    IN_PROGRESS: 'Принят в работу',
    OFFERED: 'Предложен клиенту',
    CLOSED: 'Закрыт',
    ARCHIVED: 'Архив',
  },

  settings: {
    title: 'Параметры',
    account: 'Аккаунт',
    accountHint: 'Вход и пароль на этом аккаунте.',
    changePassword: 'Сменить пароль',
    currentPassword: 'Текущий пароль',
    newPassword: 'Новый пароль',
    newPasswordHint: 'Не короче 12 символов.',
    changePasswordFailed: 'Не удалось сменить пароль. Проверьте текущий пароль.',
    team: 'Команда',
    teams: 'Команды',
    teamsHint:
      'Агент работает в команде, и объект принадлежит команде. Без команды импортировать объявления некому.',
    users: 'Люди',
    usersHint: 'Кто работает в агентстве и что кому позволено.',
    role: 'Роль',
    noTeams: 'Команд пока нет',
    phone: 'Телефон в объявлении',
    language: 'Язык интерфейса',

    edit: 'Изменить',
    deactivate: 'Отключить',
    confirmDeactivate: 'Отключить — подтвердить',
    activate: 'Включить',
    inactive: 'отключён',
    publishesAs: 'Публикует как',

    phoneHint: 'Номер, который уходит в объявление. Без него человек не сможет публиковать.',
    noPhone: 'Рабочего телефона нет — публиковать пока не может',

    manager: 'Менеджер',
    noManager: 'В команде нет менеджера',
    rename: 'Переименовать',
    deleteTeam: 'Удалить команду',
    confirmDeleteTeam: 'Удалить — подтвердить',
    teamEmpty: 'В команде пока никого',
    unassigned: 'Вне команд',
    unassignedHint:
      'Люди, не входящие ни в одну команду. Они не могут ни импортировать объявления, ни владеть объектами — область и того и другого команда.',
    everyoneInTeams: 'Все состоят в командах',

    addTeam: 'Добавить команду',
    teamName: 'Название команды',
    members: 'человек',

    addUser: 'Добавить человека',
    fullName: 'Имя и фамилия',
    password: 'Пароль',
    passwordHint: 'Не короче 12 символов. Восстановления пароля пока нет — запишите его.',
    noTeam: 'Без команды',
    noTeamHint:
      'Администратор без команды не сможет импортировать объявления. Так и задумано: звонят и импортируют агенты.',

    roles: {
      admin: 'Администратор — вся компания',
      manager: 'Менеджер — своя команда',
      agent: 'Агент — свои объекты',
    },

    created: 'Сохранено',
    failed: 'Не удалось сохранить. Проверьте поля и попробуйте снова.',
  },

  extension: {
    signInPrompt: 'Войдите в kleekTo, чтобы импортировать объявления',
    signIn: 'Войти',
    email: 'Почта',
    password: 'Пароль',
    signedInAs: 'Вы вошли как',
    signOut: 'Выйти',

    notAListing: 'Откройте объявление на ss.ge или myhome.ge',
    detected: 'Объявление распознано',

    callResult: 'Результат разговора',

    outcome: {
      consent: 'Согласен — добавить в kleekTo',
      refused: 'Отказ / не звонить',
      noAnswer: 'Недозвон',
      callback: 'Перезвонить через…',
    },

    phoneNotRevealed:
      'Сначала откройте номер телефона на странице, затем нажмите «Согласен» ещё раз.',

    added: {
      title: 'Добавлено в kleekTo',
      status: 'В базе · закреплено за вами',
      open: 'Открыть в kleekTo',
    },

    refusedRecorded: {
      title: 'Отмечено: отказ',
      scope: 'Ваша команда больше не увидит это объявление в ленте. Другие команды — увидят.',
      doNotCall: 'Собственник просил больше не звонить',
      doNotCallScope: 'Действует на всё агентство',
    },

    noAnswerRecorded: {
      title: 'Отмечено: недозвон',
      scope: 'Вернётся в ленту примерно через сутки.',
    },

    callbackRecorded: {
      title: 'Перезвон запланирован',
    },
    callbackPrompt: 'Перезвонить через',
    callbackTomorrow: 'Завтра',
    callbackThreeDays: '3 дня',
    callbackWeek: 'Неделю',

    preview: {
      noDuplicate: 'Дублей нет',
      notFilled: 'Не заполнено',
      phone: 'Собственник',
    },

    duplicate: {
      blocked: 'Этот объект уже есть в базе вашей команды',
      warning: 'Похожий объект, возможно, уже есть',
      otherTeam: 'С этим собственником работает другая команда агентства',
      addAnyway: 'Всё равно добавить',
      linked: 'Привязано к существующему объекту',
    },

    fill: {
      publishingAs: 'От имени',
      filled: 'полей заполнено',
      leftForYou: 'Остаётся вам',
      clearForm: 'Очистить форму',
      cleared: 'Форма очищена',
      editedWarning: 'Эти поля вы правили после заполнения. Они оставлены как есть',
      clearAnyway: 'Откатить и их',
      notAForm: 'Откройте форму «новое объявление» на ss.ge или myhome.ge',
    },

    error: {
      network: 'Нет связи с kleekTo. Данные сохранены — попробуйте ещё раз.',
      session: 'Сессия истекла. Войдите заново.',
      unknown: 'Что-то пошло не так. Попробуйте ещё раз.',
    },
  },
};
