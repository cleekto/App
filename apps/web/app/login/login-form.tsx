'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Labels {
  email: string;
  password: string;
  submit: string;
  failed: string;
}

/**
 * Форма входа.
 *
 * Пароль уходит на сервер и обратно не возвращается ни в каком виде: сессия
 * приходит `httpOnly` cookie, которую эта страница прочитать не может.
 */
export function LoginForm({ labels }: { labels: Labels }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);

        setBusy(true);
        setFailed(false);

        void fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: String(form.get('email') ?? ''),
            password: String(form.get('password') ?? ''),
          }),
        })
          .then((response) => {
            if (!response.ok) {
              // Неверная почта и неверный пароль неразличимы намеренно:
              // различие подсказало бы, какие адреса заведены в системе.
              setFailed(true);
              return;
            }
            router.replace('/properties');
            router.refresh();
          })
          .catch(() => setFailed(true))
          .finally(() => setBusy(false));
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--color-text-secondary)]">{labels.email}</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--color-text-secondary)]">{labels.password}</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
        />
      </label>

      {failed ? <p className="text-sm text-[var(--color-danger)]">{labels.failed}</p> : null}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {labels.submit}
      </button>
    </form>
  );
}
