import type { CallOutcome, ImportRequestBody, ImportResponse } from './import-manager';

/**
 * Сообщения между частями расширения.
 *
 * ЗАЧЕМ ОНИ ВООБЩЕ. Сеть живёт в service worker, DOM — в content script,
 * и это требование §6.5, а не архитектурная поза: запрос из content script
 * уходил бы с origin площадки, то есть с их CORS и с токеном агентства
 * в чужой песочнице.
 *
 * Отсюда разделение: content script умеет читать страницу и рисовать, worker
 * умеет ходить в сеть и хранить токен. Между ними — этот файл.
 */

export type ContentToWorker =
  /** Отправить готовое тело импорта. Единственный путь расширения в сеть. */
  | { type: 'import'; body: ImportRequestBody }
  | { type: 'session' }
  | { type: 'login'; email: string; password: string }
  | { type: 'logout' };

export type WorkerToContent =
  /**
   * Агент выбрал исход в контекстном меню. Дальше content script делает
   * ровно то же, что по кнопке на странице: одна логика на оба входа
   * (требование §5Б.2).
   */
  { type: 'outcome'; outcome: CallOutcome };

export type WorkerReply =
  | { ok: true; response: ImportResponse }
  | { ok: true; session: { email: string; locale: string } | null }
  | { ok: false; error: 'network' | 'session' | 'unknown'; message: string };

/** Идентификаторы пунктов контекстного меню. Совпадают с исходами разговора. */
export const MENU_IDS: Readonly<Record<CallOutcome, string>> = {
  consent: 'kleekto-consent',
  refused: 'kleekto-refused',
  no_answer: 'kleekto-no-answer',
  callback: 'kleekto-callback',
};

export function outcomeByMenuId(menuId: string): CallOutcome | null {
  for (const [outcome, id] of Object.entries(MENU_IDS)) {
    if (id === menuId) return outcome as CallOutcome;
  }
  return null;
}
