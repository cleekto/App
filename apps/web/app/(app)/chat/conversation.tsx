'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Avatar } from '../../_ui/accent';
import { Button } from '../../_ui/primitives';
import { UploadButton } from '../../_ui/upload';

/**
 * Лента сообщений и поле ввода — общее для комнаты и личной переписки.
 *
 * ОДИН КОМПОНЕНТ НА ОБА СЛУЧАЯ, потому что разница между ними ровно
 * в адресе, куда уходит сообщение. Всё остальное — как выглядит своё
 * и чужое, что можно править, что удалено — одинаково, и разведённое
 * по двум компонентам разошлось бы на первой же правке.
 *
 * КЛИЕНТСКИЙ, И ЭТО ОПРАВДАНО. Списки и страницы в продукте серверные,
 * но здесь нужны три вещи, которых на сервере не сделать: отправка без
 * перезагрузки, прокрутка к последнему сообщению и обновление ленты после
 * отправки. Дат он не форматирует — их считает сервер (у браузера может
 * не быть данных грузинской локали).
 */

/** Разделитель в строке «отвечаете на»: литералы в разметке запрещены. */
const SEPARATOR = ' · ';

export interface ChatMessageItem {
  id: string;
  body: string | null;
  authorUserId: string;
  authorName: string;
  /** Готовая подписанная ссылка на фотографию автора. */
  authorAvatarUrl: string | null;
  /** Готовая подпись времени: посчитана на сервере. */
  timeLabel: string;
  editedAt: string | null;
  isDeleted: boolean;
  canDelete: boolean;
  canEdit: boolean;
  /** На что это ответ. `null` — не ответ. */
  replyTo: { id: string; authorName: string; body: string | null } | null;
  /** Приложенные файлы с уже подписанными ссылками. */
  attachments: ChatAttachmentItem[];
}

