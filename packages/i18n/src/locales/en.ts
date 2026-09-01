/**
 * Английский — опорный словарь.
 *
 * Его набор ключей задаёт тип `Dictionary`: чего нет здесь, того не существует
 * и в остальных языках. Опорным он выбран не потому, что главный — три языка
 * равноправны (ADR-0008), — а потому, что нужен один источник формы объекта.
 */
export const en = {
  app: {
    name: 'Cleekto',
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
  },
  extension: {
    signInPrompt: 'Sign in to Cleekto to start importing listings',
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
      consent: 'Agreed — add to Cleekto',
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
      title: 'Added to Cleekto',
      /** Статус называется вслух: агент узнает его потом на доске. */
      status: 'In base · assigned to you',
      open: 'Open in Cleekto',
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

    error: {
      network: 'No connection to Cleekto. Your data is kept — try again.',
      session: 'Your session has expired. Sign in again.',
      unknown: 'Something went wrong. Try again.',
    },
  },
} as const;
