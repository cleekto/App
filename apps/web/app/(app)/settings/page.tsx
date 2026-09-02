import { listPublishProfiles, listTeams, listUsers } from '@cleekto/core';
import { LOCALES, translate } from '@cleekto/i18n';

import { contextLocale, requireContext } from '../../_lib/session';
import { Badge, Card, EmptyState, PageHeader, SectionHeader } from '../../_ui/primitives';
import { NewProfileForm, NewTeamForm, NewUserForm } from './forms';

/**
 * Настройки: команды, люди, профили публикации.
 *
 * До фазы 8 страница только показывала. Это выяснилось на первом же настоящем
 * развёртывании: регистрация создаёт компанию и администратора, но
 * администратор не в команде, а импорт требует команды — и завести её было
 * можно только запросом к API. Владелец агентства в API не пойдёт.
 */

const ROLE_TONE = {
  ADMIN: 'brand',
  MANAGER: 'success',
  AGENT: 'neutral',
} as const;

const LOCALE_LABELS: Record<string, string> = {
  ka: 'ქართული',
  en: 'English',
  ru: 'Русский',
};

export default async function SettingsPage() {
  const ctx = await requireContext();
  const locale = contextLocale(ctx);

  const [profiles, teams, users] = await Promise.all([
    listPublishProfiles(ctx),
    listTeams(ctx),
    listUsers(ctx),
  ]);

  const t = (key: Parameters<typeof translate>[1]): string => translate(locale, key);

  const formLabels = {
    submit: t('common.save'),
    cancel: t('common.cancel'),
    saving: t('common.loading'),
    failed: t('settings.failed'),
  };

  return (
    <div className="flex max-w-4xl flex-col gap-10">
      <PageHeader title={t('settings.title')} />

      {/* ── Команды ──────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <SectionHeader
          title={t('settings.teams')}
          hint={t('settings.teamsHint')}
          action={
            <NewTeamForm
              labels={{ ...formLabels, trigger: t('settings.addTeam') }}
              fields={{ name: t('settings.teamName') }}
            />
          }
        />

        {teams.length === 0 ? (
          <EmptyState title={t('settings.noTeams')} hint={t('settings.teamsHint')} />
        ) : (
          <Card className="divide-y divide-[var(--color-border)]">
            {teams.map((team) => (
              <div key={team.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="text-sm font-medium">{team.name}</span>
                <span className="text-sm text-[var(--color-text-secondary)]">
                  {String(team.memberCount)} {t('settings.members')}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>

      {/* ── Люди ─────────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <SectionHeader
          title={t('settings.users')}
          hint={t('settings.usersHint')}
          action={
            <NewUserForm
              labels={{ ...formLabels, trigger: t('settings.addUser') }}
              fields={{
                fullName: t('settings.fullName'),
                email: t('auth.email'),
                password: t('settings.password'),
                passwordHint: t('settings.passwordHint'),
                role: t('settings.role'),
                team: t('settings.team'),
                noTeam: t('settings.noTeam'),
                locale: t('settings.language'),
              }}
              roles={[
                { value: 'AGENT', label: t('settings.roles.agent') },
                { value: 'MANAGER', label: t('settings.roles.manager') },
                { value: 'ADMIN', label: t('settings.roles.admin') },
              ]}
              teams={teams.map((team) => ({ id: team.id, name: team.name }))}
              locales={LOCALES.map((value) => ({ value, label: LOCALE_LABELS[value] ?? value }))}
            />
          }
        />

        <Card className="divide-y divide-[var(--color-border)]">
          {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.fullName}</p>
                <p className="truncate text-xs text-[var(--color-text-secondary)]">{user.email}</p>
              </div>
              <Badge tone={ROLE_TONE[user.role as keyof typeof ROLE_TONE] ?? 'neutral'}>
                {user.role}
              </Badge>
            </div>
          ))}
        </Card>

        {/*
          Замечание про администратора без команды стоит здесь, а не в общей
          подсказке раздела: оно нужно ровно в тот момент, когда человек
          смотрит на список и не понимает, почему у него ничего не работает.
        */}
        <p className="text-xs text-[var(--color-text-secondary)]">{t('settings.noTeamHint')}</p>
      </section>

      {/* ── Профили публикации ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <SectionHeader
          title={t('settings.profiles')}
          hint={t('settings.profilesHint')}
          action={
            <NewProfileForm
              labels={{ ...formLabels, trigger: t('settings.addProfile') }}
              fields={{
                displayName: t('settings.displayName'),
                phone: t('settings.phone'),
                makeDefault: t('settings.makeDefault'),
              }}
            />
          }
        />

        {profiles.length === 0 ? (
          <EmptyState title={t('settings.noProfiles')} hint={t('settings.profilesHint')} />
        ) : (
          <Card className="divide-y divide-[var(--color-border)]">
            {profiles.map((profile) => (
              <div key={profile.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{profile.displayName}</p>
                  <p className="truncate text-xs text-[var(--color-text-secondary)]">
                    {profile.phone}
                  </p>
                </div>
                {profile.isDefault ? <Badge tone="brand">{t('settings.default')}</Badge> : null}
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
