'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { Button, Field, Input, Notice, Select } from '../../_ui/primitives';
import { PasswordInput } from '../../_ui/password-input';

/**
 * Формы настроек: команда, человек, профиль публикации.
 *
 * ПОЧЕМУ ФОРМА РАСКРЫВАЕТСЯ ПО КНОПКЕ, А НЕ ВИСИТ ВСЕГДА. Настройки читают
 * чаще, чем меняют: обычный заход сюда — посмотреть, кто в какой команде.
 * Развёрнутая форма на каждый раздел превратила бы страницу в анкету
 * (DESIGN §35: не гнать человека через лишние диалоги, но и не показывать
 * лишнего).
 *
 * Строк здесь нет — всё приходит пропсами из словаря (правило 18).
 */

interface Labels {
  submit: string;
  cancel: string;
  saving: string;
  failed: string;
  showPassword: string;
  hidePassword: string;
}

/** Общая оболочка: кнопка «добавить», раскрытие, отправка, ошибка. */
function Disclosure({
  trigger,
  labels,
  endpoint,
  body,
  children,
  onDone,
}: {
  trigger: string;
  labels: Labels;
  endpoint: string;
  body: (form: FormData) => Record<string, unknown>;
  children: ReactNode;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!open) {
    return (
      <Button tone="secondary" size="sm" type="button" onClick={() => setOpen(true)}>
        {trigger}
      </Button>
    );
  }

  return (
    <form
      className="flex w-full flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);

        setBusy(true);
        setFailed(false);

        void fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body(data)),
        })
          .then((response) => {
            if (!response.ok) {
              setFailed(true);
              return;
            }
            setOpen(false);
            onDone?.();
            router.refresh();
          })
          .catch(() => setFailed(true))
          .finally(() => setBusy(false));
      }}
    >
      {failed ? <Notice tone="error">{labels.failed}</Notice> : null}

      {children}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? labels.saving : labels.submit}
        </Button>
        <Button tone="ghost" size="sm" type="button" onClick={() => setOpen(false)}>
          {labels.cancel}
        </Button>
      </div>
    </form>
  );
}

export function NewTeamForm({
  labels,
  fields,
}: {
  labels: Labels & { trigger: string };
  fields: { name: string };
}) {
  return (
    <Disclosure
      trigger={labels.trigger}
      labels={labels}
      endpoint="/api/v1/teams"
      body={(form) => ({ name: String(form.get('name') ?? '') })}
    >
      <Field label={fields.name}>
        <Input name="name" required autoFocus />
      </Field>
    </Disclosure>
  );
}

export function NewUserForm({
  labels,
  fields,
  roles,
  teams,
  locales,
}: {
  labels: Labels & { trigger: string };
  fields: {
    fullName: string;
    email: string;
    password: string;
    passwordHint: string;
    role: string;
    team: string;
    noTeam: string;
    locale: string;
    phone: string;
    phoneHint: string;
  };
  roles: Array<{ value: string; label: string }>;
  teams: Array<{ id: string; name: string }>;
  locales: Array<{ value: string; label: string }>;
}) {
  return (
    <Disclosure
      trigger={labels.trigger}
      labels={labels}
      endpoint="/api/v1/users"
      body={(form) => {
        const teamId = String(form.get('teamId') ?? '');
        return {
          fullName: String(form.get('fullName') ?? ''),
          email: String(form.get('email') ?? ''),
          password: String(form.get('password') ?? ''),
          role: String(form.get('role') ?? ''),
          locale: String(form.get('locale') ?? ''),
          // Пустая строка — «номера пока нет». Такой сотрудник заведётся,
          // но публиковать не сможет, и это честнее, чем требовать номер
          // в момент, когда его ещё не спросили.
          phone: String(form.get('phone') ?? '') || null,
          // Пустая строка означает «без команды». Отправлять её как есть
          // нельзя: схема ждёт uuid либо null.
          teamId: teamId === '' ? null : teamId,
        };
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={fields.fullName}>
          <Input name="fullName" required autoFocus />
        </Field>

        <Field label={fields.email}>
          <Input name="email" type="email" required autoComplete="off" />
        </Field>

        <Field label={fields.phone} hint={fields.phoneHint}>
          <Input name="phone" inputMode="tel" autoComplete="off" />
        </Field>

        <Field label={fields.password} hint={fields.passwordHint}>
          <PasswordInput
            name="password"
            required
            minLength={12}
            autoComplete="new-password"
            showLabel={labels.showPassword}
            hideLabel={labels.hidePassword}
          />
        </Field>

        <Field label={fields.role}>
          <Select name="role" defaultValue="AGENT">
            {roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={fields.team}>
          <Select name="teamId" defaultValue={teams[0]?.id ?? ''}>
            <option value="">{fields.noTeam}</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={fields.locale}>
          <Select name="locale" defaultValue="ka">
            {locales.map((locale) => (
              <option key={locale.value} value={locale.value}>
                {locale.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Disclosure>
  );
}

export function ChangePasswordForm({
  labels,
  fields,
}: {
  labels: Labels & { trigger: string };
  fields: { currentPassword: string; newPassword: string; newPasswordHint: string };
}) {
  return (
    <Disclosure
      trigger={labels.trigger}
      labels={labels}
      endpoint="/api/v1/auth/password"
      body={(form) => ({
        currentPassword: String(form.get('currentPassword') ?? ''),
        newPassword: String(form.get('newPassword') ?? ''),
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={fields.currentPassword}>
          <PasswordInput
            name="currentPassword"
            required
            autoFocus
            autoComplete="current-password"
            showLabel={labels.showPassword}
            hideLabel={labels.hidePassword}
          />
        </Field>

        <Field label={fields.newPassword} hint={fields.newPasswordHint}>
          <PasswordInput
            name="newPassword"
            required
            minLength={12}
            autoComplete="new-password"
            showLabel={labels.showPassword}
            hideLabel={labels.hidePassword}
          />
        </Field>
      </div>
    </Disclosure>
  );
}
