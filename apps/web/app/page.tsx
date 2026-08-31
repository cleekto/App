import { API_BASE_PATH } from '@cleekto/contracts';
import { LOCALES, translate } from '@cleekto/i18n';

import { serverLocale } from './locale';

/**
 * Страница фазы 2. Не макет интерфейса — он проектируется в DESIGN.md
 * и собирается в фазе 7. Здесь проверяется, что фундамент собран:
 * словари подключены, токены применяются, health-эндпоинт на месте.
 *
 * Ни одной строки текста в разметке — всё через словарь. Захардкоженный
 * литерал в JSX роняет линтер (правило 18, ADR-0008).
 */
export default function HomePage() {
  const locale = serverLocale();

  // Маршрут, а не текст интерфейса: переводу не подлежит и в словаре ему
  // не место. Вынесен из разметки, чтобы правило «никаких строк в JSX»
  // осталось строгим и не пришлось заводить исключений.
  const healthPath = `${API_BASE_PATH}/health`;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{translate(locale, 'app.name')}</h1>
        <p className="text-[var(--color-text-secondary)]">{translate(locale, 'app.tagline')}</p>
      </header>

      <section
        className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
        aria-labelledby="locales-heading"
      >
        <h2 id="locales-heading" className="sr-only">
          {translate(locale, 'app.tagline')}
        </h2>

        {/* Три языка рядом: видно и покрытие словарей, и то, как ведёт себя
            вёрстка при разной длине строк. Непереведённое видно как ⟦ключ⟧. */}
        <dl className="grid gap-3">
          {LOCALES.map((code) => (
            <div key={code} className="flex items-baseline gap-3">
              <dt className="w-8 shrink-0 font-mono text-xs text-[var(--color-text-secondary)]">
                {code}
              </dt>
              <dd className="text-sm">{translate(code, 'app.tagline')}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="text-sm text-[var(--color-text-secondary)]">
        <a
          className="underline decoration-[var(--color-border)] underline-offset-4 hover:decoration-[var(--color-brand-primary)]"
          href={healthPath}
        >
          {healthPath}
        </a>
      </footer>
    </main>
  );
}
