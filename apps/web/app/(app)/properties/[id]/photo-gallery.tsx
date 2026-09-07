'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Photo } from '../../../_ui/photo';
import { UploadButton } from '../../../_ui/upload';

/**
 * Фотографии объекта: показ и правка.
 *
 * ПРАВКА ОТДЕЛЬНЫМ РЕЖИМОМ, а не крестиком поверх каждого снимка всегда.
 * Карточку открывают, чтобы посмотреть на объект перед звонком, и крестик
 * в углу фотографии в этот момент — только риск: одно случайное нажатие,
 * и снимка нет. Нажал «изменить» — значит, пришёл именно за этим.
 *
 * ПЕРВАЯ ФОТОГРАФИЯ — ОБЛОЖКА. Она же стоит в списке объектов, поэтому
 * порядок здесь не украшение: убрал первую — сменилась обложка везде.
 *
 * Наружу уходит ВЕСЬ список ключей, а не «добавь эту» и «убери ту»:
 * порядок — часть списка, и отдельными действиями его пришлось бы
 * собирать заново на сервере.
 */

export interface PhotoItem {
  /** Ключ в хранилище либо внешний адрес, если снимок пришёл с площадки. */
  key: string;
  /** Подписанная ссылка на показ. Живёт час, поэтому в базе её нет. */
  url: string;
}

