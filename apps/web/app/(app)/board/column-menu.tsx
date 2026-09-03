'use client';

import { useState } from 'react';

import { failureText } from '../../_ui/failure';
import { notifyError } from '../../_ui/toast';
import { Button, Input, Select } from '../../_ui/primitives';

/**
 * Управление одной стадией воронки: переименование, цвет, удаление.
 *
 * Раскрывается прямо в заголовке колонки, а не в модальном окне. Настройка
 * воронки — это разглядывание доски: руководитель переименовывает стадию,
 * глядя на то, что в ней лежит. Окно поверх доски закрывало бы ровно то,
 * ради чего его открыли.
 *
 * Строк здесь нет — всё приходит пропсами из словаря (правило 18).
 */

export interface ColumnMenuLabels {
  rename: string;
  stageName: string;
  color: string;
  deleteStage: string;
  moveTo: string;
  systemStage: string;
  occupied: string;
  save: string;
  cancel: string;
  confirm: string;
  saving: string;
  failed: string;
  /**
   * Отказы, у которых есть внятная причина.
   *
   * Ключ — машинный признак из деталей ошибки, значение — фраза на языке
   * человека. Сообщение самого сервера показывать нельзя: оно русское
   * (правило 18).
   */
  reasons: Record<string, string>;
  colors: Record<string, string>;
}

/**
 * Цвет стадии → токен темы.
 *
 * Список закрыт и на сервере (`STATUS_COLORS`): значение попадает в разметку,
 * и произвольная строка отсюда означала бы произвольный CSS на странице.
 *
 * Первые пять статусов сид завёл с прежними именами токенов — они остались
 * в базе действующих компаний и обязаны читаться, поэтому стоят здесь же.
 */
const COLOR_VALUE: Record<string, string> = {
  brand: 'var(--color-brand)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  neutral: 'var(--color-text-tertiary)',

  'brand-primary': 'var(--color-brand)',
  'text-secondary': 'var(--color-text-tertiary)',
};

export const SELECTABLE_COLORS = ['brand', 'success', 'warning', 'danger', 'neutral'] as const;

export function columnColor(token: string | null): string {
  return (token === null ? undefined : COLOR_VALUE[token]) ?? 'var(--color-border-strong)';
}

export function ColumnMenu({
  column,
  otherColumns,
  occupiedCount,
  labels,
  onDone,
}: {
  column: { id: string; name: string; colorToken: string | null; isSystem: boolean };
  /** Куда переносить объекты при удалении. Себя в списке нет. */
  otherColumns: Array<{ id: string; name: string }>;
  occupiedCount: number;
  labels: ColumnMenuLabels;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<'menu' | 'rename' | 'delete'>('menu');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function send(method: 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<void> {
    setBusy(true);
    setFailed(null);

    try {
      const response = await fetch(path, {
        method,
        ...(body === undefined
          ? {}
          : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      });

      if (!response.ok) {
        // Причина берётся по машинному признаку из ответа, а не из его текста:
        // текст сервера русский (правило 18). Признака нет — остаётся общая
        // фраза.
        //
        // И плашкой, и уведомлением сразу: плашка объясняет, где именно
        // не вышло, уведомление видно, даже если меню уже закрылось.
        const text = await failureText(response, labels.reasons, labels.failed);
        setFailed(text);
        notifyError(text);
        return;
      }

      onDone();
    } catch {
      setFailed(labels.failed);
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'rename') {
    return (
      <form
        className="appear flex flex-col gap-2 pt-2"
        onSubmit={(event) => {
          event.preventDefault();
          const name = String(new FormData(event.currentTarget).get('name') ?? '');
          void send('PATCH', `/api/v1/pipeline-statuses/${column.id}`, { name });
        }}
      >
        <Input name="name" defaultValue={column.name} maxLength={60} required autoFocus />

        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs text-[var(--color-text-secondary)]">{labels.color}</span>
          {SELECTABLE_COLORS.map((token) => (
            <button
              key={token}
              type="button"
              title={labels.colors[token] ?? token}
              aria-label={labels.colors[token] ?? token}
              onClick={() => {
                void send('PATCH', `/api/v1/pipeline-statuses/${column.id}`, {
                  colorToken: token,
                });
              }}
              className={`h-5 w-5 rounded-full border-2 ${
                column.colorToken === token
                  ? 'border-[var(--color-text-primary)]'
                  : 'border-transparent'
              }`}
              style={{ backgroundColor: columnColor(token) }}
            />
          ))}
        </div>

        {failed === null ? null : <p className="text-xs text-[var(--color-danger)]">{failed}</p>}

        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? labels.saving : labels.save}
          </Button>
          <Button tone="ghost" size="sm" type="button" onClick={onDone}>
            {labels.cancel}
          </Button>
        </div>
      </form>
    );
  }

  if (mode === 'delete') {
    return (
      <form
        className="appear flex flex-col gap-2 pt-2"
        onSubmit={(event) => {
          event.preventDefault();
          const moveTo = String(new FormData(event.currentTarget).get('moveTo') ?? '');
          const query = moveTo === '' ? '' : `?moveTo=${encodeURIComponent(moveTo)}`;
          void send('DELETE', `/api/v1/pipeline-statuses/${column.id}${query}`);
        }}
      >
        {/* Объекты не исчезают вместе со стадией: куда их девать — решает
            человек, а не программа за него. */}
        {occupiedCount > 0 ? (
          <>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {labels.occupied.replace('{count}', String(occupiedCount))}
            </p>
            <label className="text-xs text-[var(--color-text-secondary)]">
              {labels.moveTo}
              <Select name="moveTo" required className="mt-1 w-full">
                {otherColumns.map((other) => (
                  <option key={other.id} value={other.id}>
                    {other.name}
                  </option>
                ))}
              </Select>
            </label>
          </>
        ) : null}

        {failed === null ? null : <p className="text-xs text-[var(--color-danger)]">{failed}</p>}

        <div className="flex gap-2">
          <Button tone="danger" size="sm" type="submit" disabled={busy}>
            {busy ? labels.saving : labels.confirm}
          </Button>
          <Button tone="ghost" size="sm" type="button" onClick={onDone}>
            {labels.cancel}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="appear flex flex-col gap-1 pt-2">
      <Button tone="ghost" size="sm" type="button" onClick={() => setMode('rename')}>
        {labels.rename}
      </Button>

      {column.isSystem ? (
        // Не пропавшая кнопка, а объяснение: иначе руководитель будет искать,
        // куда она делась, и решит, что доска сломалась.
        <p className="px-2 text-xs text-[var(--color-text-tertiary)]">{labels.systemStage}</p>
      ) : (
        <Button tone="ghost" size="sm" type="button" onClick={() => setMode('delete')}>
          {labels.deleteStage}
        </Button>
      )}
    </div>
  );
}
