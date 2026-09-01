import { redirect } from 'next/navigation';

import { translate } from '@cleekto/i18n';

import { contextLocale, optionalContext } from '../_lib/session';
import { LoginForm } from './login-form';

/** Вход. Единственная страница вне оболочки приложения. */
export default async function LoginPage() {
  const ctx = await optionalContext();
  if (ctx !== null) redirect('/properties');

  const locale = contextLocale(null);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-8 px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{translate(locale, 'app.name')}</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {translate(locale, 'app.tagline')}
        </p>
      </header>

      <LoginForm
        labels={{
          email: translate(locale, 'auth.email'),
          password: translate(locale, 'auth.password'),
          submit: translate(locale, 'auth.signIn'),
          failed: translate(locale, 'auth.failed'),
        }}
      />
    </main>
  );
}
