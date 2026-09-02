'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, Field, Input, Notice } from '../_ui/primitives';
import { PasswordInput } from '../_ui/password-input';

interface Labels {
  email: string;
  password: string;
  submit: string;
  failed: string;
  busy: string;
  showPassword: string;
  hidePassword: string;
}

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
              setBusy(false);
              return;
            }
            router.replace('/properties');
            router.refresh();
            // `busy` намеренно НЕ снимается при успехе: дальше идёт переход,
            // и вернуть кнопку в исходный вид значило бы показать на долю
            // секунды форму, которая больше ничего не ждёт.
          })
          .catch(() => {
            setFailed(true);
            setBusy(false);
          });
      }}
    >
      {failed ? <Notice tone="error">{labels.failed}</Notice> : null}

      <Field label={labels.email}>
        <Input name="email" type="email" required autoComplete="username" autoFocus />
      </Field>

      <Field label={labels.password}>
        <PasswordInput
          name="password"
          required
          autoComplete="current-password"
          showLabel={labels.showPassword}
          hideLabel={labels.hidePassword}
        />
      </Field>

      <Button type="submit" disabled={busy} className="mt-2 w-full">
        {busy ? labels.busy : labels.submit}
      </Button>
    </form>
  );
}
