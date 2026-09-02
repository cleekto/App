import { redirect } from 'next/navigation';

import { translate } from '@kleekto/i18n';

import { optionalContext } from '../_lib/session';
import { LocaleSwitcher } from '../_ui/locale-switcher';
import { Card } from '../_ui/primitives';
import { serverLocale } from '../locale';
import { LoginForm } from './login-form';

/**
 * Буква фирменного знака.
 *
 * Вынесена из разметки намеренно: правило `jsx-no-literals` ловит строки
 * в JSX, потому что пользовательский текст обязан приходить из словаря
 * (правило 18). Знак — не текст: он одинаков на всех трёх языках и
 * переводу не подлежит. Константа делает это различие видимым.
 */
const BRAND_MARK = 'C';

/**
 * Вход. Единственная страница вне оболочки приложения.
 *
 * Язык здесь берётся из cookie, а не из профиля: профиля ещё нет, а прочитать
 * форму на своём языке человек должен до того, как войдёт. Переключатель
 * поэтому стоит прямо на странице.
 */
export default async function LoginPage() {
  const ctx = await optionalContext();
  if (ctx !== null) redirect('/properties');

  const locale = await serverLocale();
  const t = (key: Parameters<typeof translate>[1]): string => translate(locale, key);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          {/*
            Знак вместо логотипа: фирменный знак владельцем не утверждён,
            а пустое место на странице входа выглядит недоделанным. Квадрат
            с буквой честно занимает место будущего знака и не притворяется
            готовым брендом.
          */}
          <span
            aria-hidden
            className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-brand)] text-lg font-semibold text-white"
          >
            {BRAND_MARK}
          </span>
          <h1 className="text-xl font-semibold tracking-tight">{t('app.name')}</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">{t('app.tagline')}</p>
        </div>

        <Card className="p-6">
          <LoginForm
            labels={{
              email: t('auth.email'),
              password: t('auth.password'),
              submit: t('auth.signIn'),
              failed: t('auth.failed'),
              busy: t('common.loading'),
            }}
          />
        </Card>
      </div>

      <LocaleSwitcher current={locale} persist={false} ariaLabel={t('settings.language')} />
    </main>
  );
}
