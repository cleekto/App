'use client';

import { useState } from 'react';

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
  };
}) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [failed, setFailed] = useState(false);

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

  if (items.length === 0 && !canEdit) return null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">{labels.photos}</p>

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

      {failed ? <p className="text-xs text-[var(--color-danger)]">{labels.saveFailed}</p> : null}

      {items.length === 0 ? null : (
        <>
          {/* Крупный кадр и лента под ним, а не две колонки рядом: колонки
              пришлось бы подгонять по высоте под произвольное число снимков,
              и при трёх фотографиях справа оставалась белая дыра. */}
          <Frame
            item={items[0] ?? null}
            alt={labels.alt}
            className="aspect-[16/10] w-full max-w-2xl"
            removable={editing}
            removeLabel={labels.remove}
            onRemove={() => void save(items.slice(1))}
          />

          {items.length === 1 ? null : (
            <div className="flex flex-wrap gap-2">
              {items.slice(1).map((item) => (
                <Frame
                  key={item.key}
                  item={item}
                  alt={labels.alt}
                  className="h-16 w-24"
                  removable={editing}
                  removeLabel={labels.remove}
                  onRemove={() => void save(items.filter((other) => other.key !== item.key))}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Снимок и, в режиме правки, кнопка убрать его. */
function Frame({
  item,
  alt,
  className,
  removable,
  removeLabel,
  onRemove,
}: {
  item: PhotoItem | null;
  alt: string;
  className: string;
  removable: boolean;
  removeLabel: string;
  onRemove: () => void;
}) {
  return (
    <div className="relative w-fit">
      <Photo src={item?.url ?? null} alt={alt} className={className} />

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
