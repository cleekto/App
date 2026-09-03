/**
 * Английский — опорный словарь.
 *
 * Его набор ключей задаёт тип `Dictionary`: чего нет здесь, того не существует
 * и в остальных языках. Опорным он выбран не потому, что главный — три языка
 * равноправны (ADR-0008), — а потому, что нужен один источник формы объекта.
 */
export const en = {
  app: {
    name: 'kleekTo',
    tagline: 'Real estate CRM',
  },
  health: {
    ok: 'All systems operational',
    databaseUnavailable: 'Database unavailable',
  },
  common: {
    loading: 'Loading',
    retry: 'Retry',
    cancel: 'Cancel',
    save: 'Save',
    close: 'Close',
    notSignedIn: 'Not signed in',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
  },
  dashboard: {
    title: 'Analytics',
    scopeCompany: 'Whole agency',
    scopeTeam: 'Your team',
    newToday: 'New today',
    newThisWeek: 'New this week',
    totalProperties: 'Properties in base',
    byStatus: 'By status',
    people: 'People',
    consentsThisWeek: 'Agreements this week',
    propertiesOwned: 'Properties assigned',
    quality: 'Quality',
    duplicateRate: 'Ran into a duplicate',
    duplicateHint: 'A high share is not a fault. It means teams are calling the same owners.',
    parserFailureRate: 'Listings with unread fields',
    parserHint:
      'This is how you learn a portal changed its markup, instead of hearing it from an angry agent.',
    topMissing: 'Most often unread',
    publishing: 'Publishing',
    filledToday: 'Forms filled today',
    filledThisWeek: 'Forms filled this week',
    publishedThisWeek: 'Published this week',
    publishedShare: 'Properties published somewhere',
    averageUnfilled: 'Fields left per form',
    fillFailureRate: 'Forms with fields left',
    chronicallyUnfilled: 'Almost always empty',
    chronicHint:
      'Either the CRM lacks the data or the adapter dictionary has a hole. Both are work to do.',
    noData: 'Nothing to show yet',
  },

  nav: {
    properties: 'Properties',
    board: 'Board',
    tasks: 'Tasks',
    settings: 'Settings',
    signOut: 'Sign out',
    menu: 'Menu',
    closeMenu: 'Close menu',
  },
  auth: {
    signIn: 'Sign in',
    email: 'Email',
    password: 'Password',
    failed: 'Wrong email or password',
  },
  property: {
    type: {
      APARTMENT: 'Apartment',
      HOUSE: 'House',
      LAND: 'Land',
      COMMERCIAL: 'Commercial',
    },
    transaction: {
      SALE: 'For sale',
      RENT: 'For rent',
    },
    origin: {
      consent: 'Owner agreed',
      manual: 'Added by hand',
      legacy_import: 'Migrated from the agency file',
    },
    rooms: 'rooms',
    floor: 'floor',
    unassigned: 'Unassigned',
    sharedWithOtherTeam: 'Another team is working with this owner too',
    owner: 'Owner',
    noOwner: 'No owner contact',
    listings: 'Listings',
    sourceDescription: 'Description from the listing',
    publicDescription: 'Description for publishing',
    publicDescriptionHint: 'Written by you. The listing text belongs to someone else.',
    activity: 'History',
    comments: 'Comments',
    tasks: 'Tasks',
    addComment: 'Add a comment',
    send: 'Send',
    status: 'Status',
    assignee: 'Assigned to',
    publish: 'Publish',
    publications: 'Published on',
    notPublished: 'Not published anywhere yet',
    openSource: 'Open the listing',
    empty: 'No properties yet',
    emptyHint: 'A property appears when an owner agrees on the phone.',
    search: 'Search by address, district or phone',
    found: 'found',
    reset: 'Reset',
    allStatuses: 'All statuses',
    allTypes: 'All types',
    publishCheckOpenExisting: 'Open the existing one',
    publishCheckAnyway: 'Publish anyway',
    publishCheckCancel: 'Cancel',
  },
  board: {
    title: 'Board',
    empty: 'Nothing in this status',

    manage: 'Stage settings',
    addStage: 'Add stage',
    stageName: 'Stage name',
    rename: 'Rename',
    color: 'Colour',
    deleteStage: 'Delete stage',
    confirmDelete: 'Delete — confirm',
    moveTo: 'Move the objects to',
    occupied: 'The stage holds {count} objects. They will move, not disappear.',
    systemStage: 'Objects land here on import and on publishing, so the stage cannot be deleted.',
    failed: 'Could not save. Try again.',
    colors: {
      brand: 'Primary',
      success: 'Success',
      warning: 'Attention',
      danger: 'Alarm',
      neutral: 'Neutral',
    },
  },
  task: {
    title: 'Tasks',
    mine: 'My tasks',
    followUps: 'Call backs due',
    empty: 'Nothing to do right now',
    noFollowUps: 'No call backs due',
    add: 'New task',
    titleField: 'What to do',
    dueField: 'Due',
    assigneeField: 'Assigned to',
    due: 'Due',
    overdue: 'Overdue',
    done: 'Done',
    cancel: 'Cancel',
    open: 'Open',
    create: 'Create',
  },
  /**
   * Названия статусов воронки по КОДУ статуса, а не по его имени в базе.
   *
   * Имя в базе — то, что компания может переписать под себя (инвариант 4).
   * Код у статусов, созданных при регистрации, известен заранее, и только
   * они переводятся. Свой статус компании остаётся с её собственным именем:
   * подменять его переводом было бы враньём.
   */
  pipeline: {
    IN_BASE: 'In base',
    IN_PROGRESS: 'In progress',
    OFFERED: 'Offered to client',
    CLOSED: 'Closed',
    ARCHIVED: 'Archived',
  },

  settings: {
    title: 'Settings',
    account: 'Account',
    accountHint: 'Sign-in and password for this account.',
    changePassword: 'Change password',
    currentPassword: 'Current password',
    newPassword: 'New password',
    newPasswordHint: 'At least 12 characters.',
    changePasswordFailed: 'Could not change the password. Check the current password.',
    team: 'Team',
    teams: 'Teams',
    teamsHint:
      'An agent works inside a team, and a property belongs to one. Without a team there is nobody to import listings.',
    users: 'People',
    usersHint: 'Who works in the agency and what they are allowed to do.',
    role: 'Role',
    noTeams: 'No teams yet',
    phone: 'Phone in the listing',
    language: 'Interface language',

    edit: 'Edit',
    deactivate: 'Disable',
    confirmDeactivate: 'Disable — confirm',
    activate: 'Enable',
    inactive: 'disabled',
    publishesAs: 'Publishes as',

    phoneHint: 'The number that goes into the listing. Without it the person cannot publish.',
    noPhone: 'No work phone — this person cannot publish yet',

    manager: 'Manager',
    noManager: 'No manager in this team',
    rename: 'Rename',
    deleteTeam: 'Delete team',
    confirmDeleteTeam: 'Delete — confirm',
    teamEmpty: 'Nobody in this team yet',
    unassigned: 'Outside teams',
    unassignedHint:
      'People who belong to no team. They cannot import listings or own properties — a team is the scope for both.',
    everyoneInTeams: 'Everyone is in a team',

    addTeam: 'Add team',
    teamName: 'Team name',
    members: 'people',

    addUser: 'Add person',
    fullName: 'Full name',
    password: 'Password',
    passwordHint: 'At least 12 characters. There is no password recovery yet — write it down.',
    noTeam: 'No team',
    noTeamHint:
      'An admin without a team cannot import listings. That is intended: agents call and import.',

    roles: {
      admin: 'Administrator — the whole company',
      manager: 'Manager — their team',
      agent: 'Agent — their own properties',
    },

    created: 'Saved',
    failed: 'Could not save. Check the fields and try again.',
  },

  extension: {
    signInPrompt: 'Sign in to kleekTo to start importing listings',
    signIn: 'Sign in',
    email: 'Email',
    password: 'Password',
    signedInAs: 'Signed in as',
    signOut: 'Sign out',

    /** Popup на странице, которую мы не обслуживаем. */
    notAListing: 'Open a listing on ss.ge or myhome.ge',
    detected: 'Listing detected',

    /**
     * Заголовок меню исходов. DESIGN §25.4: агент уже позвонил и записывает
     * результат — меню открывается без выбранного по умолчанию пункта.
     */
    callResult: 'Call result',

    outcome: {
      /** Формулировка говорит, что произойдёт, а не «согласен» (DESIGN §25.4). */
      consent: 'Agreed — add to kleekTo',
      refused: 'Declined / do not call',
      noAnswer: 'No answer',
      callback: 'Call back in…',
    },

    /**
     * Правило 11 и DESIGN §25.1. Это блокирующее состояние, а не ошибка:
     * ничего не сломалось, просто пропущен шаг. Тон спокойный, без «ошибка».
     */
    phoneNotRevealed: 'Reveal the phone number on the page, then press “Agreed” again.',

    added: {
      title: 'Added to kleekTo',
      /** Статус называется вслух: агент узнает его потом на доске. */
      status: 'In base · assigned to you',
      open: 'Open in kleekTo',
    },

    refusedRecorded: {
      title: 'Marked as declined',
      /** Конкуренция команд разрешена, и прятать это было бы похоже на дефект. */
      scope: 'Your team won’t see this listing in the feed. Other teams still will.',
      doNotCall: 'Owner asked not to be called again',
      doNotCallScope: 'Applies to the whole agency',
    },

    noAnswerRecorded: {
      title: 'Marked — no answer',
      scope: 'Back in the feed in about a day.',
    },

    callbackRecorded: {
      title: 'Call back scheduled',
    },
    callbackPrompt: 'Call back in',
    callbackTomorrow: 'Tomorrow',
    callbackThreeDays: '3 days',
    callbackWeek: 'A week',

    preview: {
      noDuplicate: 'No duplicate',
      notFilled: 'Not filled in',
      phone: 'Owner',
    },

    duplicate: {
      blocked: 'This property is already in your team’s database',
      warning: 'A similar property may already exist',
      otherTeam: 'Another team in your agency is working with this owner',
      addAnyway: 'Add anyway',
      linked: 'Linked to an existing property',
    },

    fill: {
      /** DESIGN §25.2: «от имени» всегда видно — это публичное лицо агентства. */
      publishingAs: 'Publishing as',
      filled: 'fields filled',
      leftForYou: 'Left for you',
      clearForm: 'Clear form',
      cleared: 'Form cleared',
      /** §6А.6: правку агента молча не стираем — сначала называем её. */
      editedWarning: 'You changed these fields after filling. They were left as they are',
      clearAnyway: 'Undo those too',
      notAForm: 'Open the “new listing” form on ss.ge or myhome.ge',
    },

    error: {
      network: 'No connection to kleekTo. Your data is kept — try again.',
      session: 'Your session has expired. Sign in again.',
      unknown: 'Something went wrong. Try again.',
    },
  },
} as const;
