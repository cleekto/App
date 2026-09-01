import { adapterFor } from '@cleekto/adapters';
import { isLocale, type Locale } from '@cleekto/i18n';

import { APP_URL } from '../core/config';
import type { CallOutcome, ImportRequestBody, ImportResponse } from '../core/import-manager';
import { runImport } from '../core/import-manager';
import type { ContentToWorker, WorkerReply, WorkerToContent } from '../core/messages';
import { Ui } from './ui';

/**
 * Content script: страница объявления.
 *
 * Здесь есть DOM и нет сети. Всё, что уходит на сервер, уходит сообщением
 * в service worker (§6.5) — и это же единственная точка `send` для
 * `runImport`. Логика импорта общая для контекстного меню и кнопки
 * на странице: требование §5Б.2, «поверх одной общей логики».
 */

/** Последний выбранный исход — чтобы «Повторить» повторяло именно его. */
let lastOutcome: CallOutcome | null = null;
let lastCallbackAt: string | null = null;

function ask(message: ContentToWorker): Promise<WorkerReply> {
  return chrome.runtime.sendMessage(message) as Promise<WorkerReply>;
}

/**
 * Единственный выход в сеть для этой страницы.
 *
 * `runImport` вызывает его только после проверки телефона. Если проверка
 * не прошла, сюда не приходит ничего — это и доказывает обязательный тест
 * фазы 6.
 */
async function send(body: ImportRequestBody): Promise<ImportResponse> {
  const reply = await ask({ type: 'import', body });

  if (!('ok' in reply) || reply.ok !== true || !('response' in reply)) {
    const error = 'error' in reply ? reply.error : 'unknown';
    const failure = new Error(error);
    failure.name = error === 'session' ? 'UnauthenticatedError' : 'Error';
    throw failure;
  }

  return reply.response;
}

async function currentLocale(): Promise<Locale> {
  const reply = await ask({ type: 'session' });
  if ('session' in reply && reply.session !== null && isLocale(reply.session.locale)) {
    return reply.session.locale;
  }

  // Не вошли — язык берём у браузера, чтобы приглашение войти было понятным.
  const primary = navigator.language.split('-')[0] ?? 'en';
  return isLocale(primary) ? primary : 'en';
}

async function signedIn(): Promise<boolean> {
  const reply = await ask({ type: 'session' });
  return 'session' in reply && reply.session !== null;
}

