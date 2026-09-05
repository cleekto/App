import { BrandLockup } from '../_ui/wordmark';

/**
 * Левая половина страницы входа: что это за продукт.
 *
 * ЗАЧЕМ ОНА ВООБЩЕ. Вход — единственный экран, который человек видит
 * до того, как стал пользователем: на нём складывается первое впечатление
 * о продукте, и белая форма посреди пустого поля не говорит о нём ничего.
 *
 * ЧЕГО ЗДЕСЬ НЕТ НАМЕРЕННО (§15 задания): фотографий квартир, стоковых
 * снимков, объёмных домиков и неоновых свечений. Только геометрия того же
 * знака, тонкие линии и слепок интерфейса — то, что продукт и есть.
 *
 * И это не рекламная страница: заголовок в две строки, пояснение в одну.
 */

/** Стрелка между звеньями цепочки. Литералы в разметке запрещены линтером. */
const ARROW = '→';

export function BrandSide({
  labels,
}: {
  labels: {
    headline: string;
    supporting: string;
    chain: [string, string, string];
    preview: {
      deals: string;
      leads: string;
      pipeline: string;
      activity: string;
      events: [string, string, string];
    };
  };
}) {
  // Цвета цепочки по смыслу из задания: объект — фирменный, клиент — синий,
  // сделка — бирюзовый. Та же семантика, что и во всём продукте.
  const chainColors = ['var(--color-brand)', '#2563ff', '#0c836f'] as const;

  return (
    <div className="flex flex-col justify-center gap-8">
      <h1 className="text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl lg:text-[3.25rem] lg:leading-[1.08]">
        {labels.headline}
      </h1>

      <p className="max-w-lg text-base leading-relaxed text-[var(--color-text-secondary)] sm:text-lg">
        {labels.supporting}
      </p>

      {/* Объект → Клиент → Сделка: путь, который продукт и проходит. */}
      <ul className="flex flex-wrap items-center gap-2">
        {labels.chain.map((step, index) => (
          <li key={step} className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] px-3 py-1.5 text-sm font-medium"
              style={{
                color: chainColors[index],
                backgroundColor: `color-mix(in oklch, ${chainColors[index] ?? ''} 12%, transparent)`,
              }}
            >
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{ backgroundColor: chainColors[index] }}
              />
              {step}
            </span>
            {index < labels.chain.length - 1 ? (
              <span aria-hidden className="text-[var(--color-text-tertiary)]">
                {ARROW}
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      <ProductPreview labels={labels.preview} />
    </div>
  );
}

/**
 * Слепок интерфейса — не рабочая сводка, а её изображение.
 *
 * Показывает, что внутри продукта, не притворяясь им: числа здесь
 * декоративные, и потому они не подписаны как чьи-то. Настоящих данных
 * на странице входа быть не может — человек ещё не вошёл.
 */
function ProductPreview({
  labels,
}: {
  labels: {
    deals: string;
    leads: string;
    pipeline: string;
    activity: string;
    events: [string, string, string];
  };
}) {
  const dotColors = ['var(--color-brand)', '#2563ff', '#0c836f'] as const;

  return (
    <div
      aria-hidden
      className="max-w-md rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-4 shadow-[var(--shadow-card)] backdrop-blur-sm"
    >
      <div className="flex items-center gap-2 pb-3">
        <BrandLockup className="text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { value: '128', label: labels.deals },
          { value: '356', label: labels.leads },
        ].map((tile) => (
          <div
            key={tile.label}
            className="rounded-[var(--radius-card)] bg-[var(--color-surface-muted)] px-3 py-2.5"
          >
            <p className="text-xl font-semibold tabular-nums">{tile.value}</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">{tile.label}</p>
          </div>
        ))}
      </div>

      <p className="pt-4 pb-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
        {labels.pipeline}
      </p>
      <div className="flex h-2 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--color-surface-muted)]">
        <span className="w-[46%] bg-[var(--color-brand)]" />
        <span className="w-[28%] bg-[#2563ff]" />
        <span className="w-[14%] bg-[#0c836f]" />
      </div>

      <p className="pt-4 pb-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
        {labels.activity}
      </p>
      <ul className="flex flex-col gap-1.5">
        {labels.events.map((event, index) => (
          <li key={event} className="flex items-center gap-2 text-xs">
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: dotColors[index] }}
            />
            <span className="truncate text-[var(--color-text-secondary)]">{event}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
