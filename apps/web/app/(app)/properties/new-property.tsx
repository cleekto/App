'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { UploadButton, type UploadResult } from '../../_ui/upload';

import { failureText } from '../../_ui/failure';
import { Button, Field, Input, Notice } from '../../_ui/primitives';
import { notifyError } from '../../_ui/toast';
import {
  FactFields,
  optionalText,
  readFacts,
  type FactDictionaries,
  type FactLabels,
} from './fact-fields';

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

export interface NewPropertyLabels extends FactLabels {
  trigger: string;
  photos: string;
  photoChoose: string;
  photoBusy: string;
  photoFailed: string;
  submit: string;
  cancel: string;
  saving: string;
  failed: string;

  ownerName: string;
  ownerPhone: string;
  ownerPhoneHint: string;

  duplicateTitle: string;
  duplicateHint: string;
  openExisting: string;
  createAnyway: string;
}

interface DuplicateMatch {
  propertyId: string;
  preview: { address: string | null; area: number | null; rooms: number | null };
}

export function NewProperty({
  labels,
  dictionaries,
}: {
  labels: NewPropertyLabels;
  dictionaries: FactDictionaries;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [photos, setPhotos] = useState<UploadResult[]>([]);

  const close = (): void => {
    setOpen(false);
    setDuplicates(null);
    setDraft(null);
    setFailed(null);
    setPhotos([]);
  };

  async function submit(body: Record<string, unknown>): Promise<void> {
    setBusy(true);
    setFailed(null);

    try {
      const response = await fetch('/api/v1/properties', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // Ключи, а не сами файлы: файлы уже в хранилище, сюда едут только
        // их адреса.
        body: JSON.stringify({ ...body, photoKeys: photos.map((photo) => photo.key) }),
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
          ...readFacts(form),
        });
      }}
    >
      {failed === null ? null : <Notice tone="error">{failed}</Notice>}

      {/* Собственник стоит первым: без телефона объект не заводится,
          и узнать об этом в конце длинной формы — худшее из возможного. */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Фотографии: недвижимость узнают глазами, и объект без снимка
            в списке неотличим от соседнего. Загружаются сразу, до отправки
            формы, — так агент видит, что взялись нужные. */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            {labels.photos}
          </span>

          {photos.length === 0 ? null : (
            <div className="flex flex-wrap gap-2">
              {photos.map((photo) => (
                <img
                  key={photo.key}
                  src={photo.previewUrl}
                  alt=""
                  className="size-16 rounded-[var(--radius-sm)] object-cover"
                />
              ))}
            </div>
          )}

          <UploadButton
            kind="property"
            multiple
            labels={{
              choose: labels.photoChoose,
              busy: labels.photoBusy,
              failed: labels.photoFailed,
            }}
            onUploaded={(results) => setPhotos((current) => [...current, ...results])}
          />
        </div>

        <Field label={labels.ownerPhone} hint={labels.ownerPhoneHint}>
          <Input name="ownerPhone" inputMode="tel" required autoFocus />
        </Field>

        <Field label={labels.ownerName}>
          <Input name="ownerName" autoComplete="off" />
        </Field>
      </div>

      <FactFields labels={labels} dictionaries={dictionaries} />

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
