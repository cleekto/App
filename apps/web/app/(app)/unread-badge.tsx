'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Значок непрочитанного в боковой панели.
 *
 * ПОЧЕМУ КЛИЕНТСКИЙ. Оболочка приложения — серверная и между переходами
 * не перерисовывается: посчитанное при загрузке число застывало бы до
 * следующей полной перезагрузки. Проверено на живой сборке: открыл комнату,
 * вернулся в объекты — значок остался прежним.
 *
 * Обновляется по трём поводам: раз в пятнадцать секунд, при смене страницы
 * (открыл комнату — значок обязан погаснуть сразу) и при возвращении
 * на вкладку. Пока вкладка свёрнута, запросов нет.
 *
 * С ЧИСЛОМ, А НЕ ПРОСТО ТОЧКОЙ: «есть что-то новое» и «двадцать три новых» —
 * разные новости, и вторая заставляет открыть сразу.
 */

/** Больше девяноста девяти считать бессмысленно. */
const OVERFLOW = '99+';

export function UnreadBadge({ kind, label }: { kind: 'rooms' | 'direct'; label: string }) {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let stopped = false;

    const pull = async (): Promise<void> => {
      if (document.visibilityState !== 'visible') return;

      try {
        const response = await fetch('/api/v1/chat/unread', { cache: 'no-store' });
        if (stopped || !response.ok) return;

        const data = (await response.json()) as { rooms: number; direct: number };
        setCount(kind === 'rooms' ? data.rooms : data.direct);
      } catch {
        // Сеть моргнула — следующий тик попробует снова. Прятать значок
        // из-за одного неудачного запроса значило бы терять новости.
      }
    };

    void pull();

    const timer = setInterval(() => void pull(), 15_000);
    const onVisible = (): void => void pull();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // `pathname` в зависимостях намеренно: открыл комнату — значок обязан
    // погаснуть сразу, не дожидаясь очередного тика.
  }, [kind, pathname]);

  if (count === 0) return null;

  return (
    <span
      className="ml-auto inline-flex min-w-5 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-danger)] px-1.5 text-[0.6875rem] font-semibold tabular-nums text-white"
      aria-label={label}
    >
      {count > 99 ? OVERFLOW : String(count)}
    </span>
  );
}
