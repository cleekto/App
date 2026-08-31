import { isLocale, translate, type Locale } from '@cleekto/i18n';

/**
 * Язык popup на фазе 2.
 *
 * Настоящий выбор языка живёт на пользователе и приедет вместе с входом
 * в фазе 6. До тех пор берём язык браузера, если он один из трёх наших.
 * Расширение обязано быть трёхъязычным наравне с вебом (ADR-0008) — словарь
 * у них общий, `packages/i18n`.
 */
function detectLocale(): Locale {
  const primary = navigator.language.split('-')[0] ?? 'en';
  return isLocale(primary) ? primary : 'en';
}

function fill(id: string, text: string): void {
  const element = document.getElementById(id);
  if (element === null) {
    // Разметка и скрипт расходятся — это дефект сборки, а не состояние,
    // которое надо переживать молча.
    throw new Error(`popup.html: элемент #${id} не найден`);
  }
  element.textContent = text;
}

const locale = detectLocale();

fill('app-name', translate(locale, 'app.name'));
fill('tagline', translate(locale, 'app.tagline'));
fill('state', translate(locale, 'extension.signInPrompt'));
