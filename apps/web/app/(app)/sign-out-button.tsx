'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Выход.
 *
 * Клиентский, потому что должен послать запрос и увести на страницу входа.
 * Cookie стирает сервер — они `httpOnly`, и скрипт до них не дотянется.
 * В этом и смысл: токен, доступный странице, вынесла бы первая же XSS.
 */
export function SignOutButton({ label }: { label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void fetch('/api/v1/auth/logout', { method: 'POST' }).finally(() => {
          router.replace('/login');
          router.refresh();
        });
      }}
      className="mt-3 text-xs text-[var(--color-text-secondary)] underline underline-offset-2 hover:text-[var(--color-text-primary)] disabled:opacity-50"
    >
      {label}
    </button>
  );
}