/** Загруженный, но ещё не отправленный файл. */
interface PendingFile {
  key: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface ChatAttachmentItem {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  /** Подписана сервером и живёт час. `null` — хранилище не ответило. */
  url: string | null;
}

export interface ChatLabels {
  attach: string;
  openAttachment: string;
  attaching: string;
  attachFailed: string;
  removeAttachment: string;
  reply: string;
  replyingTo: string;
  cancelReply: string;
  deletedQuote: string;
  write: string;
  send: string;
  edited: string;
  deleted: string;
  delete: string;
  empty: string;
  emptyHint: string;
}

export function Conversation({
  messages: initial,
  postTo,
  currentUserId,
  version: initialVersion,
  labels,
  notice,
}: {
  messages: ChatMessageItem[];
  /** Адрес ленты: и читаем оттуда, и пишем туда. */
  postTo: string;
  currentUserId: string;
  /** Отпечаток состояния на момент отрисовки страницы. */
  version: string;
  labels: ChatLabels;
  /** Пояснение над лентой — например, что переписка личная. */
  notice?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessageItem | null>(null);

  /*
   * Файлы, уже лежащие в хранилище, но ещё не отправленные.
   *
   * Загрузка идёт СРАЗУ при выборе, а не при отправке: фотография с телефона
   * грузится заметное время, и делать это в момент нажатия «отправить»
   * означало бы держать человека у экрана после того, как он закончил.
   * Не отправил — в хранилище остался ничей файл; это дешевле, чем ожидание.
   */
  const [pending, setPending] = useState<PendingFile[]>([]);
  const bottom = useRef<HTMLDivElement>(null);

  /*
   * ЖИВАЯ ДОСТАВКА.
   *
   * Браузер сам спрашивает ленту раз в три секунды и присылает отпечаток,
   * который у него уже есть. Не изменилось — сервер отвечает `204` без тела,
   * и это самый частый ответ.
   *
   * Почему не открытое соединение: приложение живёт на Vercel, функции там
   * короткие, и поток на каждого агента занимал бы функцию целиком всё время,
   * пока он сидит в чате.
   *
   * ОПРОС ИДЁТ, ТОЛЬКО ПОКА ВКЛАДКА ОТКРЫТА. Свёрнутая вкладка не должна
   * ходить в сеть: агент держит CRM открытой весь день, и половина этого дня
   * — другие окна. При возвращении лента обновляется сразу, не дожидаясь
   * очередного тика.
   */
  const [live, setLive] = useState(initial);
  const versionRef = useRef(initialVersion);

  // Страница перерисовалась (сменили комнату) — начинаем с её данных.
  const [seenVersion, setSeenVersion] = useState(initialVersion);
  if (seenVersion !== initialVersion) {
    setSeenVersion(initialVersion);
    versionRef.current = initialVersion;
    setLive(initial);
  }

  useEffect(() => {
    let stopped = false;

    const pull = async (): Promise<void> => {
      if (document.visibilityState !== 'visible') return;

      try {
        const response = await fetch(`${postTo}?since=${encodeURIComponent(versionRef.current)}`, {
          cache: 'no-store',
        });
        // 204 — «ничего не изменилось», самый частый ответ.
        if (stopped || response.status === 204 || !response.ok) return;

        // Подписи времени приходят готовыми: форматировать их здесь нельзя,
        // у браузера может не быть данных грузинской локали.
        const data = (await response.json()) as { version: string; messages: ChatMessageItem[] };

        versionRef.current = data.version;
        setLive(data.messages);
      } catch {
        // Сеть моргнула — следующий тик попробует снова. Показывать ошибку
        // на каждый неудачный опрос значило бы мигать ею весь день.
      }
    };

    const timer = setInterval(() => void pull(), 3000);
    const onVisible = (): void => void pull();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [postTo]);

  const messages = live;

  // К последнему сообщению — сразу, без прокрутки на глазах: лента открылась
  // уже внизу, а не приехала туда, пока человек читает.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const send = async (): Promise<void> => {
    const body = draft.trim();
    // Сообщение может быть одним файлом без подписи: прислать фотографию
    // и ничего не написать — обычное дело.
    if ((body === '' && pending.length === 0) || busy) return;

    setBusy(true);
    try {
      const response = await fetch(postTo, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          body,
          ...(replyTo === null ? {} : { replyToId: replyTo.id }),
          ...(pending.length === 0
            ? {}
            : {
                attachments: pending.map((file) => ({
                  key: file.key,
                  fileName: file.fileName,
                  contentType: file.contentType,
                  sizeBytes: file.sizeBytes,
                })),
              }),
        }),
      });

      if (response.ok) {
        setDraft('');
        setReplyTo(null);
        setPending([]);
        // Своё сообщение должно появиться немедленно, а не через три
        // секунды: ждать собственных слов — худшее, что может делать чат.
        versionRef.current = '';
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string): Promise<void> => {
    const response = await fetch(`/api/v1/chat/messages/${id}`, { method: 'DELETE' });
    if (response.ok) {
      versionRef.current = '';
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {notice === undefined ? null : (
        <p className="border-b border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-text-tertiary)]">
          {notice}
        </p>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium">{labels.empty}</p>
            <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">
              {labels.emptyHint}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((message) => {
              const mine = message.authorUserId === currentUserId;

              return (
                <li key={message.id} className={`flex gap-2.5 ${mine ? 'flex-row-reverse' : ''}`}>
                  <Avatar name={message.authorName} src={message.authorAvatarUrl} size="sm" />

                  <div className={`flex min-w-0 max-w-[min(34rem,80%)] flex-col gap-1`}>
                    <div
                      className={`flex items-baseline gap-2 text-xs text-[var(--color-text-tertiary)] ${
                        mine ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <span className="font-medium text-[var(--color-text-secondary)]">
                        {message.authorName}
                      </span>
                      <span>{message.timeLabel}</span>
                      {message.editedAt === null ? null : <span>{labels.edited}</span>}
                    </div>

                    {/*
                      Своё сообщение — фирменной заливкой, чужое — светлой.
                      Так лента читается без чтения имён: взгляд отличает
                      свои реплики по стороне и цвету.
                    */}
                    {/*
                      Цитата над сообщением: короткая, в одну строку.
                      Приводится живой текст исходного, а не копия — исходное
                      правят и удаляют, и копия рассказывала бы то, чего
                      человек уже не говорит.
                    */}
                    {message.replyTo === null ? null : (
                      <div className="flex items-start gap-2 rounded-[var(--radius-sm)] border-l-2 border-[var(--color-brand)] bg-[var(--color-surface-muted)] px-2 py-1 text-xs">
                        <span className="shrink-0 font-medium text-[var(--color-text-secondary)]">
                          {message.replyTo.authorName}
                        </span>
                        <span className="truncate text-[var(--color-text-tertiary)]">
                          {message.replyTo.body ?? labels.deletedQuote}
                        </span>
                      </div>
                    )}

                    <div
                      className={`rounded-[var(--radius-card)] px-3 py-2 text-sm break-words ${
                        message.isDeleted
                          ? 'bg-[var(--color-surface-muted)] text-[var(--color-text-tertiary)] italic'
                          : mine
                            ? 'bg-[image:var(--gradient-primary)] text-white'
                            : 'border border-[var(--color-border)] bg-[var(--color-surface)]'
                      }`}
                    >
                      {message.isDeleted ? labels.deleted : message.body}
                    </div>

                    {message.attachments.length === 0 ? null : (
                      <div
                        className={`flex flex-col gap-1.5 ${mine ? 'items-end' : 'items-start'}`}
                      >
                        {message.attachments.map((file) => (
                          <Attachment key={file.id} file={file} label={labels.openAttachment} />
                        ))}
                      </div>
                    )}

                    <div className={`flex gap-3 ${mine ? 'self-end' : 'self-start'}`}>
                      {message.isDeleted ? null : (
                        <button
                          type="button"
                          onClick={() => setReplyTo(message)}
                          className="text-xs text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-brand)]"
                        >
                          {labels.reply}
                        </button>
                      )}

                      {message.canDelete ? (
                        <button
                          type="button"
                          onClick={() => void remove(message.id)}
                          className="text-xs text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-danger)]"
                        >
                          {labels.delete}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div ref={bottom} />
      </div>

      {replyTo === null ? null : (
        <div className="flex items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-xs">
          <span className="shrink-0 text-[var(--color-text-secondary)]">{labels.replyingTo}</span>
          <span className="min-w-0 flex-1 truncate text-[var(--color-text-tertiary)]">
            {replyTo.authorName}
            {SEPARATOR}
            {replyTo.body ?? labels.deletedQuote}
          </span>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            className="shrink-0 text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            {labels.cancelReply}
          </button>
        </div>
      )}

      {/* Приложенное, но ещё не отправленное. Видно до отправки, иначе
          человек не знает, взялся файл или нет. */}
      {pending.length === 0 ? null : (
        <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] px-3 pt-2">
          {pending.map((file) => (
            <span
              key={file.key}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface-muted)] py-1 pr-1.5 pl-2.5 text-xs"
            >
              <span className="max-w-48 truncate">{file.fileName}</span>
              <button
                type="button"
                aria-label={labels.removeAttachment}
                title={labels.removeAttachment}
                onClick={() => setPending((current) => current.filter((f) => f.key !== file.key))}
                className="text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-danger)]"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden
                  className="size-3"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 border-t border-[var(--color-border)] p-3">
        <UploadButton
          kind="chat"
          multiple
          labels={{
            choose: labels.attach,
            busy: labels.attaching,
            failed: labels.attachFailed,
          }}
          onUploaded={(results) => {
            setPending((current) => [
              ...current,
              ...results.map((file) => ({
                key: file.key,
                fileName: file.fileName,
                contentType: file.contentType,
                sizeBytes: file.sizeBytes,
              })),
            ]);
          }}
        />

        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter отправляет, Shift+Enter переносит строку — как везде,
            // где люди переписываются. Иначе каждое сообщение требует мыши.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder={labels.write}
          rows={1}
          className="max-h-40 min-h-10 flex-1 resize-y rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus-visible:border-[var(--color-brand)]"
        />
        <Button
          type="button"
          onClick={() => void send()}
          disabled={busy || (draft.trim() === '' && pending.length === 0)}
        >
          {labels.send}
        </Button>
      </div>
    </div>
  );
}

/**
 * Вложение в ленте.
 *
 * КАРТИНКА ПОКАЗЫВАЕТСЯ, ОСТАЛЬНОЕ — СТРОКОЙ С ИМЕНЕМ. Фотография объекта,
 * присланная коллегой, должна быть видна сразу: открывать её в новой вкладке,
 * чтобы понять, ту ли прислали, — лишний шаг в разговоре, который идёт
 * быстро. У документа же смысл в имени, и «превью» из первой страницы PDF
 * не сказало бы больше, чем «договор аренды.pdf».
 *
 * Ссылка открывается в новой вкладке: уйти из переписки, чтобы посмотреть
 * файл, и потерять место в разговоре — не то, чего человек хотел.
 * `rel` обязателен: без него открытая страница получает доступ к нашей.
 */
function Attachment({ file, label }: { file: ChatAttachmentItem; label: string }) {
  if (file.url === null) return null;

  const isImage = file.contentType.startsWith('image/');

  return (
    <a
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      className={
        isImage
          ? 'block max-w-64 overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)]'
          : 'inline-flex max-w-64 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-muted)]'
      }
    >
      {isImage ? (
        /*
         * Обычный `img`, не `next/image`: ссылка подписана и живёт час,
         * а оптимизатор Next требует заранее перечислить домены — см. `Photo`.
         *
         * РАЗМЕР ЗАДАЁТ САМА КАРТИНКА, а не обёртка, — здесь наоборот,
         * чем у `Photo`, и по той же причине. Ссылка лежит в колонке
         * с `items-end`, то есть её ширина считается ПО СОДЕРЖИМОМУ.
         *
         * Поэтому все размеры здесь — в абсолютных единицах, ни одного
         * процента. `w-full` и даже `max-w-full` замыкают кольцо: ширина
         * картинки по родителю, ширина родителя по картинке — и браузер
         * разрывает его нулём. На экране это выглядело как рамка в два
         * пикселя вместо фотографии, причём файл загружался исправно.
         * Найдено в браузере, а не рассуждением: в разметке всё выглядело
         * правильно.
         *
         * ПО ТОЙ ЖЕ ПРИЧИНЕ ЗДЕСЬ НЕТ `loading="lazy"`. Отложенная загрузка
         * смотрит на КОРОБКУ элемента, а коробки у этой картинки до загрузки
         * нет — её размер и есть размер картинки. Браузер ждал показа,
         * показ ждал загрузки, загрузка ждала браузера. У `Photo` такого
         * не бывает: там размер задаёт обёртка, и коробка есть всегда.
         */
        <img
          src={file.url}
          alt={file.fileName}
          decoding="async"
          className="block h-auto max-h-64 w-auto max-w-64"
        />
      ) : (
        <>
          {/* Значок документа. Рисуется здесь: он один. */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="size-4 shrink-0 text-[var(--color-text-tertiary)]"
          >
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5" />
          </svg>
          <span className="truncate">{file.fileName}</span>
        </>
      )}
    </a>
  );
}
