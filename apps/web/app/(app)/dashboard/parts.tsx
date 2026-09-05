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
    <li className="flex items-center gap-3 px-4 py-3 transition-colors duration-[var(--duration-fast)] [@media(hover:hover)and(pointer:fine)]:hover:bg-[var(--color-surface-muted)]">
      <span className="w-40 shrink-0 truncate text-[0.8125rem] font-medium">{name}</span>

      <span className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--color-surface-muted)]">
        <span
          className="absolute inset-y-0 left-0 rounded-[var(--radius-pill)] transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-out)]"
          // Ширина — это данные, а не оформление: классом её не выразить,
          // потому что доля произвольная. Свечение того же цвета под полосой
          // отрывает её от подложки.
          style={{
            width: `${String(Math.round(share * 100))}%`,
            backgroundColor: color,
            boxShadow: `0 0 12px -2px ${color}`,
          }}
        />
      </span>

      {/* Число в таблетке цвета стадии: строка перестаёт заканчиваться
          серой цифрой на белом. */}
      <span
        className="w-12 shrink-0 rounded-[var(--radius-pill)] py-0.5 text-center text-[0.8125rem] font-semibold tabular-nums"
        style={{ color, backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)` }}
      >
        {count}
      </span>
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
      {/* Короткий фирменный штрих слева: заголовок перестаёт быть просто
          жирной строкой и начинает читаться как начало раздела. */}
      <span
        aria-hidden
        className="h-4 w-1 shrink-0 rounded-full bg-[linear-gradient(180deg,var(--color-brand),oklch(0.72_0.2_300))]"
      />
      <h2 className="shrink-0 text-[0.9375rem] leading-6 font-semibold">{title}</h2>
      <span className="h-px min-w-0 flex-1 bg-[var(--color-border)]" />
    </div>
  );
}

/**
 * Плитка главного числа — со знаком и цветом.
 *
 * ПОЧЕМУ ОТДЕЛЬНО ОТ `Metric`. Раньше три главных числа стояли на одной
 * белой поверхности, разделённые волосяной линией: аккуратно, но экран
 * открывался пустым листом, и владелец справедливо заметил, что «живее»
 * от этого не стало. Метрика второго ряда осталась прежней — там
 * сдержанность на месте, чисел много и они мелкие.
 *
 * Цвет несёт ЗНАК, а не цифра. Разноцветные крупные числа рядом начинают
 * спорить за внимание, и читаются они хуже тёмных. Знак же виден боковым
 * зрением и служит меткой: три плитки перестают быть тремя одинаковыми
 * прямоугольниками.
 */
export function StatTile({
  label,
  value,
  icon,
  accent,
  featured = false,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  /** Цвет знака — на обычной плитке. У главной он белый. */
  accent: { fg: string; bg: string };
  /**
   * Главная плитка экрана — залита фирменным градиентом.
   *
   * ТОЛЬКО ОДНА НА СТРАНИЦЕ. Когда цветом залиты все три, ни одна не главная:
   * взгляд мечется между ними, и экран начинает выглядеть нарядно вместо
   * того, чтобы отвечать на вопрос. Остальные держат цвет в знаке.
   */
  featured?: boolean;
}) {
  if (featured) {
    return (
      <div className="group relative flex min-w-0 flex-col justify-between gap-6 overflow-hidden rounded-[var(--radius-panel)] bg-[image:var(--gradient-primary)] bg-[length:160%_100%] bg-[position:0%_0%] p-5 text-white shadow-[var(--shadow-card)] transition-[background-position,transform,box-shadow] duration-[var(--duration-slow)] ease-[var(--ease-out)] [@media(hover:hover)and(pointer:fine)]:hover:-translate-y-0.5 [@media(hover:hover)and(pointer:fine)]:hover:bg-[position:100%_0%] [@media(hover:hover)and(pointer:fine)]:hover:shadow-[var(--shadow-hover)]">
        {/* Тонкая световая плёнка по диагонали: заливка перестаёт выглядеть
            куском цветной бумаги и становится поверхностью под светом. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,oklch(1_0_0_/_0.18),transparent_45%)]"
        />

        <span
          aria-hidden
          className="relative inline-flex size-10 items-center justify-center rounded-[var(--radius-control)] bg-[oklch(1_0_0_/_0.18)] shadow-[inset_0_0_0_1px_oklch(1_0_0_/_0.26)]"
        >
          <TileIcon>{icon}</TileIcon>
        </span>

        <div className="relative min-w-0">
          <p className="truncate text-[0.8125rem] leading-5 text-white/80">{label}</p>
          <p className="mt-1 text-[2.5rem] leading-11 font-semibold tracking-tight tabular-nums">
            {value}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex min-w-0 flex-col justify-between gap-6 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)] transition-[transform,box-shadow,border-color] duration-[var(--duration-base)] ease-[var(--ease-out)] [@media(hover:hover)and(pointer:fine)]:hover:-translate-y-0.5 [@media(hover:hover)and(pointer:fine)]:hover:border-[var(--color-border-strong)] [@media(hover:hover)and(pointer:fine)]:hover:shadow-[var(--shadow-hover)]">
      <span
        aria-hidden
        className="inline-flex size-10 items-center justify-center rounded-[var(--radius-control)]"
        style={{ color: accent.fg, backgroundColor: accent.bg }}
      >
        <TileIcon>{icon}</TileIcon>
      </span>

      <div className="min-w-0">
        <p className="truncate text-[0.8125rem] leading-5 text-[var(--color-text-secondary)]">
          {label}
        </p>
        <p className="mt-1 text-[2.5rem] leading-11 font-semibold tracking-tight tabular-nums">
          {value}
        </p>
      </div>
    </div>
  );
}

/** Оболочка знака: одна толщина штриха на все плитки. */
function TileIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      {children}
    </svg>
  );
}

/** Знак процента отдельной строкой: литералы в разметке запрещены линтером. */
const PERCENT_SIGN = '%';

/**
 * Полоса распределения — вся воронка одной строкой.
 *
 * Читается раньше, чем список: пропорции видны целиком, без сравнения цифр
 * между собой. Ниже те же стадии повторены строками с числами — полоса
 * показывает «сколько чего», строки отвечают «сколько именно».
 *
 * Доли меньше процента всё равно получают видимую ширину: иначе стадия
 * с одним объектом исчезает с экрана, и воронка врёт, что её нет.
 */
export function DistributionBar({
  parts,
}: {
  parts: Array<{ id: string; label: string; value: number; color: string }>;
}) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  if (total === 0) return null;

  return (
    <div
      className="flex h-3 w-full overflow-hidden rounded-full"
      role="img"
      aria-label={parts.map((part) => `${part.label}: ${String(part.value)}`).join(', ')}
    >
      {parts
        .filter((part) => part.value > 0)
        .map((part) => (
          <span
            key={part.id}
            title={`${part.label}: ${String(part.value)}`}
            style={{
              backgroundColor: part.color,
              width: `${String(Math.max((part.value / total) * 100, 1.5))}%`,
            }}
          />
        ))}
    </div>
  );
}

/**
 * Кольцо с долей в середине.
 *
 * Доля — это часть от целого, и кольцо показывает именно это: тот же процент
 * числом требует помнить, много восемьдесят или мало. Рисуется штрихом
 * по окружности, без библиотеки: одна дуга не стоит зависимости.
 */
export function DonutStat({
  label,
  share,
  caption,
  color,
}: {
  label: string;
  /** Доля от 0 до 1. */
  share: number;
  caption: string;
  color: string;
}) {
  const safe = Math.max(0, Math.min(1, share));
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const percentLabel = `${String(Math.round(safe * 100))}${PERCENT_SIGN}`;

  return (
    <div className="flex items-center gap-4 rounded-[var(--radius-card)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
      <svg
        viewBox="0 0 80 80"
        className="size-20 shrink-0 -rotate-90"
        role="img"
        aria-label={label}
      >
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="var(--color-surface-muted)"
          strokeWidth="8"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${String(circumference * safe)} ${String(circumference)}`}
        />
        {/* Число внутри кольца, а не под ним: глазу не приходится
            переводить взгляд, чтобы связать дугу со значением. */}
        <text
          x="40"
          y="40"
          textAnchor="middle"
          dominantBaseline="central"
          transform="rotate(90 40 40)"
          className="fill-[var(--color-text-primary)] text-[1rem] font-semibold tabular-nums"
        >
          {percentLabel}
        </text>
      </svg>

      <div className="min-w-0">
        <p className="text-[0.9375rem] leading-5 font-medium">{label}</p>
        <p className="mt-1 text-[0.8125rem] leading-5 text-[var(--color-text-secondary)]">
          {caption}
        </p>
      </div>
    </div>
  );
}

/**
 * Строка рейтинга человека: кружок, имя, полоса, число.
 *
 * Полоса длиннее у того, кто сделал больше, — сравнение становится
 * мгновенным. Таблица из двух колонок цифр требовала читать её целиком,
 * чтобы понять, кто впереди.
 */
export function PersonRow({
  avatar,
  name,
  value,
  share,
  color,
  secondary,
}: {
  avatar: ReactNode;
  name: string;
  value: string;
  /** Доля от лучшего результата, 0…1. */
  share: number;
  color: string;
  secondary: string;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      {avatar}

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-[0.875rem] font-medium">{name}</span>
          <span className="shrink-0 text-[0.8125rem] tabular-nums">
            <span className="font-semibold">{value}</span>
            <span className="ml-2 text-[var(--color-text-tertiary)]">{secondary}</span>
          </span>
        </div>

        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
          <span
            className="block h-full rounded-full"
            style={{
              backgroundColor: color,
              width: `${String(Math.max(share * 100, 2))}%`,
            }}
          />
        </div>
      </div>
    </li>
  );
}
