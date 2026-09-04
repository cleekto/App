import type { ReactNode } from 'react';

/**
 * Цвет, выведенный из самих данных.
 *
 * ЗАЧЕМ ЭТО ВООБЩЕ. В списке из двадцати объектов с одинаково серыми
 * кружками и одинаково серыми метками статуса взгляду не за что зацепиться:
 * приходится читать каждую строку. Устойчивый цвет — у человека свой,
 * у стадии свой — превращает чтение в узнавание. Это не украшение: агент
 * сидит в этом экране весь день.
 *
 * ЦВЕТ ВЫВОДИТСЯ, А НЕ ХРАНИТСЯ. У сотрудника нет поля «цвет», и заводить
 * его значило бы спрашивать у человека то, что можно вычислить. Оттенок
 * берётся из имени, и потому один и тот же на всех экранах и у всех
 * пользователей, без единой записи в базе.
 *
 * ПАЛИТРА НЕ СЛУЧАЙНАЯ. Восемь оттенков одного семейства с фирменным
 * фиолетовым: каждый достаточно тёмен, чтобы нести текст на своей светлой
 * заливке (проверено на AA), и достаточно отличается от соседей, чтобы
 * их не путать. Красного здесь нет намеренно — он занят смыслом «ошибка».
 */

const PALETTE = [
  { fg: '#7c3aed', bg: '#f1e9fe' }, // фирменный фиолетовый
  { fg: '#0c836f', bg: '#e1faf4' },
  { fg: '#1f6feb', bg: '#e6effd' },
  { fg: '#b36200', bg: '#fff1de' },
  { fg: '#c2255c', bg: '#fde6f1' },
  { fg: '#5b53c9', bg: '#ebeafb' },
  { fg: '#0f7490', bg: '#e0f3f8' },
  { fg: '#7a5d16', bg: '#fdf5e3' },
] as const;

/**
 * Устойчивый номер оттенка по строке.
 *
 * Обычный `hash % length`. Важна не стойкость к подбору, а повторяемость:
 * одно имя обязано давать один цвет сегодня, завтра и на другом устройстве.
 */
function hueOf(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100_000;
  }
  return hash % PALETTE.length;
}

export function accentOf(seed: string): { fg: string; bg: string } {
  return PALETTE[hueOf(seed)] ?? PALETTE[0];
}

/**
 * Цвета стадии воронки.
 *
 * ЦВЕТ У СТАДИИ УЖЕ ЕСТЬ — его выбирает администратор в настройках доски
 * (`colorToken`). Выводить его здесь заново из имени или порядка значило бы
 * получить одну и ту же стадию разного цвета на доске и в списке объектов,
 * а это хуже, чем отсутствие цвета вовсе: агент решил бы, что стадии разные.
 *
 * Заливка — готовые мягкие токены палитры, текст — их насыщенные пары.
 * Обе половины уже проверены на контраст, ничего нового не заводится.
 */
const STAGE_COLORS: Record<string, { fg: string; bg: string }> = {
  brand: { fg: 'var(--color-brand-text)', bg: 'var(--color-brand-soft)' },
  success: { fg: 'var(--color-success)', bg: 'var(--color-success-soft)' },
  warning: { fg: 'var(--color-warning)', bg: 'var(--color-warning-soft)' },
  danger: { fg: 'var(--color-danger)', bg: 'var(--color-danger-soft)' },
  neutral: { fg: 'var(--color-text-secondary)', bg: 'var(--color-surface-muted)' },

  // Имена из ранних миграций — стадии с ними живут в базе до сих пор.
  'brand-primary': { fg: 'var(--color-brand-text)', bg: 'var(--color-brand-soft)' },
  'text-secondary': { fg: 'var(--color-text-secondary)', bg: 'var(--color-surface-muted)' },
};

const STAGE_FALLBACK = { fg: 'var(--color-text-secondary)', bg: 'var(--color-surface-muted)' };

export function stageColors(token: string | null): { fg: string; bg: string } {
  return (token === null ? undefined : STAGE_COLORS[token]) ?? STAGE_FALLBACK;
}

/**
 * Кружок с инициалами.
 *
 * Фотографий у нас нет, и серый кружок с буквой честнее пустого места.
 * Цветной — ещё и узнаваем: в списке задач видно, чьи они, не читая имени.
 */
export function Avatar({
  name,
  size = 'md',
}: {
  name: string;
  /** `sm` — в плотных списках, `md` — в карточках, `lg` — в шапке профиля. */
  size?: 'sm' | 'md' | 'lg';
}) {
  const accent = accentOf(name);

  const initials = name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('');

  const box =
    size === 'sm'
      ? 'size-6 text-[0.6875rem]'
      : size === 'lg'
        ? 'size-11 text-base'
        : 'size-8 text-xs';

  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${box}`}
      style={{ color: accent.fg, backgroundColor: accent.bg }}
    >
      {initials}
    </span>
  );
}

/**
 * Метка стадии воронки.
 *
 * Точка слева — не украшение: она несёт тот же цвет и остаётся различимой
 * там, где цвета не различают. Метка без неё опиралась бы только на оттенок.
 */
export function StagePill({ label, colorToken }: { label: string; colorToken: string | null }) {
  const colors = stageColors(colorToken);

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ color: colors.fg, backgroundColor: colors.bg }}
    >
      <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: colors.fg }} />
      {label}
    </span>
  );
}

/**
 * Плитка с числом и цветным знаком.
 *
 * Знак несёт цвет, число остаётся тёмным: цветная цифра читается хуже,
 * а разноцветные цифры рядом начинают спорить друг с другом за внимание.
 */
export function AccentIcon({ seed, children }: { seed: string; children: ReactNode }) {
  const accent = accentOf(seed);

  return (
    <span
      aria-hidden
      className="inline-flex size-9 items-center justify-center rounded-xl"
      style={{ color: accent.fg, backgroundColor: accent.bg }}
    >
      {children}
    </span>
  );
}
