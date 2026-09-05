'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, Input } from '../../_ui/primitives';
import { notifyError } from '../../_ui/toast';
import { ColumnMenu, columnColor, type ColumnMenuLabels } from './column-menu';

/**
 * Строки, УЖЕ СОБРАННЫЕ НА СЕРВЕРЕ.
 *
 * Собирать их здесь нельзя: внутри `Intl`, а браузер может не иметь данных
 * нужной локали. Chrome на машине владельца для `ka-GE` молча подставляет
 * русский формат, тогда как Node с полным ICU даёт грузинский. Разный текст
 * на сервере и на клиенте — ошибка гидратации и, что хуже, русские даты
 * и валюта у грузинского агента (ADR-0008).
 *
 * Найдено ручным проходом; тесты этого не видели и не могли — они идут
 * в Node, где ICU полный. Запрет закреплён в `tests/foundation.test.ts`.
 */
interface CardLines {
  price: string;
  kind: string;
  facts: string;
  place: string;
}

interface Card extends CardLines {
  id: string;
  pipelineStatusId: string;
}

interface Column {
  id: string;
  /** Имя на языке смотрящего — уже выбранное на сервере. */
  name: string;
  /** Запасное имя: подставляется в форме правки как подсказка. */
  fallbackName: string;
  names: { ka: string | null; en: string | null; ru: string | null };
  colorToken: string | null;
  isSystem: boolean;
}

export interface BoardLabels extends ColumnMenuLabels {
  empty: string;
  addStage: string;
  stageName: string;
  manage: string;
  /** Сервер отказал в переносе карточки — например, объект чужой команды. */
  moveFailed: string;
  /** Сервер отказал в перестановке колонок. */
  orderFailed: string;
}

/**
 * Что именно тащат сейчас.
 *
 * Доска понимает два перетаскивания — карточки между колонками и колонки
 * между собой, — и на обоих стоит один и тот же нативный drag & drop.
 * Без явного вида перетаскиваемого колонка, брошенная на колонку, читалась
 * бы как карточка, брошенная на колонку.
 */
type Dragging = { kind: 'card'; id: string } | { kind: 'column'; id: string } | null;

/**
 * Значок кнопки настройки стадии.
 *
 * Константой, а не литералом в разметке: правило запрещает строки в JSX,
 * потому что строка в разметке — это непереведённая строка. Здесь строки нет,
 * есть знак, и подпись к нему приходит из словаря отдельно.
 */
const MENU_GLYPH = '⋯';

/**
 * Доска воронки — DESIGN §16–17.
 *
 * Перетаскивание на нативном HTML5 drag & drop, без библиотеки: перенос
 * карточки между колонками — ровно то, для чего он предназначен,
 * а зависимость ради этого пришлось бы обосновывать.
 *
 * Карточка переезжает в новую колонку сразу, до ответа сервера: агент тащил
 * её мышью и ждать подтверждения не должен. Если сервер откажет,
 * `router.refresh()` вернёт правду.
 */
