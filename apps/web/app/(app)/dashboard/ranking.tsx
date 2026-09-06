import { Avatar, accentOf } from '../../_ui/accent';

/**
 * Рейтинг: кто на каком месте.
 *
 * МЕСТО ЧИТАЕТСЯ ПЕРВЫМ, а не выводится из порядка строк. Список можно
 * пролистать глазами и не понять, третий ты или четвёртый; число слева
 * отвечает на этот вопрос сразу, а именно за ним сюда и приходят.
 *
 * СВОЯ СТРОКА ВЫДЕЛЕНА. В списке из пятнадцати человек искать себя по имени
 * — работа, которой можно не быть; а искать приходится каждый раз, потому
 * что место меняется.
 *
 * ПОЛОСА ВМЕСТО ВТОРОГО ЧИСЛА. Разрыв между первым и вторым важнее, чем
 * сами величины: «у меня четыре, у лидера пять» и «у меня четыре, у лидера
 * двадцать» — разные новости, и колонка чисел этого не показывает.
 *
 * Строк здесь нет — всё приходит из словаря (правило 18).
 */

export interface RankItem {
  id: string;
  name: string;
  place: number;
  closedDeals: number;
  closedAmount: string;
  propertiesInBase: string;
  isMine: boolean;
}

/** Медаль для первых трёх, обычное число дальше. */
const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function Ranking({
  items,
  labels,
}: {
  items: RankItem[];
  labels: { deals: string; amount: string; inBase: string; empty: string };
}) {
  if (items.length === 0) {
    return <p className="text-[0.8125rem] text-[var(--color-text-secondary)]">{labels.empty}</p>;
  }

  // Лучший результат задаёт длину полос. Ноль у всех — полос нет вовсе,
  // и делить на ноль не приходится.
  const best = Math.max(...items.map((item) => item.closedDeals), 1);

  return (
    <ul className="divide-y divide-[var(--color-border)]">
      {items.map((item) => {
        const share = item.closedDeals / best;
        const color = accentOf(item.name).fg;

        return (
          <li
            key={item.id}
            className={`flex items-center gap-3 px-4 py-3 ${
              item.isMine ? 'bg-[var(--color-brand-soft)]/50' : ''
            }`}
          >
            <span className="w-8 shrink-0 text-center text-sm font-semibold tabular-nums">
              {MEDALS[item.place] ?? item.place}
            </span>

            <Avatar name={item.name} size="sm" />

            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm ${item.isMine ? 'font-semibold' : 'font-medium'}`}>
                {item.name}
              </p>

              {/* Полоса длиной по доле от лучшего результата. */}
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                <div
                  className="h-full rounded-full transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-out)]"
                  style={{ width: `${String(Math.round(share * 100))}%`, backgroundColor: color }}
                />
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold tabular-nums">{item.closedDeals}</p>
              <p className="text-[0.6875rem] text-[var(--color-text-tertiary)]">{labels.deals}</p>
            </div>

            <div className="hidden w-28 shrink-0 text-right sm:block">
              <p className="text-sm font-medium tabular-nums">{item.closedAmount}</p>
              <p className="text-[0.6875rem] text-[var(--color-text-tertiary)]">{labels.amount}</p>
            </div>

            <div className="hidden w-20 shrink-0 text-right sm:block">
              <p className="text-sm font-medium tabular-nums">{item.propertiesInBase}</p>
              <p className="text-[0.6875rem] text-[var(--color-text-tertiary)]">{labels.inBase}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
