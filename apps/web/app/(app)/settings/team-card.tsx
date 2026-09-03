'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge, Button, Input, Notice } from '../../_ui/primitives';
import { UserRow, type UserItem, type UserRowLabels } from './user-row';

/**
 * Карточка команды: кто ей руководит, сколько в ней людей и — по нажатию —
 * кто именно.
 *
 * СОСТАВ ЛЕЖИТ ЗДЕСЬ, А НЕ В ОБЩЕМ СПИСКЕ ЛЮДЕЙ. Агентство устроено
 * командами, и плоский список из пятнадцати фамилий не отвечает на вопрос,
 * который на самом деле задают: кто в какой команде и к кому идти с командой.
 * В общем списке остаются только те, кто не входит ни в одну команду, —
 * их иначе не видно вовсе.
 *
 * Строк здесь нет — всё приходит пропсами из словаря (правило 18).
 */

export interface TeamCardLabels extends UserRowLabels {
  members: string;
  noManager: string;
  manager: string;
  rename: string;
  deleteTeam: string;
  confirmDelete: string;
  empty: string;
}

export function TeamCard({
  team,
  currentUserId,
  canManage,
  canChangeTeam,
  roles,
  teams,
  labels,
}: {
  team: {
    id: string;
    name: string;
    managerName: string | null;
    memberCount: number;
    members: UserItem[];
  };
  currentUserId: string;
  canManage: boolean;
  canChangeTeam: boolean;
  roles: Array<{ value: string; label: string }>;
  teams: Array<{ id: string; name: string }>;
  labels: TeamCardLabels;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'idle' | 'rename' | 'delete'>('idle');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function send(method: 'PATCH' | 'DELETE', body?: unknown): Promise<void> {
    setBusy(true);
    setFailed(false);

    try {
      const response = await fetch(`/api/v1/teams/${team.id}`, {
        method,
        ...(body === undefined
          ? {}
          : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      });

      if (!response.ok) {
        setFailed(true);
        return;
      }

      setMode('idle');
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  // Строка собирается вне разметки: строковый литерал в JSX запрещён
  // правилом, потому что почти всегда означает непереведённый текст.
  const memberCountLabel = String(team.memberCount) + ' ' + labels.members;

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-sm font-medium">{team.name}</p>
          <p className="truncate text-xs text-[var(--color-text-secondary)]">
            {/* Имя руководителя — то, ради чего список команд вообще читают:
                по нему понятно, к кому идти с вопросом по команде. */}
            {team.managerName === null
              ? labels.noManager
              : `${labels.manager}: ${team.managerName}`}
          </p>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <Badge tone="neutral">{memberCountLabel}</Badge>

          {canManage ? (
            <>
              <Button tone="ghost" size="sm" type="button" onClick={() => setMode('rename')}>
                {labels.rename}
              </Button>
              {mode === 'delete' ? (
                <>
                  <Button
                    tone="danger"
                    size="sm"
                    type="button"
                    disabled={busy}
                    onClick={() => void send('DELETE')}
                  >
                    {busy ? labels.saving : labels.confirmDelete}
                  </Button>
                  <Button tone="ghost" size="sm" type="button" onClick={() => setMode('idle')}>
                    {labels.cancel}
                  </Button>
                </>
              ) : (
                <Button tone="ghost" size="sm" type="button" onClick={() => setMode('delete')}>
                  {labels.deleteTeam}
                </Button>
              )}
            </>
          ) : null}
        </div>
      </div>

      {mode === 'rename' ? (
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const name = String(new FormData(event.currentTarget).get('name') ?? '');
            void send('PATCH', { name });
          }}
        >
          <Input name="name" defaultValue={team.name} maxLength={80} required autoFocus />
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? labels.saving : labels.submit}
          </Button>
          <Button tone="ghost" size="sm" type="button" onClick={() => setMode('idle')}>
            {labels.cancel}
          </Button>
        </form>
      ) : null}

      {failed ? (
        <div className="mt-3">
          <Notice tone="error">{labels.failed}</Notice>
        </div>
      ) : null}

      {open ? (
        <div className="mt-3 divide-y divide-[var(--color-border)] rounded-[var(--radius-card)] border border-[var(--color-border)]">
          {team.members.length === 0 ? (
            <p className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{labels.empty}</p>
          ) : (
            team.members.map((member) => (
              <UserRow
                key={member.id}
                user={member}
                isSelf={member.id === currentUserId}
                canManage={canManage}
                canChangeTeam={canChangeTeam}
                roles={roles}
                teams={teams}
                labels={labels}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
