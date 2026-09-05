'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Avatar } from '../../_ui/accent';
import { UploadButton } from '../../_ui/upload';

/**
 * Своя фотография в настройках.
 *
 * ТОЛЬКО СВОЯ. Поставить фотографию коллеге нельзя — это не то же самое,
 * что править его карточку, и сервер такого не примет.
 *
 * Показывается сразу после выбора файла, не дожидаясь перечитывания
 * страницы: человек только что выбрал снимок и должен увидеть, что взялся
 * именно он, а не соседний.
 */
export function AvatarForm({
  name,
  currentUrl,
  labels,
}: {
  name: string;
  currentUrl: string | null;
  labels: { choose: string; busy: string; failed: string; remove: string };
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(currentUrl);

  const save = async (key: string | null): Promise<void> => {
    const response = await fetch('/api/v1/me/avatar', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ avatarKey: key }),
    });

    if (response.ok) router.refresh();
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} src={preview} size="lg" />

      <div className="flex flex-wrap items-center gap-2">
        <UploadButton
          kind="avatar"
          labels={labels}
          onUploaded={(results) => {
            const first = results[0];
            if (first === undefined) return;

            setPreview(first.previewUrl);
            void save(first.key);
          }}
        />

        {preview === null ? null : (
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              void save(null);
            }}
            className="text-xs text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-danger)]"
          >
            {labels.remove}
          </button>
        )}
      </div>
    </div>
  );
}