async function main(): Promise<void> {
  // Страница не объявление — расширение молчит. Не ошибка: агент просто
  // открыл что-то другое.
  if (adapterFor(location.href) === null) return;

  const ui = new Ui(await currentLocale(), (action) => {
    void onAction(action);
  });
  ui.hide();

  async function openMenu(): Promise<void> {
    if (!(await signedIn())) {
      ui.signInRequired();
      return;
    }

    // Извлечение локальное, сети не касается — показать сводку можно всегда.
    const adapter = adapterFor(location.href);
    if (adapter === null) return;

    const extraction = adapter.extract(document, location.href);
    ui.outcomeMenu({
      title: extraction.payload.title,
      price: extraction.payload.price,
      currency: extraction.payload.currency,
      area: extraction.payload.area,
      rooms: extraction.payload.rooms,
      address: extraction.payload.address,
      district: extraction.payload.district,
      phone: null,
      missingFields: extraction.missingFields,
    });
  }

  async function perform(
    outcome: CallOutcome,
    extra: Partial<ImportOptionsLite> = {},
  ): Promise<void> {
    lastOutcome = outcome;

    // ПОВТОРНОЕ ИЗВЛЕЧЕНИЕ НА КАЖДОМ ДЕЙСТВИИ — не расточительность.
    // Между открытием меню и нажатием агент мог раскрыть телефон, и «Повторить»
    // обязано увидеть новое состояние страницы, а не закешированное старое.
    const result = await runImport({ send }, document, location.href, {
      outcome,
      ...(extra.callbackAt === undefined ? {} : { callbackAt: extra.callbackAt }),
      ...(extra.doNotCallCompanyWide === undefined
        ? {}
        : { doNotCallCompanyWide: extra.doNotCallCompanyWide }),
      ...(extra.acknowledgedDuplicateOf === undefined
        ? {}
        : { acknowledgedDuplicateOf: extra.acknowledgedDuplicateOf }),
    });

    switch (result.kind) {
      case 'unsupported':
        return;

      case 'phone_not_revealed':
        // ПРАВИЛО 11. Запроса не было.
        ui.phoneNotRevealed(result.preview);
        return;

      case 'failed':
        ui.error(result.error);
        return;

      case 'sent':
        report(result.response, outcome);
        return;
    }
  }

  function report(response: ImportResponse, outcome: CallOutcome): void {
    if (response.result === 'duplicate_blocked') {
      ui.duplicate('blocked', []);
      return;
    }

    if (response.result === 'duplicate_warning') {
      ui.duplicate('warning', matchIds(response.matches));
      return;
    }

    if (response.result === 'created' || response.result === 'linked_to_existing') {
      // Пометка о работе другой команды — сообщение, а не запрет: область
      // проверки здесь компания, а блокирует только своя команда (инвариант 9).
      if (response.otherTeamMatches.length > 0) {
        ui.duplicate('other_team', []);
        return;
      }
      ui.added(
        response.propertyId === null ? null : `${APP_URL}/properties/${response.propertyId}`,
      );
      return;
    }

    // observation_recorded — три исхода, не создающие объект.
    switch (outcome) {
      case 'refused':
        ui.refusedRecorded();
        return;
      case 'no_answer':
        ui.noAnswerRecorded();
        return;
      default:
        ui.callbackRecorded();
    }
  }

  async function onAction(
    action: Parameters<ConstructorParameters<typeof Ui>[1]>[0],
  ): Promise<void> {
    switch (action.type) {
      case 'outcome':
        if (action.outcome === 'callback') {
          ui.callbackPicker();
          return;
        }
        await perform(action.outcome);
        return;

      case 'callback': {
        const at = new Date(Date.now() + action.days * 24 * 60 * 60 * 1000).toISOString();
        lastCallbackAt = at;
        await perform('callback', { callbackAt: at });
        return;
      }

      case 'confirm':
        await perform('consent', {
          ...(action.acknowledgedDuplicateOf === undefined
            ? {}
            : { acknowledgedDuplicateOf: action.acknowledgedDuplicateOf }),
        });
        return;

      case 'do-not-call':
        // Повтор того же отказа с флагом. Сервер работает по upsert, второй
        // записи не появится — область меняется с команды на компанию.
        await perform('refused', { doNotCallCompanyWide: true });
        ui.refusedRecorded();
        return;

      case 'retry':
        if (lastOutcome === null) {
          await openMenu();
          return;
        }
        await perform(
          lastOutcome,
          lastOutcome === 'callback' && lastCallbackAt !== null
            ? { callbackAt: lastCallbackAt }
            : {},
        );
        return;

      case 'close':
        ui.hide();
    }
  }

  // Вход первый: кнопка на странице объявления.
  mountButton(() => {
    void openMenu();
  });

  // Вход второй: контекстное меню. Логика ниже — та же самая.
  chrome.runtime.onMessage.addListener((message: WorkerToContent) => {
    if (message.type !== 'outcome') return;

    void (async () => {
      if (!(await signedIn())) {
        ui.signInRequired();
        return;
      }
      if (message.outcome === 'callback') {
        ui.callbackPicker();
        return;
      }
      await perform(message.outcome);
    })();
  });
}

interface ImportOptionsLite {
  callbackAt: string;
  doNotCallCompanyWide: boolean;
  acknowledgedDuplicateOf: string[];
}

function matchIds(matches: unknown[]): string[] {
  return matches
    .map((match) =>
      typeof match === 'object' && match !== null && 'propertyId' in match
        ? String((match as { propertyId: unknown }).propertyId)
        : null,
    )
    .filter((id): id is string => id !== null);
}

/**
 * Кнопка на странице объявления.
 *
 * Отдельным хостом с своим shadow root — по той же причине, что и панель:
 * стили площадки не должны её доставать.
 */
function mountButton(onClick: () => void): void {
  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    .fab {
      position: fixed; right: 20px; bottom: 20px; z-index: 2147483646;
      width: 48px; height: 48px; border: none; border-radius: 24px;
      background: #1f6feb; color: #ffffff; cursor: pointer;
      font: 600 18px system-ui, sans-serif;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    }
  `;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'fab';
  // Логотип, а не слово: кнопка обязана читаться на всех трёх языках,
  // а места под подпись здесь нет.
  button.textContent = 'C';
  button.addEventListener('click', onClick);

  root.append(style, button);
  document.body.append(host);
}

void main();
