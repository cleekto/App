import type { ReactNode } from 'react';

/**
 * Части сводки: метрика и полоса воронки.
 *
 * ПОЧЕМУ ОНИ ЗДЕСЬ, А НЕ В `_ui/primitives`. Примитивы — это кнопка, поле,
 * карточка: то, что встречается на каждом экране. Метрика и воронка нужны
 * одной странице, и вынесенные в общий набор они начали бы обрастать
 * пропсами под чужие случаи.
 *
 * Строк здесь нет — всё приходит пропсами из словаря (правило 18).
 */

/**
 * Метрика: подпись сверху, число крупно.
 *
 * ЧИСЛО — ГЛАВНОЕ. Пока подпись и значение были одного веса, три плитки
 * с «21» читались как три одинаковых прямоугольника, и понять, что из них
 * важнее, было нельзя. Подпись говорит, что мерили, но взгляд должен
 * останавливаться на цифре.
 */
export function Metric({
  label,
  value,
  hint,
  size = 'md',
}: {
  label: string;
  value: string;
  hint?: string;
  /** `lg` — для главных чисел страницы, `md` — для второстепенных. */
  size?: 'md' | 'lg';
}) {
  return (
    <div className="flex min-w-0 flex-col px-4 py-3.5">
      <p className="truncate text-[0.8125rem] leading-5 text-[var(--color-text-secondary)]">
        {label}
      </p>
      <p
        className={`mt-1 font-semibold tracking-tight ${
          size === 'lg' ? 'text-[2rem] leading-9' : 'text-[1.375rem] leading-7'
        }`}
      >
        {value}
      </p>
      {hint === undefined ? null : (
        <p className="mt-2 text-[0.75rem] leading-4 text-[var(--color-text-tertiary)]">{hint}</p>
      )}
    </div>
  );
}

/**
 * Несколько метрик на ОДНОЙ поверхности, разделённых волосяной линией.
 *
 * Отдельная карточка на каждое число превращала экран в решётку из коробок
 * — ровно тот «дешёвый админ-шаблон», которого велит избегать DESIGN §3.
 * Одна поверхность с внутренними разделителями говорит то же самое
 * и не рябит.
 */
export function MetricGroup({ children, columns }: { children: ReactNode; columns: 2 | 3 }) {
  return (
    <div
      className={`grid overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] divide-y divide-[var(--color-border)] ${
        columns === 3
          ? 'sm:grid-cols-3 sm:divide-x sm:divide-y-0'
          : 'sm:grid-cols-2 sm:divide-x sm:divide-y-0'
      }`}
    >
      {children}
    </div>
  );
}

/**
 * Строка воронки: название, доля полосой, число.
 *
 * ВОРОНКА ДОЛЖНА ЧИТАТЬСЯ КАК ВОРОНКА. Пять одинаковых строк со счётчиками
 * справа — это список, а не воронка: по нему не видно, где затор. Полоса
 * показывает долю от самой большой стадии, и перекос виден до того, как
 * человек прочитал хоть одну цифру.
 *
 * Доля считается на сервере и приходит готовым числом: `Intl` внутри
 * клиентского компонента дал бы разный текст на сервере и в браузере
 * (ADR-0008).
 */
export function FunnelRow({
  name,
  count,
  share,
  color,
}: {
  name: string;
  count: string;
  /** Доля от самой заполненной стадии, 0…1. */
  share: number;
  color: string;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span className="w-40 shrink-0 truncate text-[0.8125rem]">{name}</span>

      <span className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--color-surface-muted)]">
        <span
          className="absolute inset-y-0 left-0 rounded-[var(--radius-pill)] transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-out)]"
          // Ширина — это данные, а не оформление: классом её не выразить,
          // потому что доля произвольная.
          style={{ width: `${String(Math.round(share * 100))}%`, backgroundColor: color }}
        />
      </span>

      <span className="w-10 shrink-0 text-right text-[0.8125rem] font-medium">{count}</span>
    </li>
  );
}

/**
 * Заголовок раздела сводки.
 *
 * Волосяная линия под заголовком делает то, чего не делали отступы:
 * показывает, где кончается один раздел и начинается другой. Без неё
 * страница читалась как один длинный список.
 */
export function Rule({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="shrink-0 text-[0.9375rem] leading-6 font-semibold">{title}</h2>
      <span className="h-px min-w-0 flex-1 bg-[var(--color-border)]" />
    </div>
  );
}
