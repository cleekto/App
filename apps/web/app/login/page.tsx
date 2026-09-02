import { redirect } from 'next/navigation';

import { translate } from '@kleekto/i18n';

import { optionalContext } from '../_lib/session';
import { LocaleSwitcher } from '../_ui/locale-switcher';
import { Card } from '../_ui/primitives';
import { Wordmark } from '../_ui/wordmark';
import { serverLocale } from '../locale';
import { LoginForm } from './login-form';

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
          <img src="/brand/mark.png" alt="" className="h-11 w-11 object-contain" />
          <h1 className="text-xl tracking-tight">
            <Wordmark />
          </h1>
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
