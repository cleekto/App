'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { failureText } from '../../_ui/failure';
import { Button, Notice } from '../../_ui/primitives';
import { notifyError } from '../../_ui/toast';
import { FactFields, readFacts, type FactLabels, type FactValues } from './fact-fields';

/**
 * Правка объекта — из карточки, из списка и с доски.
 *
 * ОДНА ФОРМА НА ТРИ МЕСТА. Агент правит объект там, где его увидел: заметил
 * на доске неверную цену — исправил на доске, не уходя со страницы и не теряя
 * из виду остальные карточки. Отдельная страница правки заставляла бы
 * возвращаться и заново искать место, где он был.
 *
 * ОКНО — НАСТОЯЩИЙ `dialog`, а не div с фоном. Оно само перехватывает фокус,
 * само закрывается по Escape и само делает остальную страницу недоступной
 * для чтения с экрана. Всё это пришлось бы писать руками, и почти наверняка
 * хуже.
 *
 * ЗНАЧЕНИЯ БЕРУТСЯ ПРИ ОТКРЫТИИ, А НЕ ИЗ СПИСКА. Причина не в свежести,
 * а в сохранности: форма отправляет ВСЕ поля разом, и то, чего в списке нет
 * — санузел, кадастровый код, состояние ремонта, — ушло бы пустым и стёрло
 * бы записанное. Список этих полей не возит и возить не должен.
 *
 * Поля — общие с формой заведения (`fact-fields`): состав повторяет формы
 * размещения ss.ge и myhome.ge, чтобы объект годился для публикации без
 * дозаполнения.
 */

export interface EditPropertyLabels extends FactLabels {
  trigger: string;
  title: string;
  submit: string;
  cancel: string;
  saving: string;
  loading: string;
  failed: string;
}

export function EditProperty({
  propertyId,
  labels,
  types,
  transactions,
  compact = false,
}: {
  propertyId: string;
  labels: EditPropertyLabels;
  types: Array<{ value: string; label: string }>;
  transactions: Array<{ value: string; label: string }>;
  /** Компактный вид — для строки списка и карточки на доске. */
  compact?: boolean;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<FactValues | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /*
   * Окно открывается через `showModal`, а не атрибутом `open` в разметке:
   * атрибут рисует окно НЕмодальным, и страница за ним остаётся доступной
   * и с клавиатуры, и для чтения с экрана.
   */
  useEffect(() => {
    const node = dialog.current;
    if (node === null) return;

    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let stopped = false;
    setFailed(null);

    void (async () => {
      try {
        const response = await fetch(`/api/v1/properties/${propertyId}`, { cache: 'no-store' });
        if (stopped) return;

        if (!response.ok) {
          setFailed(labels.failed);
          return;
        }

        setValues((await response.json()) as FactValues);
      } catch {
        if (!stopped) setFailed(labels.failed);
      }
    })();

    return () => {
      stopped = true;
    };
  }, [open, propertyId, labels.failed]);

  const save = async (form: FormData): Promise<void> => {
    setBusy(true);
    setFailed(null);

    try {
      const response = await fetch(`/api/v1/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(readFacts(form)),
      });

      if (!response.ok) {
        const text = await failureText(response, {}, labels.failed);
        setFailed(text);
        notifyError(text);
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setFailed(labels.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          // Карточка на доске и строка списка — это ссылки. Без остановки
          // всплытия нажатие на «изменить» открывало бы объект вместо формы.
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        className={
          compact
            ? /*
               * `min-h-6` — не украшение, а норма попадания: было 21 пиксель
               * при минимуме 24. Кнопка стоит в строке списка и на карточке
               * доски, то есть в двух самых частых местах, и на телефоне
               * в неё приходилось целиться.
               *
               * `active:scale` — отклик на нажатие, как у остальных кнопок:
               * половина откликается, половина молчит — заметнее, чем
               * отсутствие эффекта у всех.
               */
              'inline-flex min-h-6 shrink-0 items-center rounded-[var(--radius-pill)] px-2.5 text-[0.6875rem] font-medium text-[var(--color-text-tertiary)] transition-[background-color,color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.97] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-brand-text)]'
            : 'rounded-[var(--radius-control)] border border-[var(--color-border-field)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium transition-[background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.97] hover:bg-[var(--color-surface-muted)]'
        }
      >
        {labels.trigger}
      </button>

      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        // Нажатие мимо окна закрывает его: так ведут себя все окна, и другого
        // человек от этого не ждёт.
        onClick={(event) => {
          if (event.target === dialog.current) setOpen(false);
        }}
        className="m-auto w-[min(46rem,92vw)] rounded-[var(--radius-card)] bg-[var(--color-surface)] p-0 text-[var(--color-text)] shadow-[var(--shadow-overlay)] backdrop:bg-black/40"
      >
        {/* Содержимое рисуется только у открытого окна: иначе на странице
            со списком из двадцати объектов висело бы двадцать форм, и каждая
            сходила бы за своими значениями. */}
        {!open ? null : values === null ? (
          <p className="p-5 text-sm text-[var(--color-text-secondary)]">
            {failed ?? labels.loading}
          </p>
        ) : (
          <form
            className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void save(new FormData(event.currentTarget));
            }}
          >
            <p className="text-sm font-semibold">{labels.title}</p>

            {failed === null ? null : <Notice tone="error">{failed}</Notice>}

            <FactFields labels={labels} types={types} transactions={transactions} values={values} />

            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? labels.saving : labels.submit}
              </Button>
              <Button tone="ghost" size="sm" type="button" onClick={() => setOpen(false)}>
                {labels.cancel}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
