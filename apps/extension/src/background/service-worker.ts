import { ApiClient, UnauthenticatedError } from '../core/api-client';
import { API_URL } from '../core/config';
import { MENU_IDS, outcomeByMenuId } from '../core/messages';
import type { ContentToWorker, WorkerReply, WorkerToContent } from '../core/messages';
import { chromeStorage, readSession } from '../core/storage';

/**
 * Service worker: контекстное меню, сеть, токены.
 *
 * Здесь нет ни одной строки, знающей про разметку площадок, и нет доступа
 * к DOM страницы — по устройству MV3. Всё, что worker знает о странице, —
 * её адрес.
 *
 * Пункты меню создаются один раз при установке. Показываются только на
 * страницах объявлений: пункт «Согласен» на странице новостей выглядел бы
 * как дефект и обучал бы агента, что расширение срабатывает где попало.
 */

/**
 * Где расширение работает.
 *
 * Список сознательно узкий и совпадает с `host_permissions` в манифесте:
 * расширению незачем видеть страницы, которые оно не обслуживает.
 */
const LISTING_PATTERNS = [
  'https://home.ss.ge/*/udzravi-qoneba/*',
  'https://ss.ge/*/udzravi-qoneba/*',
  'https://www.myhome.ge/*',
  'https://myhome.ge/*',
];

const api = new ApiClient({
  baseUrl: API_URL,
  storage: chromeStorage(),
  fetch: (...args) => globalThis.fetch(...args),
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'kleekto-root',
      title: 'kleekTo',
      contexts: ['page', 'selection', 'link'],
      documentUrlPatterns: LISTING_PATTERNS,
    });

    // Порядок пунктов повторяет DESIGN §25.4: сначала тот, что создаёт
    // объект, затем три, которые только помечают объявление.
    for (const [outcome, id] of Object.entries(MENU_IDS)) {
      chrome.contextMenus.create({
        id,
        parentId: 'kleekto-root',
        title: menuTitle(outcome),
        contexts: ['page', 'selection', 'link'],
        documentUrlPatterns: LISTING_PATTERNS,
      });
    }
  });
});

/**
 * Заголовок пункта меню.
 *
 * Контекстное меню Chrome рисуется до того, как страница загрузится, и языка
 * пользователя в этот момент у нас может не быть. Поэтому здесь единственное
 * место, где строка не берётся из словаря: Chrome умеет подставлять переводы
 * сам через `chrome.i18n`, а до появления `_locales` пункты названы нейтрально
 * и раскрываются в понятный интерфейс на самой странице.
 *
 * ЗАДАЧА ФАЗЫ 7: перенести пункты меню в `_locales`, чтобы правило 18
 * выполнялось и здесь. Отмечено как OPEN, а не забыто.
 */
function menuTitle(outcome: string): string {
  switch (outcome) {
    case 'consent':
      return 'kleekTo: +';
    case 'refused':
      return 'kleekTo: ×';
    case 'no_answer':
      return 'kleekTo: …';
    default:
      return 'kleekTo: ⏰';
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const outcome = outcomeByMenuId(String(info.menuItemId));
  if (outcome === null || tab?.id === undefined) return;

  const message: WorkerToContent = { type: 'outcome', outcome };
  // Ответ не нужен: дальше всё происходит на странице.
  void chrome.tabs.sendMessage(tab.id, message).catch(() => {
    // Content script не отвечает — например, страница открыта до установки
    // расширения. Молчаливое падение здесь лучше, чем исключение в worker:
    // агент увидит, что ничего не произошло, и перезагрузит страницу.
  });
});

chrome.runtime.onMessage.addListener(
  (message: ContentToWorker, _sender, sendResponse: (reply: WorkerReply) => void) => {
    void handle(message).then(sendResponse);
    // true = ответ придёт асинхронно. Без него Chrome закроет канал.
    return true;
  },
);

async function handle(message: ContentToWorker): Promise<WorkerReply> {
  try {
    switch (message.type) {
      case 'import': {
        const response = await api.importListing(message.body);
        return { ok: true, response };
      }
      case 'session': {
        const session = await readSession(chromeStorage());
        return {
          ok: true,
          session: session === null ? null : { email: session.email, locale: session.locale },
        };
      }
      case 'login': {
        const session = await api.login(message.email, message.password);
        return { ok: true, session: { email: session.email, locale: session.locale } };
      }
      case 'logout': {
        await api.logout();
        return { ok: true, session: null };
      }
    }
  } catch (error) {
    return {
      ok: false,
      error: classify(error),
      // Текст только для журнала расширения. Агенту показывается строка
      // из словаря: сообщение сервера может быть на другом языке.
      message: error instanceof Error ? error.message : 'unknown',
    };
  }
}

function classify(error: unknown): 'network' | 'session' | 'unknown' {
  if (error instanceof UnauthenticatedError) return 'session';
  if (error instanceof TypeError) return 'network';
  return 'unknown';
}
