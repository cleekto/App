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
    name: 'Cleekto',
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
  },
  dashboard: {
    title: 'Сводка',
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
  settings: {
    title: 'Настройки',
    profiles: 'Профили публикации',
    profilesHint: 'Лицо агентства в объявлении. Никогда не контакт собственника.',
    team: 'Команда',
    users: 'Люди',
    role: 'Роль',
    noProfiles: 'Профилей публикации пока нет',
    displayName: 'Имя в объявлении',
    phone: 'Телефон в объявлении',
    default: 'По умолчанию',
  },

  extension: {
    signInPrompt: 'Войдите в Cleekto, чтобы импортировать объявления',
    signIn: 'Войти',
    email: 'Почта',
    password: 'Пароль',
    signedInAs: 'Вы вошли как',
    signOut: 'Выйти',

    notAListing: 'Откройте объявление на ss.ge или myhome.ge',
    detected: 'Объявление распознано',

    callResult: 'Результат разговора',

    outcome: {
      consent: 'Согласен — добавить в Cleekto',
      refused: 'Отказ / не звонить',
      noAnswer: 'Недозвон',
      callback: 'Перезвонить через…',
    },

    phoneNotRevealed:
      'Сначала откройте номер телефона на странице, затем нажмите «Согласен» ещё раз.',

    added: {
      title: 'Добавлено в Cleekto',
      status: 'В базе · закреплено за вами',
      open: 'Открыть в Cleekto',
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
      network: 'Нет связи с Cleekto. Данные сохранены — попробуйте ещё раз.',
      session: 'Сессия истекла. Войдите заново.',
      unknown: 'Что-то пошло не так. Попробуйте ещё раз.',
    },
  },
};
