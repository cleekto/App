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
    addManually: 'Add manually',
    addFailed: 'Could not add the property. Check the fields and try again.',
    ownerName: 'Owner name',
    ownerPhone: 'Owner phone',
    ownerPhoneHint: 'Required: the phone is how duplicates are found.',
    transactionLabel: 'Deal',
    typeLabel: 'Property type',
    roomsLabel: 'Rooms',
    areaLabel: 'Area, m²',
    floorLabel: 'Floor',
    totalFloorsLabel: 'Floors in building',
    districtLabel: 'District',
    addressLabel: 'Address',
    priceLabel: 'Price',
    currencyLabel: 'Currency',
    duplicateTitle: 'Your team already has something like this',
    duplicateHint:
      'The property has not been created. Open what was found, or add it anyway — nothing typed is lost.',
    createAnyway: 'Add anyway',
    photoAlt: 'Listing photo',

    characteristics: 'Characteristics',
    bedrooms: 'Bedrooms',
    bathrooms: 'Bathrooms',
    balconies: 'Balconies',
    balconyArea: 'Balcony',
    houseArea: 'House',
    yardArea: 'Yard',
    condition: 'Condition',
    buildingStatus: 'Building status',
    projectType: 'Project type',
    cadastralCode: 'Cadastral code',
    sellerKind: 'Listed by',
    sellerOwner: 'Owner',
    sellerAgency: 'Agent',
    photoCount: 'photos',
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
    moveFailed: 'Could not move the card. It may belong to another team.',
    orderFailed: 'Could not save the new stage order.',
    stageIsSystem:
      'Objects land on this stage on import and on publishing, so it cannot be deleted.',
    stageNotEmpty: 'The stage still holds objects. Say where to move them.',
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

  /**
   * Action names in the history.
   *
   * The key is a code from `ACTIVITY` — a closed set of our own. A missing
   * translation here is therefore a real bug, and the visible `⟦key⟧` hole
   * is the right behaviour: it shows on screen and the coverage test catches it.
   */
  activityAction: {
    COMPANY_REGISTERED: 'Company registered',
    USER_CREATED: 'Employee added',
    USER_DEACTIVATED: 'Employee disabled',
    USER_UPDATED: 'Employee card changed',
    USER_LOGGED_IN: 'Signed in',
    USER_LOGGED_OUT: 'Signed out',
    USER_LOCALE_CHANGED: 'Interface language changed',
    USER_PASSWORD_CHANGED: 'Password changed',
    REFRESH_REUSE_DETECTED: 'Token reused — sessions revoked',
    TEAM_CREATED: 'Team created',
    TEAM_UPDATED: 'Team renamed',
    TEAM_DELETED: 'Team deleted',
    ASSIGNED_TO_TEAM: 'Moved to a team',
    OWNER_AGREED: 'Owner agreed',
    LISTING_LINKED: 'Listing linked to the property',
    LISTING_RESEEN: 'Listing seen again',
    IMPORT_DUPLICATE_WARNED: 'Duplicate warning on import',
    PUBLICATION_DRAFTED: 'Listing draft assembled',
    PUBLICATION_FILLED: 'Publishing form filled',
    LISTING_PUBLISHED: 'Listing published',
    SELF_PUBLICATION_LINKED: 'Our own listing came back and was linked',
    MIGRATION_APPLIED: 'File import applied',
    MIGRATION_ROLLED_BACK: 'File import rolled back',
    PROPERTY_STATUS_CHANGED: 'Status changed',
    PROPERTY_ASSIGNED: 'Owner of record assigned',
    PROPERTY_UPDATED: 'Property changed',
    PROPERTY_CREATED_MANUALLY: 'Property added manually',
    TASK_CREATED: 'Task created',
    TASK_COMPLETED: 'Task completed',
    TASK_CANCELLED: 'Task cancelled',
    COMMENT_ADDED: 'Comment added',
    PIPELINE_STATUS_CREATED: 'Stage added',
    PIPELINE_STATUS_UPDATED: 'Stage changed',
    PIPELINE_STATUS_DELETED: 'Stage deleted',
    PIPELINE_STATUS_REORDERED: 'Stage order changed',
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
    teamHasProperties: 'The team still owns properties. Move them to another team first.',
    teamHasMembers: 'The team still has people. Move them to another team first.',
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
      stalePrevious: 'The form still holds data from a previous property',
      staleUnchecked: 'Also check',
      clearForm: 'Clear form',
      cleared: 'Form cleared',
      /** §6А.6: правку агента молча не стираем — сначала называем её. */
      editedWarning: 'You changed these fields after filling. They were left as they are',
      clearAnyway: 'Undo those too',
      notAForm: 'Open the “new listing” form on ss.ge or myhome.ge',
    },

    error: {
      network: 'No connection to kleekTo. Your data is kept — try again.',
      networkAddress: 'Address',
      session: 'Your session has expired. Sign in again.',
      unknown: 'Something went wrong. Try again.',
    },
  },
} as const;