export function Board({
  columns,
  items,
  labels,
  canManage,
}: {
  columns: Column[];
  items: Card[];
  labels: BoardLabels;
  /**
   * Настройка воронки — право руководителя (админ и менеджер). Агент доску
   * читает и двигает по ней свои объекты, но состав стадий не меняет.
   *
   * Правило 6: это только показ. Запрещает сервер.
   */
  canManage: boolean;
}) {
  const router = useRouter();
  const [cards, setCards] = useState(items);
  const [order, setOrder] = useState(columns);
  const [dragging, setDragging] = useState<Dragging>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  /**
   * ПЕРЕСИНХРОНИЗАЦИЯ С СЕРВЕРОМ.
   *
   * Карточки и колонки живут в состоянии, потому что переезжают под мышью
   * раньше ответа сервера. Но `useState(props)` берёт значение один раз,
   * при монтировании: после `router.refresh()` сервер прислал бы новую доску,
   * а на экране осталась бы старая — заведённая стадия не появлялась бы
   * до перезагрузки страницы.
   *
   * Сравнивается не ссылка (серверный рендер каждый раз даёт новый массив,
   * и сброс был бы бесконечным), а отпечаток содержимого.
   */
  const columnsFingerprint = columns
    .map(
      (column) =>
        `${column.id}:${column.name}:${column.names.ka ?? ''}:${column.names.en ?? ''}:${column.names.ru ?? ''}:${column.colorToken ?? ''}`,
    )
    .join('|');
  // Только из пропсов: подмешать сюда локальное состояние значило бы сбрасывать
  // карточку обратно в исходную колонку сразу после того, как её перетащили.
  const cardsFingerprint = items.map((item) => `${item.id}:${item.pipelineStatusId}`).join('|');

  const [seenColumns, setSeenColumns] = useState(columnsFingerprint);
  const [seenCards, setSeenCards] = useState(cardsFingerprint);

  if (seenColumns !== columnsFingerprint) {
    setSeenColumns(columnsFingerprint);
    setOrder(columns);
  }
  if (seenCards !== cardsFingerprint) {
    setSeenCards(cardsFingerprint);
    setCards(items);
  }

  const done = (): void => {
    setOpenMenu(null);
    setAdding(false);
    router.refresh();
  };

  /**
   * Перенос карточки в другую стадию.
   *
   * Карточка переезжает сразу, до ответа сервера: агент тащил её мышью
   * и ждать не должен.
   *
   * НО ЕСЛИ СЕРВЕР ОТКАЗАЛ, ЭТО НАДО СКАЗАТЬ ВСЛУХ. Раньше карточка просто
   * возвращалась на место при обновлении, без единого слова, — и человек
   * видел не «мне нельзя», а «продукт сломался». Отказы тут настоящие:
   * агент двигает объекты только своей команды.
   *
   * Успех при этом молчит: результат человек видит своими глазами,
   * а плашка на каждое перетаскивание за день стала бы помехой.
   */
  const moveCard = (cardId: string, statusId: string): void => {
    const card = cards.find((item) => item.id === cardId);
    if (card === undefined || card.pipelineStatusId === statusId) return;

    const previous = card.pipelineStatusId;

    setCards((current) =>
      current.map((item) => (item.id === cardId ? { ...item, pipelineStatusId: statusId } : item)),
    );

    const revert = (): void => {
      setCards((current) =>
        current.map((item) =>
          item.id === cardId ? { ...item, pipelineStatusId: previous } : item,
        ),
      );
      notifyError(labels.moveFailed);
    };

    void fetch(`/api/v1/properties/${cardId}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pipelineStatusId: statusId }),
    })
      .then((response) => {
        if (!response.ok) {
          revert();
          return;
        }
        router.refresh();
      })
      .catch(revert);
  };

  const moveColumn = (columnId: string, beforeId: string): void => {
    if (columnId === beforeId) return;

    const next = [...order];
    const from = next.findIndex((column) => column.id === columnId);
    const to = next.findIndex((column) => column.id === beforeId);
    if (from === -1 || to === -1) return;

    const [moved] = next.splice(from, 1);
    if (moved === undefined) return;
    next.splice(to, 0, moved);

    const previous = order;
    setOrder(next);

    const revert = (): void => {
      setOrder(previous);
      notifyError(labels.orderFailed);
    };

    // Уходит весь порядок целиком: перестановка одной колонки меняет позиции
    // всех, и пятью запросами подряд доска побывала бы в состоянии,
    // которого никто не задавал.
    void fetch('/api/v1/pipeline-statuses/order', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ order: next.map((column) => column.id) }),
    })
      .then((response) => {
        if (!response.ok) {
          revert();
          return;
        }
        router.refresh();
      })
      .catch(revert);
  };

  return (
    <div className="flex items-start gap-4 overflow-x-auto pb-4">
      {order.map((column) => {
        const inColumn = cards.filter((card) => card.pipelineStatusId === column.id);

        return (
          <section
            key={column.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (dragging === null) return;

              if (dragging.kind === 'card') moveCard(dragging.id, column.id);
              else moveColumn(dragging.id, column.id);

              setDragging(null);
            }}
            /*
             * Колонка обрела цвет стадии полосой сверху: раньше пять колонок
             * различались только подписью, и глаз пересчитывал их каждый раз.
             * Полоса — тот же `colorToken`, что у метки в списке объектов.
             */
            className="relative flex w-72 shrink-0 flex-col gap-2 overflow-hidden rounded-[var(--radius-panel)] bg-[var(--color-surface-muted)] p-3 pt-4 shadow-[var(--shadow-card)] supports-[backdrop-filter]:bg-[oklch(1_0_0_/_0.45)] supports-[backdrop-filter]:backdrop-blur-[var(--blur-glass)]"
          >
            {/* Полоса цвета стадии по верхнему краю колонки. */}
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-1"
              style={{ backgroundColor: columnColor(column.colorToken) }}
            />

            <div
              draggable={canManage}
              onDragStart={() => canManage && setDragging({ kind: 'column', id: column.id })}
              onDragEnd={() => setDragging(null)}
              className={canManage ? 'cursor-grab active:cursor-grabbing' : ''}
            >
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                {/* Цвет стадии — то, по чему колонку находят взглядом,
                    не перечитывая заголовков. */}
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: columnColor(column.colorToken) }}
                />
                <span className="min-w-0 flex-1 truncate">{column.name}</span>
                <span className="text-xs font-normal text-[var(--color-text-secondary)]">
                  {String(inColumn.length)}
                </span>

                {canManage ? (
                  <button
                    type="button"
                    aria-label={labels.manage}
                    title={labels.manage}
                    onClick={() => setOpenMenu(openMenu === column.id ? null : column.id)}
                    className="rounded px-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]"
                  >
                    {MENU_GLYPH}
                  </button>
                ) : null}
              </h2>
            </div>

            {openMenu === column.id ? (
              <ColumnMenu
                column={{
                  id: column.id,
                  name: column.fallbackName,
                  names: column.names,
                  colorToken: column.colorToken,
                  isSystem: column.isSystem,
                }}
                otherColumns={order
                  .filter((other) => other.id !== column.id)
                  .map((other) => ({ id: other.id, name: other.name }))}
                occupiedCount={inColumn.length}
                labels={labels}
                onDone={done}
              />
            ) : null}

            {inColumn.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-6 text-center text-xs text-[var(--color-text-secondary)]">
                {labels.empty}
              </p>
            ) : (
              inColumn.map((card) => (
                <a
                  key={card.id}
                  href={`/properties/${card.id}`}
                  draggable
                  onDragStart={() => setDragging({ kind: 'card', id: card.id })}
                  onDragEnd={() => setDragging(null)}
                  className="cursor-grab rounded-[var(--radius-card)] bg-[var(--color-surface)] px-3 py-2.5 shadow-[var(--shadow-card)] transition-[box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.97] active:cursor-grabbing [@media(hover:hover)and(pointer:fine)]:hover:-translate-y-0.5 [@media(hover:hover)and(pointer:fine)]:hover:shadow-[var(--shadow-hover)]"
                >
                  <p className="text-sm font-medium">{card.price}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{card.kind}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{card.facts}</p>
                  {card.place === '' ? null : (
                    <p className="truncate text-xs text-[var(--color-text-secondary)]">
                      {card.place}
                    </p>
                  )}
                </a>
              ))
            )}
          </section>
        );
      })}

      {canManage ? (
        <section className="flex w-56 shrink-0 flex-col gap-2 p-3">
          {adding ? (
            <form
              className="appear flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const name = String(new FormData(event.currentTarget).get('name') ?? '');

                setBusy(true);
                void fetch('/api/v1/pipeline-statuses', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ name }),
                })
                  .then(() => done())
                  .finally(() => setBusy(false));
              }}
            >
              <Input
                name="name"
                placeholder={labels.stageName}
                aria-label={labels.stageName}
                maxLength={60}
                required
                autoFocus
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={busy}>
                  {busy ? labels.saving : labels.save}
                </Button>
                <Button tone="ghost" size="sm" type="button" onClick={() => setAdding(false)}>
                  {labels.cancel}
                </Button>
              </div>
            </form>
          ) : (
            <Button tone="ghost" size="sm" type="button" onClick={() => setAdding(true)}>
              {labels.addStage}
            </Button>
          )}
        </section>
      ) : null}
    </div>
  );
}
