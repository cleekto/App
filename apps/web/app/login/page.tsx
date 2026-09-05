import { redirect } from 'next/navigation';

import { translate } from '@kleekto/i18n';

import { optionalContext } from '../_lib/session';
import { LocaleSwitcher } from '../_ui/locale-switcher';
import { BrandLockup } from '../_ui/wordmark';
import { serverLocale } from '../locale';
import { BrandSide } from './brand-side';
import { LoginForm } from './login-form';

/**
 * Вход. Единственная страница вне оболочки приложения.
 *
 * ДВЕ КОЛОНКИ НА ШИРОКОМ ЭКРАНЕ: слева продукт, справа форма. Раньше форма
 * стояла посреди пустого поля, и человек, впервые открывший kleekTo, не
 * узнавал о нём ничего. Вход — единственный экран, который видят до того,
 * как стали пользователем.
 *
 * На узком экране колонки складываются в одну, и форма идёт первой после
 * короткого представления: пришедший работать не должен пролистывать
 * рекламу до поля ввода.
 *
 * Язык берётся из cookie, а не из профиля: профиля ещё нет, а прочитать
 * форму на своём языке человек должен до того, как войдёт. Переключатель
 * поэтому стоит прямо на странице, в шапке.
 */
export default async function LoginPage() {
  const ctx = await optionalContext();
  if (ctx !== null) redirect('/properties');

  const locale = await serverLocale();
  const t = (key: Parameters<typeof translate>[1]): string => translate(locale, key);

  return (
    <main className="relative flex min-h-screen flex-col">
      {/*
        Фон — большие мягкие пятна фирменного и синего (§9 задания). Он даёт
        ощущение энергии, а белая карточка входа — ощущение порядка. Ничего
        движущегося: этот урок уже пройден.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(circle at 15% 20%, oklch(0.62 0.24 300 / 0.18), transparent 38%),' +
            'radial-gradient(circle at 82% 78%, oklch(0.55 0.22 265 / 0.14), transparent 38%),' +
            'radial-gradient(circle at 92% 12%, oklch(0.7 0.2 350 / 0.08), transparent 32%)',
        }}
      />

      <header className="flex items-center justify-between gap-4 px-6 py-5 lg:px-10">
        <BrandLockup className="text-xl" />
        <LocaleSwitcher current={locale} persist={false} ariaLabel={t('settings.language')} />
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-6 py-8 lg:grid-cols-[1.1fr_minmax(0,27.5rem)] lg:gap-16 lg:px-10 lg:py-12">
        {/* На телефоне представление идёт после формы: `order` меняет
            порядок показа, не трогая порядок чтения для читалки. */}
        <div className="order-2 lg:order-1">
          <BrandSide
            labels={{
              headline: t('app.headline'),
              supporting: t('app.supporting'),
              chain: [t('app.chainProperty'), t('app.chainClient'), t('app.chainDeal')],
              preview: {
                deals: t('app.previewDeals'),
                leads: t('app.previewLeads'),
                pipeline: t('app.previewPipeline'),
                activity: t('app.previewActivity'),
                events: [
                  t('app.previewNewProperty'),
                  t('app.previewOwnerCalled'),
                  t('app.previewPublished'),
                ],
              },
            }}
          />
        </div>

        {/*
          Карточка входа: белая, с настоящей границей и мягкой тенью.
          Задание прямо запрещает здесь тяжёлое стекло и сильное размытие —
          форма должна читаться как надёжная, а не как полупрозрачная.
        */}
        <div className="order-1 w-full lg:order-2 lg:justify-self-end">
          <div className="rounded-[var(--radius-floating)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-raised)] sm:p-7">
            <h2 className="text-xl font-bold tracking-tight">{t('app.welcomeBack')}</h2>
            <p className="mt-1 mb-6 text-sm text-[var(--color-text-secondary)]">
              {t('app.welcomeHint')}
            </p>

            <LoginForm
              labels={{
                email: t('auth.email'),
                password: t('auth.password'),
                submit: t('auth.signIn'),
                failed: t('auth.failed'),
                busy: t('common.loading'),
                showPassword: t('common.showPassword'),
                hidePassword: t('common.hidePassword'),
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
