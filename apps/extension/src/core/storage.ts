import { isLocale, type Locale } from '@cleekto/i18n';

/**
 * Хранилище расширения.
 *
 * `chrome.storage.local`, а не `localStorage` — требование §6.3. Разница
 * существенная: `localStorage` в content script принадлежит домену площадки,
 * то есть токен агентства лежал бы в песочнице ss.ge и был бы доступен любому
 * скрипту на их странице. `chrome.storage` принадлежит расширению.
 *
 * Обёртка вокруг chrome API тонкая и намеренно единственная: она же делает
 * остальной код тестируемым — подменяется одна функция, а не глобал.
 */

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Момент истечения access-токена, мс эпохи. */
  expiresAt: number;
  email: string;
  locale: Locale;
}

const KEY = 'session';

export interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Хранилище расширения. Вызывается только там, где chrome действительно есть. */
export function chromeStorage(): StorageArea {
  return {
    get: (key) => chrome.storage.local.get(key),
    set: (items) => chrome.storage.local.set(items),
    remove: (key) => chrome.storage.local.remove(key),
  };
}

export async function readSession(area: StorageArea): Promise<Session | null> {
  const stored = (await area.get(KEY))[KEY];
  return isSession(stored) ? stored : null;
}

export async function writeSession(area: StorageArea, session: Session): Promise<void> {
  await area.set({ [KEY]: session });
}

export async function clearSession(area: StorageArea): Promise<void> {
  await area.remove(KEY);
}

/**
 * Проверка формы хранимого значения.
 *
 * Нужна не из педантизма: в `chrome.storage` лежит то, что записала прошлая
 * версия расширения. После обновления там может оказаться объект другой формы,
 * и слепое доверие обернулось бы падением на старте — у агента, посреди дня.
 */
function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;

  return (
    typeof s.accessToken === 'string' &&
    typeof s.refreshToken === 'string' &&
    typeof s.expiresAt === 'number' &&
    typeof s.email === 'string' &&
    typeof s.locale === 'string' &&
    isLocale(s.locale)
  );
}
