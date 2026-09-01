import { isLocale, translator, type Locale, type MessageKey } from '@cleekto/i18n';

import type { ContentToWorker, WorkerReply } from '../core/messages';

/**
 * Popup: вход и состояние сессии.
 *
 * Четыре действия исхода разговора живут на странице объявления, а не здесь
 * (§5Б.2 разрешает оба входа, но popup для них неудобен: агент смотрит
 * на объявление, а не на панель браузера). Popup отвечает за то, ради чего
 * его открывают, — вход и «кто я сейчас».
 *
 * Сети здесь тоже нет: всё через service worker (§6.5).
 */

function ask(message: ContentToWorker): Promise<WorkerReply> {
  return chrome.runtime.sendMessage(message) as Promise<WorkerReply>;
}

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (found === null) {
    // Разметка и скрипт разошлись — дефект сборки, а не состояние,
    // которое надо переживать молча.
    throw new Error(`popup.html: элемент #${id} не найден`);
  }
  return found as T;
}

function browserLocale(): Locale {
  const primary = navigator.language.split('-')[0] ?? 'en';
  return isLocale(primary) ? primary : 'en';
}

async function render(): Promise<void> {
  const reply = await ask({ type: 'session' });
  const session = 'session' in reply ? reply.session : null;

  // Язык пользователя важнее языка браузера: агент мог поставить систему
  // на русском, а работать на грузинском (ADR-0008).
  const locale = session !== null && isLocale(session.locale) ? session.locale : browserLocale();
  const t = translator(locale);

  const fill = (id: string, key: MessageKey): void => {
    element(id).textContent = t(key);
  };

  fill('app-name', 'app.name');
  fill('tagline', 'app.tagline');

  const signInForm = element<HTMLFormElement>('sign-in');
  const signedInBox = element('signed-in');

  if (session === null) {
    signInForm.hidden = false;
    signedInBox.hidden = true;

    fill('state', 'extension.signInPrompt');
    fill('label-email', 'extension.email');
    fill('label-password', 'extension.password');
    fill('submit', 'extension.signIn');
    return;
  }

  signInForm.hidden = true;
  signedInBox.hidden = false;

  element('who').textContent = `${t('extension.signedInAs')} ${session.email}`;
  fill('hint', 'extension.notAListing');
  fill('sign-out', 'extension.signOut');
}

element<HTMLFormElement>('sign-in').addEventListener('submit', (event) => {
  event.preventDefault();

  void (async () => {
    const email = element<HTMLInputElement>('email').value.trim();
    const password = element<HTMLInputElement>('password').value;
    const error = element('sign-in-error');

    error.hidden = true;
    const reply = await ask({ type: 'login', email, password });

    if ('ok' in reply && reply.ok === true) {
      await render();
      return;
    }

    const t = translator(browserLocale());
    error.textContent = t(
      'error' in reply && reply.error === 'network'
        ? 'extension.error.network'
        : 'extension.error.session',
    );
    error.hidden = false;
  })();
});

element('sign-out').addEventListener('click', () => {
  void (async () => {
    await ask({ type: 'logout' });
    await render();
  })();
});

void render();
