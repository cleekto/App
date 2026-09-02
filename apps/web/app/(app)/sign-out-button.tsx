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
      className="rounded-[var(--radius-control)] px-2 py-1.5 text-left text-xs text-[var(--color-sidebar-fg-muted)] transition-colors hover:bg-[var(--color-sidebar-hover-bg)] hover:text-[var(--color-sidebar-fg)] disabled:opacity-50"
    >
      {label}
    </button>
  );
}
