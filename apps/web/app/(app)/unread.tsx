'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

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

/**
 * Звуки оповещения.
 *
 * ДВА РАЗНЫХ, потому что это две разные новости. Личное сообщение адресовано
 * тебе и требует ответа; сообщение в отслеживаемой комнате — это разговор,
 * в который можно и не вступать. Один звук на оба случая заставлял бы
 * проверять экран каждый раз.
 */
const SOUNDS = {
  direct: '/sounds/direct-message.wav',
  rooms: '/sounds/room-message.wav',
} as const;

/**
 * Проиграть короткий звук.
 *
 * СОЗДАЁТСЯ КАЖДЫЙ РАЗ ЗАНОВО, а не переиспользуется один объект: два
 * сообщения подряд с общим объектом дали бы один звук вместо двух —
 * второй `play()` на ещё играющем звуке ничего не делает.
 *
 * ОТКАЗ ГЛОТАЕТСЯ НАМЕРЕННО, и это единственное место, где так можно.
 * Браузер запрещает звук, пока человек ничего не нажал на странице, и это
 * не поломка: он вернёт отказ на первом же оповещении после загрузки,
 * а дальше начнёт играть. Показывать из-за этого ошибку значило бы пугать
 * человека тем, чего он не делал и что само пройдёт.
 */
function play(url: string): void {
  try {
    const sound = new Audio(url);
    sound.volume = 0.5;
    void sound.play().catch(() => undefined);
  } catch {
    // Браузер без Audio. Значки при этом работают — звук здесь дополнение,
    // а не единственный способ узнать о сообщении.
  }
}

export function UnreadProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [unread, setUnread] = useState<Unread>(EMPTY);

  /*
   * Прошлые числа — чтобы услышать РОСТ, а не наличие.
   *
   * `null` до первого ответа: иначе человек, открывший приложение с тремя
   * непрочитанными, получал бы звук на пустом месте — ему ничего не пришло,
   * он просто пришёл сам.
   */
  const previous = useRef<{ rooms: number; direct: number } | null>(null);

  useEffect(() => {
    let stopped = false;

    const pull = async (): Promise<void> => {
      if (document.visibilityState !== 'visible') return;

      try {
        const response = await fetch('/api/v1/chat/unread', { cache: 'no-store' });
        if (stopped || !response.ok) return;

        const next = (await response.json()) as Unread;
        const before = previous.current;

        /*
         * Звук — только на прибавку. Уменьшение означает, что человек
         * прочитал, и звучать тут нечему.
         *
         * Комнаты сервер уже отфильтровал: в этих числах есть только те,
         * за которыми человек следит. Проверять подписку ещё и здесь
         * значило бы держать одно правило в двух местах.
         */
        if (before !== null) {
          if (next.direct > before.direct) play(SOUNDS.direct);
          else if (next.rooms > before.rooms) play(SOUNDS.rooms);
        }

        previous.current = { rooms: next.rooms, direct: next.direct };
        setUnread(next);
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
