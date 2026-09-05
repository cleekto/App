'use client';

import { useRef, useState } from 'react';

/**
 * Загрузка картинок в хранилище.
 *
 * ФАЙЛ ИДЁТ В ХРАНИЛИЩЕ НАПРЯМУЮ, минуя наш сервер: сначала сервер выдаёт
 * подписанную ссылку, потом браузер кладёт файл по ней. Пропускать файл
 * через нашу функцию значило бы упереться в предел размера тела запроса —
 * фотография с телефона легко больше, — и платить за время функции,
 * потраченное на перекладывание байтов.
 *
 * Наружу отдаётся КЛЮЧ файла, а не ссылка: ссылка подписана и живёт час,
 * хранить её в базе бессмысленно. Показывать файл сервер будет, подписывая
 * ключ заново.
 */

export interface UploadResult {
  key: string;
  /** Локальный адрес для мгновенного показа, пока страница не перечиталась. */
  previewUrl: string;
}

/**
 * Загружает один файл и возвращает его ключ.
 *
 * Ошибки не глотаются: `null` означает «не вышло», и вызывающий обязан
 * это показать. Молчаливый провал загрузки — худший вид: человек думает,
 * что фотография на месте.
 */
export async function uploadFile(
  file: File,
  kind: 'avatar' | 'property',
): Promise<UploadResult | null> {
  const ticket = await fetch('/api/v1/uploads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind, contentType: file.type, sizeBytes: file.size }),
  });

  if (!ticket.ok) return null;

  const { uploadUrl, key } = (await ticket.json()) as { uploadUrl: string; key: string };

  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  });

  if (!put.ok) return null;

  return { key, previewUrl: URL.createObjectURL(file) };
}

/**
 * Кнопка выбора файла с показом хода дела.
 *
 * Состояние «идёт загрузка» видно обязательно: фотография с телефона
 * загружается заметное время, и без него человек нажимает второй раз.
 */
export function UploadButton({
  kind,
  labels,
  multiple = false,
  onUploaded,
}: {
  kind: 'avatar' | 'property';
  labels: { choose: string; busy: string; failed: string };
  multiple?: boolean;
  onUploaded: (results: UploadResult[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        className="hidden"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          if (files.length === 0) return;

          setBusy(true);
          setFailed(false);

          void Promise.all(files.map((file) => uploadFile(file, kind)))
            .then((results) => {
              const done = results.filter((item): item is UploadResult => item !== null);
              if (done.length !== files.length) setFailed(true);
              if (done.length > 0) onUploaded(done);
            })
            .finally(() => {
              setBusy(false);
              // Иначе тот же файл второй раз не выберется: браузер считает
              // значение неизменившимся и события не шлёт.
              if (input.current !== null) input.current.value = '';
            });
        }}
      />

      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-muted)] disabled:opacity-60"
      >
        {busy ? labels.busy : labels.choose}
      </button>

      {failed ? <span className="text-xs text-[var(--color-danger)]">{labels.failed}</span> : null}
    </div>
  );
}
