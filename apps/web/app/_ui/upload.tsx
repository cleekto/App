'use client';

import { useRef, useState } from 'react';

import { failureText } from './failure';

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
  /**
   * Имя, под которым файл выбрал человек.
   *
   * Ключ в хранилище — случайный набор букв, и для фотографии этого хватает:
   * её видно. Для вложения в переписке имя и есть содержание: «договор
   * аренды.pdf» и «IMG_4821.jpg» читаются по-разному.
   */
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * Куда кладётся файл. От вида зависит и папка в хранилище, и что вообще
 * принимается: к сообщению можно приложить PDF, аватаркой — нет.
 */
export type UploadKind = 'avatar' | 'property' | 'chat';

/** Чем кончилась загрузка. Отказ несёт причину, а не просто «нет». */
export type UploadOutcome =
  { ok: true; file: UploadResult } | { ok: false; reason: string; where: 'ticket' | 'storage' };

/**
 * Загружает один файл.
 *
 * ПРИЧИНА ОТКАЗА ДОХОДИТ ДО ЧЕЛОВЕКА. Раньше функция возвращала `null` на
 * любую беду, и кнопка показывала одно «загрузить не вышло» — что на не
 * настроенное хранилище, что на слишком большой файл, что на отказ самого
 * хранилища. Отличить их снаружи было нельзя, и каждое обращение
 * «не грузятся фотографии» начиналось с догадок.
 *
 * Разделены и МЕСТА отказа: наш сервер (`ticket`) и хранилище (`storage`).
 * Это разные неисправности с разным лечением — не заданные переменные
 * окружения против недоступного бака.
 */
export async function uploadFile(
  file: File,
  kind: UploadKind,
  fallback: string,
): Promise<UploadOutcome> {
  const ticket = await fetch('/api/v1/uploads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind, contentType: file.type, sizeBytes: file.size }),
  });

  if (!ticket.ok) {
    return { ok: false, where: 'ticket', reason: await failureText(ticket, {}, fallback) };
  }

  const { uploadUrl, key } = (await ticket.json()) as { uploadUrl: string; key: string };

  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  });

  if (!put.ok) {
    // Тело ответа хранилища — чужой XML, и показывать его человеку незачем.
    // Код состояния при этом говорит многое: 403 — подпись или доступ,
    // 404 — нет бака.
    return { ok: false, where: 'storage', reason: `${fallback} (${String(put.status)})` };
  }

  return {
    ok: true,
    file: {
      key,
      previewUrl: URL.createObjectURL(file),
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    },
  };
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
  kind: UploadKind;
  labels: { choose: string; busy: string; failed: string };
  multiple?: boolean;
  onUploaded: (results: UploadResult[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={input}
        type="file"
        accept={
          kind === 'chat'
            ? 'image/jpeg,image/png,image/webp,application/pdf'
            : 'image/jpeg,image/png,image/webp'
        }
        multiple={multiple}
        className="hidden"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          if (files.length === 0) return;

          setBusy(true);
          setFailed(null);

          void Promise.all(files.map((file) => uploadFile(file, kind, labels.failed)))
            .then((results) => {
              const done = results.filter((item) => item.ok).map((item) => item.file);
              // Показывается ПЕРВАЯ причина, а не «часть файлов не взялась»:
              // при отказе хранилища причина у всех одна, и повторять её
              // столько раз, сколько файлов, незачем.
              const failure = results.find((item) => !item.ok);
              if (failure !== undefined && !failure.ok) setFailed(failure.reason);
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

      {failed === null ? null : (
        <span className="text-xs text-[var(--color-danger)]">{failed}</span>
      )}
    </div>
  );
}
