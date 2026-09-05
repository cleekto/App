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
    headline: 'Объявление — в объект. Объект — в сделку.',
    supporting: 'Всё, что нужно агентству: объекты, собственники и сделки в одном месте.',
    chainProperty: 'Объект',
    chainClient: 'Клиент',
    chainDeal: 'Сделка',
    welcomeBack: 'С возвращением',
    welcomeHint: 'Войдите в рабочее пространство агентства.',
    previewDeals: 'сделок',
    previewLeads: 'объектов',
    previewPipeline: 'Воронка',
    previewActivity: 'Последние события',
    previewNewProperty: 'Новый объект',
    previewOwnerCalled: 'Собственник согласился',
    previewPublished: 'Объявление размещено',
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

  chat: {
    // Чат компании: комнаты видит вся компания, создают их админ и менеджер.
    rooms: 'Комнаты',
    newRoom: 'Новая комната',
    roomName: 'Название',
    roomTopic: 'О чём комната',
    roomColor: 'Цвет',
    create: 'Создать',
    archive: 'В архив',
    archived: 'В архиве',
    emptyRooms: 'Комнат пока нет',
    emptyRoomsHint: 'Комнату заводит менеджер или администратор — например, «Общий» или «Ваке».',
    pickRoom: 'Выберите комнату слева',
    emptyMessages: 'Здесь пока пусто',
    emptyMessagesHint: 'Напишите первое сообщение — его увидит вся компания.',
    write: 'Написать сообщение',
    send: 'Отправить',
    edited: 'изменено',
    deleted: 'Сообщение удалено',
    delete: 'Удалить',
    // Личная переписка.
    conversations: 'Переписки',
    newConversation: 'Написать сотруднику',
    pickConversation: 'Выберите переписку слева',
    emptyConversations: 'Переписок пока нет',
    emptyConversationsHint:
      'Выберите сотрудника, чтобы начать разговор. Переписку видите только вы двое.',
    privateHint: 'Личная переписка. Её не видит никто, кроме вас двоих.',
  },

  nav: {
    properties: 'Объекты',
    board: 'Доска',
    tasks: 'Задачи',
    chat: 'Чат',
    messages: 'Сообщения',
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
    addManually: 'Завести объект',
    addFailed: 'Не удалось завести объект. Проверьте поля и попробуйте снова.',
    ownerName: 'Имя собственника',
    ownerPhone: 'Телефон собственника',
    ownerPhoneHint: 'Обязателен: по телефону находятся дубли.',
    transactionLabel: 'Сделка',
    typeLabel: 'Тип объекта',
    roomsLabel: 'Комнат',
    areaLabel: 'Площадь, м²',
    floorLabel: 'Этаж',
    totalFloorsLabel: 'Этажей в доме',
    districtLabel: 'Район',
    addressLabel: 'Адрес',
    priceLabel: 'Цена',
    currencyLabel: 'Валюта',
    duplicateTitle: 'У вашей команды уже есть похожее',
    duplicateHint:
      'Объект не создан. Откройте найденное или заведите всё равно — введённое не потеряется.',
    createAnyway: 'Всё равно завести',
    photoAlt: 'Фотография объекта',

    // Характеристики из объявления. Показывается только то, что площадка
    // сказала: пустое поле означает «не сказано», а не «нет».
    characteristics: 'Характеристики',
    bedrooms: 'Спален',
    bathrooms: 'Санузлов',
    balconies: 'Балконов',
    balconyArea: 'Балкон',
    houseArea: 'Дом',
    yardArea: 'Двор',
    condition: 'Состояние ремонта',
    buildingStatus: 'Статус дома',
    projectType: 'Тип проекта',
    cadastralCode: 'Кадастровый код',
    sellerKind: 'Объявление подал',
    sellerOwner: 'Собственник',
    sellerAgency: 'Маклер',
    photoCount: 'фото',
    empty: 'Объектов пока нет',
    emptyHint: 'Объект появляется, когда собственник согласился по телефону.',
    search: 'Поиск по адресу, району или телефону',
    found: 'найдено',
    reset: 'Сбросить',
    // Два режима списка: плотный для работы, плиточный для просмотра.
    viewList: 'Списком',
    viewGrid: 'Плитками',
    updated: 'Обновлён',
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
    moveFailed: 'Не удалось перенести карточку. Возможно, объект другой команды.',
    orderFailed: 'Не удалось сохранить новый порядок стадий.',
    stageIsSystem:
      'На эту стадию встают объекты при импорте и публикации, поэтому её нельзя удалить.',
    stageNotEmpty: 'В стадии остались объекты. Укажите, куда их перенести.',
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

  /**
   * Названия действий в истории.
   *
   * Ключ — код из `ACTIVITY`, набор закрытый и наш собственный. Поэтому
   * пропущенный перевод здесь именно ошибка, и видимая дыра `⟦ключ⟧` —
   * правильное поведение: она заметна на экране и ловится тестом полноты.
   *
   * Формулировки в прошедшем времени и безлично: строка отвечает на вопрос
   * «что произошло», а кто это сделал, стоит рядом отдельной строкой.
   */
  activityAction: {
    COMPANY_REGISTERED: 'Компания зарегистрирована',
    USER_CREATED: 'Сотрудник заведён',
    USER_DEACTIVATED: 'Сотрудник отключён',
    USER_UPDATED: 'Карточка сотрудника изменена',
    USER_LOGGED_IN: 'Вход в систему',
    USER_LOGGED_OUT: 'Выход из системы',
    USER_LOCALE_CHANGED: 'Язык интерфейса изменён',
    USER_PASSWORD_CHANGED: 'Пароль изменён',
    REFRESH_REUSE_DETECTED: 'Повторное использование токена — сессии отозваны',
    TEAM_CREATED: 'Команда создана',
    TEAM_UPDATED: 'Команда переименована',
    TEAM_DELETED: 'Команда удалена',
    ASSIGNED_TO_TEAM: 'Переведён в команду',
    OWNER_AGREED: 'Собственник согласился',
    LISTING_LINKED: 'Объявление привязано к объекту',
    LISTING_RESEEN: 'Объявление встретилось снова',
    IMPORT_DUPLICATE_WARNED: 'Предупреждение о дубле при импорте',
    PUBLICATION_DRAFTED: 'Черновик объявления собран',
    PUBLICATION_FILLED: 'Форма размещения заполнена',
    LISTING_PUBLISHED: 'Объявление размещено',
    SELF_PUBLICATION_LINKED: 'Своё объявление вернулось и привязано',
    CHAT_ROOM_CREATED: 'Создана комната чата',
    CHAT_ROOM_UPDATED: 'Комната чата изменена',
    CHAT_MESSAGE_DELETED: 'Сообщение удалено',
    MIGRATION_APPLIED: 'Перенос из файла применён',
    MIGRATION_ROLLED_BACK: 'Перенос из файла отменён',
    PROPERTY_STATUS_CHANGED: 'Статус изменён',
    PROPERTY_ASSIGNED: 'Назначен ответственный',
    PROPERTY_UPDATED: 'Объект изменён',
    PROPERTY_CREATED_MANUALLY: 'Объект заведён вручную',
    TASK_CREATED: 'Задача создана',
    TASK_COMPLETED: 'Задача выполнена',
    TASK_CANCELLED: 'Задача отменена',
    COMMENT_ADDED: 'Комментарий добавлен',
    PIPELINE_STATUS_CREATED: 'Стадия воронки заведена',
    PIPELINE_STATUS_UPDATED: 'Стадия воронки изменена',
    PIPELINE_STATUS_DELETED: 'Стадия воронки удалена',
    PIPELINE_STATUS_REORDERED: 'Порядок стадий изменён',
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
    teamHasProperties: 'За командой числятся объекты. Сначала переведите их в другую команду.',
    teamHasMembers: 'В команде остались люди. Сначала переведите их в другую команду.',
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
      // Площадка сохраняет черновик формы у себя, поэтому в полях могут
      // лежать данные объекта, который агент заполнял до этого.
      stalePrevious: 'В форме остались данные прошлого объекта',
      staleUnchecked: 'Проверьте также',
      clearForm: 'Очистить форму',
      cleared: 'Форма очищена',
      editedWarning: 'Эти поля вы правили после заполнения. Они оставлены как есть',
      clearAnyway: 'Откатить и их',
      notAForm: 'Откройте форму «новое объявление» на ss.ge или myhome.ge',
    },

    error: {
      network: 'Нет связи с kleekTo. Данные сохранены — попробуйте ещё раз.',
      // Адрес виден в сообщении намеренно: расширение собирается под него
      // на сборке, и «нет связи» чаще всего значит «собрано не туда»,
      // а не «сервер лежит». Без адреса эти два случая неразличимы.
      networkAddress: 'Адрес',
      session: 'Сессия истекла. Войдите заново.',
      unknown: 'Что-то пошло не так. Попробуйте ещё раз.',
    },
  },
};
