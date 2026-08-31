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
    notSignedIn: 'Not signed in',
  },
  extension: {
    signInPrompt: 'Sign in to Cleekto to start importing listings',
  },
} as const;