export function PhotoGallery({
  propertyId,
  initial,
  canEdit,
  labels,
}: {
  propertyId: string;
  initial: PhotoItem[];
  canEdit: boolean;
  labels: {
    photos: string;
    alt: string;
    edit: string;
    done: string;
    remove: string;
    choose: string;
    busy: string;
    uploadFailed: string;
    saveFailed: string;
    open: string;
    close: string;
    previous: string;
    next: string;
    downloadAll: string;
    downloadBusy: string;
    downloadFailed: string;
  };
}) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [failed, setFailed] = useState(false);
  /** Архив собирается на сервере: пока идёт — кнопка занята. */
  const [packing, setPacking] = useState(false);
  /*
   * Своя переменная, а не общая с сохранением: иначе неудачное скачивание
   * показывало бы «не удалось сохранить», и агент искал бы пропавшую правку
   * там, где ничего не менялось.
   */
  const [packFailed, setPackFailed] = useState(false);

  /** Какой снимок открыт во весь экран. `null` — просмотр закрыт. */
  const [viewing, setViewing] = useState<number | null>(null);

  /**
   * Сохранение с ОТКАТОМ. Экран меняется сразу — ждать ответа, глядя
   * на неизменившуюся страницу, невозможно, — но если сервер отказал,
   * список возвращается к прежнему: показывать удалённой фотографию,
   * которая на месте, хуже, чем не удалить её вовсе.
   */
  const save = async (next: PhotoItem[]): Promise<void> => {
    const previous = items;
    setItems(next);
    setFailed(false);

    try {
      const response = await fetch(`/api/v1/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ photos: next.map((item) => item.key) }),
      });

      if (!response.ok) {
        setItems(previous);
        setFailed(true);
      }
    } catch {
      setItems(previous);
      setFailed(true);
    }
  };

  /*
   * СКАЧИВАНИЕ ИДЁТ ЧЕРЕЗ ССЫЛКУ, А НЕ ЧЕРЕЗ ОТКРЫТИЕ АДРЕСА.
   *
   * Маршрут архива требует сессии, и `window.open` на него открыл бы пустую
   * вкладку, которая тут же закрылась. Забираем файл запросом, у которого
   * cookie есть, и отдаём браузеру объектной ссылкой — так же, как отдал бы
   * сервер, но без второй вкладки.
   */
  const downloadAll = async (): Promise<void> => {
    if (packing) return;

    setPacking(true);
    setPackFailed(false);

    try {
      const response = await fetch(`/api/v1/properties/${propertyId}/photos`);
      if (!response.ok) {
        setPackFailed(true);
        return;
      }

      const blob = await response.blob();
      const href = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = href;
      link.download = `${propertyId}-photos.zip`;
      document.body.append(link);
      link.click();
      link.remove();

      // Ссылка держит файл в памяти вкладки, пока её не отпустят.
      URL.revokeObjectURL(href);
    } catch {
      setPackFailed(true);
    } finally {
      setPacking(false);
    }
  };

  if (items.length === 0 && !canEdit) return null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">{labels.photos}</p>

        <div className="flex flex-wrap items-center gap-2">
          {/*
            СОХРАНИТЬ ВСЁ ОДНИМ ФАЙЛОМ.
            Чтобы разместить объявление, агент перетаскивает в форму площадки
            до шестнадцати снимков. До этой кнопки он сохранял их по одному
            правой кнопкой — на каждом объекте. Самая механическая часть
            размещения, и единственная, которую можно убрать целиком,
            ничего не зная о разметке площадки.
          */}
          {items.length === 0 ? null : (
            <button
              type="button"
              disabled={packing}
              onClick={() => void downloadAll()}
              className="rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 py-1.5 text-xs transition-colors duration-[var(--duration-fast)] disabled:opacity-50 [@media(hover:hover)and(pointer:fine)]:hover:bg-[var(--color-surface-muted)]"
            >
              {packing ? labels.downloadBusy : labels.downloadAll}
            </button>
          )}

          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              {editing ? (
                <UploadButton
                  kind="property"
                  multiple
                  labels={{
                    choose: labels.choose,
                    busy: labels.busy,
                    failed: labels.uploadFailed,
                  }}
                  onUploaded={(results) => {
                    void save([
                      ...items,
                      ...results.map((result) => ({ key: result.key, url: result.previewUrl })),
                    ]);
                  }}
                />
              ) : null}

              <button
                type="button"
                onClick={() => setEditing((on) => !on)}
                className="rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-muted)]"
              >
                {editing ? labels.done : labels.edit}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {failed ? <p className="text-xs text-[var(--color-danger)]">{labels.saveFailed}</p> : null}
      {packFailed ? (
        <p className="text-xs text-[var(--color-danger)]">{labels.downloadFailed}</p>
      ) : null}

      {items.length === 0 ? null : (
        <>
          {/* Крупный кадр и лента под ним, а не две колонки рядом: колонки
              пришлось бы подгонять по высоте под произвольное число снимков,
              и при трёх фотографиях справа оставалась белая дыра. */}
          <Frame
            item={items[0] ?? null}
            alt={labels.alt}
            openLabel={labels.open}
            className="aspect-[16/10] w-full max-w-2xl"
            onOpen={() => setViewing(0)}
            removable={editing}
            removeLabel={labels.remove}
            onRemove={() => void save(items.slice(1))}
          />

          {items.length === 1 ? null : (
            <div className="flex flex-wrap gap-2">
              {items.slice(1).map((item, index) => (
                <Frame
                  key={item.key}
                  item={item}
                  alt={labels.alt}
                  openLabel={labels.open}
                  className="h-16 w-24"
                  // Смещение на единицу: лента начинается со второго снимка,
                  // а нумерация в просмотре — с первого.
                  onOpen={() => setViewing(index + 1)}
                  removable={editing}
                  removeLabel={labels.remove}
                  onRemove={() => void save(items.filter((other) => other.key !== item.key))}
                />
              ))}
            </div>
          )}
        </>
      )}

      <Lightbox
        items={items}
        index={viewing}
        labels={labels}
        onClose={() => setViewing(null)}
        onMove={(next) => setViewing(next)}
      />
    </section>
  );
}

/**
 * Снимок: открывается по нажатию, а в режиме правки ещё и убирается.
 *
 * САМ СНИМОК — КНОПКА, а не картинка с обработчиком. Кнопку видно
 * с клавиатуры, она попадает в обход табуляцией и объявляет себя читалке;
 * `div` с `onClick` не делает ничего из этого, а выглядит так же.
 */
function Frame({
  item,
  alt,
  openLabel,
  className,
  onOpen,
  removable,
  removeLabel,
  onRemove,
}: {
  item: PhotoItem | null;
  alt: string;
  openLabel: string;
  className: string;
  onOpen: () => void;
  removable: boolean;
  removeLabel: string;
  onRemove: () => void;
}) {
  return (
    <div className="relative w-fit">
      <button
        type="button"
        onClick={onOpen}
        aria-label={openLabel}
        title={openLabel}
        className="block cursor-zoom-in rounded-[var(--radius-control)] transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.98]"
      >
        <Photo src={item?.url ?? null} alt={alt} className={className} />
      </button>

      {removable ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          title={removeLabel}
          className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-[var(--color-surface)] text-[var(--color-danger)] shadow-[var(--shadow-raised)] transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.92] [@media(hover:hover)and(pointer:fine)]:hover:scale-110"
        >
          {/* Крестик рисуется здесь: одна фигура, ради неё библиотеку
              иконок не подключают. */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden
            className="size-3.5"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

/**
 * Разделитель счётчика снимков.
 *
 * Вынесен константой, а не написан в разметке: строк в разметке в этом
 * проекте не бывает вовсе (правило 18), и линтер это стережёт. Переводить
 * его при этом нечего — «3 / 7» читается одинаково на всех трёх языках.
 */
const COUNTER_SEPARATOR = ' / ';

/**
 * Просмотр снимка во весь экран.
 *
 * ЗАЧЕМ. В ленте снимок шириной с ноготь: по нему не понять ни состояния
 * ремонта, ни вида из окна — а именно за этим агент и открывает карточку
 * перед звонком. Открывать файл в соседней вкладке — не решение: там
 * подписанная ссылка, из которой не вернуться к объекту и не перейти
 * к следующему снимку.
 *
 * ОКНО — НАСТОЯЩИЙ `dialog`. Оно само перехватывает фокус, само закрывается
 * по Escape и само делает остальную страницу недоступной для чтения
 * с экрана. Появление и затемнение ему дают общие правила из `globals.css`,
 * те же, что у формы правки, — второй раз это описывать не нужно.
 *
 * СТРЕЛКИ РАБОТАЮТ И С КЛАВИАТУРЫ. Снимки листают подряд, и тянуться мышью
 * к краю экрана после каждого — работа, которой можно не быть.
 */
function Lightbox({
  items,
  index,
  labels,
  onClose,
  onMove,
}: {
  items: PhotoItem[];
  index: number | null;
  labels: {
    alt: string;
    close: string;
    previous: string;
    next: string;
  };
  onClose: () => void;
  onMove: (index: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (node === null) return;

    if (index !== null && !node.open) node.showModal();
    if (index === null && node.open) node.close();
  }, [index]);

  const current = index === null ? null : (items[index] ?? null);

  /*
   * Счётчик собирается здесь, а не в разметке. Заодно это снимает вопрос,
   * откуда клиенту взять формат числа: звать `Intl` в браузере агента
   * запрещено — у него может не быть данных грузинской локали.
   */
  const counter = String((index ?? 0) + 1) + COUNTER_SEPARATOR + String(items.length);

  /*
   * Переход по кругу: с последнего снимка вперёд — на первый.
   *
   * Упереться в край, листая шесть фотографий, — мелкая, но верная досада;
   * кольцо избавляет от неё и ничего не стоит.
   */
  const step = (delta: number): void => {
    if (index === null || items.length === 0) return;
    onMove((index + delta + items.length) % items.length);
  };

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => {
        // Нажатие мимо снимка закрывает: так ведут себя все просмотрщики.
        if (event.target === dialog.current) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          step(-1);
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          step(1);
        }
      }}
      className="m-auto max-h-[92vh] w-[min(64rem,94vw)] bg-transparent p-0 backdrop:bg-black/80"
    >
      {current === null ? null : (
        <div className="flex flex-col items-center gap-3">
          {/*
            Размер задаёт сама картинка, а не обёртка: пропорции у снимков
            разные, и коробка под них подгонялась бы вслепую. Пределы —
            в единицах экрана, чтобы вертикальный снимок помещался целиком.
          */}
          <img
            src={current.url}
            alt={labels.alt}
            decoding="async"
            className="max-h-[80vh] max-w-full rounded-[var(--radius-card)] object-contain shadow-[var(--shadow-overlay)]"
          />

          <div className="flex items-center gap-3">
            {items.length === 1 ? null : (
              <>
                <ViewerButton label={labels.previous} onClick={() => step(-1)}>
                  <path d="M15 5l-7 7 7 7" />
                </ViewerButton>

                {/*
                  Счётчик — просто цифры с чертой, и переводить его нечего:
                  «3 / 7» читается одинаково на всех трёх языках. Заодно
                  это снимает вопрос, откуда клиенту взять формат числа:
                  звать `Intl` в браузере агента здесь запрещено.
                */}
                <span className="text-sm tabular-nums text-white/80">{counter}</span>

                <ViewerButton label={labels.next} onClick={() => step(1)}>
                  <path d="M9 5l7 7-7 7" />
                </ViewerButton>
              </>
            )}

            <ViewerButton label={labels.close} onClick={onClose}>
              <path d="M6 6l12 12M18 6L6 18" />
            </ViewerButton>
          </div>
        </div>
      )}
    </dialog>
  );
}

/**
 * Кнопка поверх затемнения.
 *
 * Белая на полупрозрачном, а не фирменная: на снимке любого цвета фирменный
 * фиолетовый то теряется, то спорит с картинкой. Здесь фон — сама
 * фотография, и единственный надёжный контраст даёт белое на затемнении.
 */
function ViewerButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-10 place-items-center rounded-full bg-white/15 text-white transition-[background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.94] [@media(hover:hover)and(pointer:fine)]:hover:bg-white/25"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="size-5"
      >
        {children}
      </svg>
    </button>
  );
}
