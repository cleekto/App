'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { failureText } from '../../_ui/failure';
import { Button, Field, Input, Notice, Select } from '../../_ui/primitives';
import { notifyError } from '../../_ui/toast';

/**
 * Заведение объекта руками.
 *
 * ИСКЛЮЧЕНИЕ ИЗ ПРАВИЛА 0, названное самим правилом: обычно объект
 * появляется по «Согласен» из расширения, но собственник приходит и в офис, а контакт
 * передаёт коллега. Объявления за таким объектом не существует, а объект
 * существует.
 *
 * Строк здесь нет — всё приходит пропсами из словаря (правило 18).
 */

export interface NewPropertyLabels {
  trigger: string;
  submit: string;
  cancel: string;
  saving: string;
  failed: string;

  ownerName: string;
  ownerPhone: string;
  ownerPhoneHint: string;

  transactionType: string;
  propertyType: string;
  rooms: string;
  area: string;
  floor: string;
  totalFloors: string;
  district: string;
  address: string;
  price: string;
  currency: string;

  duplicateTitle: string;
  duplicateHint: string;
  openExisting: string;
  createAnyway: string;
}

interface DuplicateMatch {
  propertyId: string;
  preview: { address: string | null; area: number | null; rooms: number | null };
}

/** Число из формы: пустое поле — это «не указано», а не ноль. */
function optionalNumber(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? '').trim();
  if (text === '') return null;

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalText(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? '').trim();
  return text === '' ? null : text;
}

export function NewProperty({
  labels,
  types,
  transactions,
  currencies,
}: {
  labels: NewPropertyLabels;
  types: Array<{ value: string; label: string }>;
  transactions: Array<{ value: string; label: string }>;
  currencies: readonly string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);

  const close = (): void => {
    setOpen(false);
    setDuplicates(null);
    setDraft(null);
    setFailed(null);
  };

  async function submit(body: Record<string, unknown>): Promise<void> {
    setBusy(true);
    setFailed(null);

    try {
      const response = await fetch('/api/v1/properties', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await failureText(response, {}, labels.failed);
        setFailed(text);
        notifyError(text);
        return;
      }

      const result = (await response.json()) as {
        result: 'created' | 'duplicate';
        propertyId: string | null;
        matches: DuplicateMatch[];
      };

      // Дубль — не ошибка формы: объект не создан, но всё введённое цело,
      // и агент решает сам. Черновик держится в состоянии, чтобы «всё равно
      // завести» не требовало набирать заново.
      if (result.result === 'duplicate') {
        setDuplicates(result.matches);
        setDraft(body);
        return;
      }

      close();
      if (result.propertyId !== null) router.push(`/properties/${result.propertyId}`);
      else router.refresh();
    } catch {
      setFailed(labels.failed);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button tone="secondary" size="sm" type="button" onClick={() => setOpen(true)}>
        {labels.trigger}
      </Button>
    );
  }

  if (duplicates !== null && draft !== null) {
    return (
      <div className="appear flex w-full flex-col gap-3">
        <Notice tone="error">{labels.duplicateTitle}</Notice>
        <p className="text-[0.8125rem] text-[var(--color-text-secondary)]">
          {labels.duplicateHint}
        </p>

        <ul className="flex flex-col gap-1">
          {duplicates.map((match) => (
            <li key={match.propertyId}>
              <a
                href={`/properties/${match.propertyId}`}
                className="block rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] px-3 py-2 text-[0.8125rem]"
              >
                {[
                  match.preview.address,
                  match.preview.rooms === null ? null : String(match.preview.rooms),
                  match.preview.area === null ? null : String(match.preview.area),
                ]
                  .filter((part) => part !== null && part !== '')
                  .join(' · ')}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2">
          <Button
            tone="secondary"
            size="sm"
            type="button"
            disabled={busy}
            onClick={() => {
              void submit({
                ...draft,
                acknowledgedDuplicateOf: duplicates.map((match) => match.propertyId),
              });
            }}
          >
            {busy ? labels.saving : labels.createAnyway}
          </Button>
          <Button tone="ghost" size="sm" type="button" onClick={close}>
            {labels.cancel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="appear flex w-full flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);

        void submit({
          owner: {
            name: optionalText(form.get('ownerName')),
            phone: String(form.get('ownerPhone') ?? ''),
          },
          transactionType: String(form.get('transactionType') ?? ''),
          propertyType: String(form.get('propertyType') ?? ''),
          rooms: optionalNumber(form.get('rooms')),
          areaTotal: optionalNumber(form.get('areaTotal')),
          floor: optionalNumber(form.get('floor')),
          totalFloors: optionalNumber(form.get('totalFloors')),
          district: optionalText(form.get('district')),
          addressRaw: optionalText(form.get('addressRaw')),
          price: optionalNumber(form.get('price')),
          currency: optionalText(form.get('currency')),
        });
      }}
    >
      {failed === null ? null : <Notice tone="error">{failed}</Notice>}

      {/* Собственник стоит первым: без телефона объект не заводится,
          и узнать об этом в конце длинной формы — худшее из возможного. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={labels.ownerPhone} hint={labels.ownerPhoneHint}>
          <Input name="ownerPhone" inputMode="tel" required autoFocus />
        </Field>

        <Field label={labels.ownerName}>
          <Input name="ownerName" autoComplete="off" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={labels.transactionType}>
          <Select name="transactionType" defaultValue="SALE">
            {transactions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={labels.propertyType}>
          <Select name="propertyType" defaultValue="APARTMENT">
            {types.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={labels.address}>
          <Input name="addressRaw" autoComplete="off" />
        </Field>

        <Field label={labels.district}>
          <Input name="district" autoComplete="off" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Field label={labels.rooms}>
          <Input name="rooms" inputMode="numeric" />
        </Field>
        <Field label={labels.area}>
          <Input name="areaTotal" inputMode="decimal" />
        </Field>
        <Field label={labels.floor}>
          <Input name="floor" inputMode="numeric" />
        </Field>
        <Field label={labels.totalFloors}>
          <Input name="totalFloors" inputMode="numeric" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={labels.price}>
          <Input name="price" inputMode="decimal" />
        </Field>

        <Field label={labels.currency}>
          <Select name="currency" defaultValue={currencies[0]}>
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? labels.saving : labels.submit}
        </Button>
        <Button tone="ghost" size="sm" type="button" onClick={close}>
          {labels.cancel}
        </Button>
      </div>
    </form>
  );
}
