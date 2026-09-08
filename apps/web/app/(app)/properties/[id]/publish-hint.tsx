'use client';

import { useEffect, useRef } from 'react';

/**
 * Что делать после нажатия «Разместить».
 *
 * ЗАЧЕМ. Кнопка открывает форму площадки в новой вкладке — и на этом
 * след теряется: агент оказывается на чужом сайте, где ничего про kleekTo
 * не написано. Он не помнит, скачал ли фотографии, ждать ли заполнения
 * и кто нажимает «Опубликовать».
 *
 * Окно перечисляет ровно эти шаги и закрывается одним нажатием. Оно
 * появляется ПОСЛЕ открытия вкладки, а не вместо: форма уже ждёт в соседней
 * вкладке, пока агент читает.
 *
 * ШАГИ РАЗНЫЕ У ПЛОЩАДОК, и притворяться, что одинаковые, нельзя: на ss.ge
 * поля заполняет расширение, на myhome их набирают руками.
 */

export function PublishHint({
  source,
  autofills,
  labels,
  onClose,
}: {
  /** Имя площадки — не текст интерфейса, а собственное имя. */
  source: string;
  /** Заполняет ли расширение форму этой площадки. */
  autofills: boolean;
  labels: {
    title: string;
    form: string;
    formSelf: string;
    fill: string;
    manual: string;
    photos: string;
    publish: string;
    got: string;
  };
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  /*
   * ЗАКРЫТИЕ НЕ ДОЛЖНО ЗАВИСЕТЬ ОТ СОБЫТИЯ `close`.
   *
   * Раньше состояние подсказки снималось только через `onClose` на элементе.
   * Событие `close` не всплывает, и на проверке оно не пришло вовсе: окно
   * закрывалось, но родитель об этом не узнавал. Дальше начиналось скрытое:
   * подсказка оставалась «открытой» в состоянии, следующее нажатие «Разместить»
   * лишь меняло ей свойства, а `showModal` при этом не вызывался — и второе
   * окно за загрузку страницы уже не показывалось.
   *
   * Поэтому закрытие зовём сами, а `close` слушаем вдобавок — ради Esc,
   * который закрывает окно мимо наших кнопок. Двойной вызов безвреден:
   * родитель просто ещё раз обнуляет одно и то же.
   */
  const closing = useRef(onClose);
  closing.current = onClose;

  useEffect(() => {
    const node = dialog.current;
    if (node === null) return undefined;

    // `showModal`, а не атрибут `open`: только он даёт подложку, ловушку
    // фокуса и закрытие по Esc — то есть настоящее окно, а не блок поверх.
    node.showModal();

    const done = (): void => {
      closing.current();
    };
    node.addEventListener('close', done);
    return () => {
      node.removeEventListener('close', done);
    };
  }, []);

  const dismiss = (): void => {
    dialog.current?.close();
    onClose();
  };

  /*
   * ПЕРВЫЙ ШАГ РАЗНЫЙ, И ЭТО НЕ ПРИДИРКА. Вкладку с формой мы открываем
   * только там, где знаем её адрес. Для myhome адреса нет — вкладка
   * не открывается, а подсказка утверждала «форма открылась в новой
   * вкладке» и отправляла агента искать несуществующее окно.
   */
  const steps = [
    autofills ? labels.form : labels.formSelf,
    autofills ? labels.fill : labels.manual,
    labels.photos,
    labels.publish,
  ];

  return (
    <dialog
      ref={dialog}
      // Нажатие мимо окна закрывает его: так ведут себя все окна, и другого
      // человек от этого не ждёт.
      onClick={(event) => {
        if (event.target === dialog.current) dismiss();
      }}
      className="m-auto w-[min(30rem,92vw)] rounded-[var(--radius-card)] bg-[var(--color-surface)] p-0 text-[var(--color-text-primary)] shadow-[var(--shadow-overlay)] backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold">{labels.title}</p>
          <p className="text-[0.75rem] text-[var(--color-text-tertiary)]">{source}</p>
        </div>

        {/*
          Нумерация здесь не украшение: это порядок действий, и агент идёт
          по нему сверху вниз, пока форма ждёт в соседней вкладке.
        */}
        <ol className="flex flex-col gap-3">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--color-brand)] text-[0.6875rem] font-semibold text-white">
                {index + 1}
              </span>
              <span className="text-[0.8125rem] leading-5">{step}</span>
            </li>
          ))}
        </ol>

        <div className="flex justify-end">
          <button
            type="button"
            autoFocus
            onClick={dismiss}
            className="rounded-[var(--radius-control)] bg-[var(--color-brand)] px-4 py-2 text-xs font-medium text-white transition-[background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-[var(--color-brand-hover)] active:scale-[0.97]"
          >
            {labels.got}
          </button>
        </div>
      </div>
    </dialog>
  );
}
