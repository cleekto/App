'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Непрочитанное: одна выборка на всю оболочку.
 *
 * ПОЧЕМУ КЛИЕНТСКОЕ. Оболочка приложения серверная и между переходами
 * не перерисовывается: посчитанное при загрузке число застывало бы до
 * следующей полной перезагрузки. Проверено на живой сборке — открыл комнату,
 * вернулся в объекты, а значок прежний.
 *
 * ПОЧЕМУ ОДИН ЗАПРОС НА ВСЕХ. Значков стало четыре — «чат», «сообщения»,
 * точка на бургере и точки на карточках комнат, — и каждый со своим опросом
 * означал бы четыре одинаковых запроса каждые пятнадцать секунд. Считает
 * их всё равно один и тот же ответ сервера.
 *
 * Обновляется по трём поводам: раз в пятнадцать секунд, при смене страницы
 * (открыл комнату — значок обязан погаснуть сразу) и при возвращении
 * на вкладку. Пока вкладка свёрнута, запросов нет.
 */

interface Unread {
  rooms: number;
  direct: number;
  /** Сколько непрочитанного в каждой комнате. Пусто — прочитано всё. */
  byRoom: Record<string, number>;
}

const EMPTY: Unread = { rooms: 0, direct: 0, byRoom: {} };

const UnreadContext = createContext<Unread>(EMPTY);

/** Больше девяноста девяти считать бессмысленно. */
const OVERFLOW = '99+';

export function UnreadProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [unread, setUnread] = useState<Unread>(EMPTY);

  useEffect(() => {
    let stopped = false;

    const pull = async (): Promise<void> => {
      if (document.visibilityState !== 'visible') return;

      try {
        const response = await fetch('/api/v1/chat/unread', { cache: 'no-store' });
        if (stopped || !response.ok) return;

        setUnread((await response.json()) as Unread);
      } catch {
        // Сеть моргнула — следующий тик попробует снова. Гасить значки
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
  }, [pathname]);

  return <UnreadContext.Provider value={unread}>{children}</UnreadContext.Provider>;
}

/**
 * Значок с числом — в боковой панели.
 *
 * С ЧИСЛОМ, А НЕ ПРОСТО ТОЧКОЙ: «есть что-то новое» и «двадцать три новых» —
 * разные новости, и вторая заставляет открыть сразу.
 */
export function UnreadBadge({ kind, label }: { kind: 'rooms' | 'direct'; label: string }) {
  const unread = useContext(UnreadContext);
  const count = kind === 'rooms' ? unread.rooms : unread.direct;

  if (count === 0) return null;

  return (
    <span
      className="ml-auto inline-flex min-w-5 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-danger)] px-1.5 text-[0.6875rem] font-semibold text-white tabular-nums"
      aria-label={label}
    >
      {count > 99 ? OVERFLOW : String(count)}
    </span>
  );
}

/**
 * Точка на кнопке меню — только для телефона.
 *
 * На узком экране боковая панель спрятана, и значки в ней не видны вовсе:
 * новое сообщение приходило беззвучно и незаметно, пока человек сам
 * не открывал меню. Точка на бургере — единственное место, где о нём
 * можно сказать, не разворачивая панель.
 *
 * БЕЗ ЧИСЛА, в отличие от панели: кнопка размером в палец, и двузначное
 * число на ней не читается. Здесь достаточно «есть новое» — сколько
 * и где, видно сразу после открытия.
 */
export function UnreadDot({ label }: { label: string }) {
  const unread = useContext(UnreadContext);
  if (unread.rooms + unread.direct === 0) return null;

  return (
    <span
      role="status"
      aria-label={label}
      className="absolute top-1 right-1 size-2.5 rounded-full bg-[var(--color-danger)] ring-2 ring-[var(--color-surface)]"
    />
  );
}

/** Непрочитанное в одной комнате — числом, рядом с её названием. */
export function RoomUnread({ roomId, label }: { roomId: string; label: string }) {
  const unread = useContext(UnreadContext);
  const count = unread.byRoom[roomId] ?? 0;

  if (count === 0) return null;

  return (
    <span
      className="ml-auto inline-flex min-w-5 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-danger)] px-1.5 text-[0.6875rem] font-semibold text-white tabular-nums"
      aria-label={label}
    >
      {count > 99 ? OVERFLOW : String(count)}
    </span>
  );
}
