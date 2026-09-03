'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge, Button, Field, Input, Notice, Select } from '../../_ui/primitives';

/**
 * Карточка сотрудника: кто он, под каким номером публикует и что с ним
 * можно сделать.
 *
 * РАБОЧИЙ ТЕЛЕФОН СТОИТ ЗДЕСЬ, а не в отдельном разделе. Объявление выходит
 * под именем и номером сотрудника, и руководитель должен видеть их, не
 * переходя никуда: неверный номер в объявлении стоит дороже, чем лишняя
 * строка в списке.
 *
 * Строк здесь нет — всё приходит пропсами из словаря (правило 18).
 */

export interface UserItem {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  phone: string | null;
  teamId: string | null;
  teamName: string | null;
}

export interface UserRowLabels {
  submit: string;
  cancel: string;
  saving: string;
  failed: string;
  edit: string;
  deactivate: string;
  activate: string;
  confirmDeactivate: string;
  inactive: string;
  fullName: string;
  role: string;
  team: string;
  noTeam: string;
  phone: string;
  noPhone: string;
  publishesAs: string;
}

const ROLE_TONE = {
  ADMIN: 'brand',
  MANAGER: 'success',
  AGENT: 'neutral',
} as const;

export function UserRow({
  user,
  isSelf,
  canManage,
  canChangeTeam,
  roles,
  teams,
  labels,
}: {
  user: UserItem;
  /**
   * Свою карточку нельзя ни отключить, ни понизить — это запрещено и на
   * сервере. Кнопки прячутся, чтобы человек не упирался в отказ там,
   * где ответ известен заранее.
   */
  isSelf: boolean;
  canManage: boolean;
  /**
   * Перекладывать людей между командами может только тот, чья область —
   * вся компания. У менеджера область — своя команда, и сервер такой перевод
   * отклонит; поле показывается, но не трогается.
   */
  canChangeTeam: boolean;
  roles: Array<{ value: string; label: string }>;
  teams: Array<{ id: string; name: string }>;
  labels: UserRowLabels;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function send(method: 'PATCH' | 'DELETE', body?: Record<string, unknown>): Promise<void> {
    setBusy(true);
    setFailed(false);

    try {
      const response = await fetch(`/api/v1/users/${user.id}`, {
        method,
        ...(body === undefined
          ? {}
          : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      });

      if (!response.ok) {
        setFailed(true);
        return;
      }

      setEditing(false);
      setConfirming(false);
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form
        className="appear flex flex-col gap-4 px-4 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const teamId = String(form.get('teamId') ?? '');

          void send('PATCH', {
            fullName: String(form.get('fullName') ?? ''),
            role: String(form.get('role') ?? ''),
            // Пустая строка — «номера нет»: сотрудник останется, но
            // публиковать не сможет, и это видно на карточке.
            phone: String(form.get('phone') ?? '') || null,
            // Команда не отправляется вовсе, если менять её нельзя: отправить
            // текущее значение значит получить отказ на ровном месте.
            // Пустая строка означает «без команды»; схема ждёт uuid либо null.
            ...(canChangeTeam ? { teamId: teamId === '' ? null : teamId } : {}),
          });
        }}
      >
        {failed ? <Notice tone="error">{labels.failed}</Notice> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={labels.fullName}>
            <Input name="fullName" defaultValue={user.fullName} required autoFocus />
          </Field>

          <Field label={labels.phone}>
            <Input name="phone" defaultValue={user.phone ?? ''} inputMode="tel" />
          </Field>

          <Field label={labels.role}>
            {/* Свою роль не меняет никто: единственный админ, понизивший
                себя, запер бы компанию. Сервер это запрещает, здесь поле
                просто недоступно. */}
            <Select name="role" defaultValue={user.role} disabled={isSelf}>
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={labels.team}>
            <Select name="teamId" defaultValue={user.teamId ?? ''} disabled={!canChangeTeam}>
              <option value="">{labels.noTeam}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? labels.saving : labels.submit}
          </Button>
          <Button tone="ghost" size="sm" type="button" onClick={() => setEditing(false)}>
            {labels.cancel}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-medium">
          <span className={user.isActive ? '' : 'text-[var(--color-text-tertiary)] line-through'}>
            {user.fullName}
          </span>
          {user.isActive ? null : <Badge tone="neutral">{labels.inactive}</Badge>}
        </p>

        <p className="truncate text-xs text-[var(--color-text-secondary)]">{user.email}</p>

        {/* Под этим именем и номером выходят объявления. Пустой номер —
            не ошибка, а состояние: публиковать такой сотрудник пока не может,
            и лучше увидеть это здесь, чем на форме размещения. */}
        <p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">
          {user.phone === null
            ? labels.noPhone
            : `${labels.publishesAs}: ${user.fullName} · ${user.phone}`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {user.teamName === null ? null : (
          <span className="text-xs text-[var(--color-text-secondary)]">{user.teamName}</span>
        )}

        <Badge tone={ROLE_TONE[user.role as keyof typeof ROLE_TONE] ?? 'neutral'}>
          {user.role}
        </Badge>

        {canManage ? (
          <>
            <Button tone="ghost" size="sm" type="button" onClick={() => setEditing(true)}>
              {labels.edit}
            </Button>

            {isSelf ? null : user.isActive ? (
              confirming ? (
                <>
                  {/* Подтверждение спрашивается на месте, а не диалогом:
                      отключение обратимо, и модальное окно ради него —
                      лишняя остановка (DESIGN §36). */}
                  <Button
                    tone="danger"
                    size="sm"
                    type="button"
                    disabled={busy}
                    onClick={() => void send('DELETE')}
                  >
                    {busy ? labels.saving : labels.confirmDeactivate}
                  </Button>
                  <Button tone="ghost" size="sm" type="button" onClick={() => setConfirming(false)}>
                    {labels.cancel}
                  </Button>
                </>
              ) : (
                <Button tone="ghost" size="sm" type="button" onClick={() => setConfirming(true)}>
                  {labels.deactivate}
                </Button>
              )
            ) : (
              <Button
                tone="secondary"
                size="sm"
                type="button"
                disabled={busy}
                onClick={() => void send('PATCH', { isActive: true })}
              >
                {labels.activate}
              </Button>
            )}
          </>
        ) : null}
      </div>

      {failed ? (
        <div className="w-full">
          <Notice tone="error">{labels.failed}</Notice>
        </div>
      ) : null}
    </div>
  );
}
