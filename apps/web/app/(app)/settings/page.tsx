import { listPublishProfiles, listTeams, listUsers, permissionScope } from '@kleekto/core';
import { LOCALES, translate } from '@kleekto/i18n';

import { contextLocale, requireContext } from '../../_lib/session';
import { Card, EmptyState, PageHeader, SectionHeader } from '../../_ui/primitives';
import { ChangePasswordForm, NewProfileForm, NewTeamForm, NewUserForm } from './forms';
import { UserRow } from './user-row';

/**
 * Настройки: аккаунт, команды, люди, профили публикации.
 *
 * ЧТО ВИДНО — РЕШАЕТ МАТРИЦА ПРАВ, а не список ролей, выписанный здесь
 * заново. Иначе экран и сервер разъезжаются: право отзывают в матрице,
 * а кнопка остаётся и ведёт в отказ.
 *
 * Правило 6 при этом никуда не девается: прятать — не значит запрещать.
 * Запрещает сервер, здесь только убирается то, чего человеку всё равно
 * не позволят.
 */
export default async function SettingsPage() {
  const ctx = await requireContext();
  const locale = contextLocale(ctx);

  // РАЗДЕЛ ПОКАЗЫВАЕТСЯ ТОМУ, КТО МОЖЕТ В НЁМ ЧТО-ТО ИЗМЕНИТЬ. Право читать
  // список сюда не годится: агент видит коллег и в выборе ответственного,
  // но настройки компании — не его экран. У агента здесь остаётся ровно
  // одно: собственный пароль (решение владельца 2026-09-03).
  //
  // `user.update` у агента есть, но со значением `self` — поэтому право
  // на раздел «Люди» проверяется по созданию, а не по изменению.
  const usersScope = permissionScope(ctx.role, 'user', 'create');
  const canCreateUsers = usersScope !== null;
  const canCreateTeams = permissionScope(ctx.role, 'team', 'create') !== null;
  const canManageTeams = canCreateTeams || permissionScope(ctx.role, 'team', 'update') !== null;
  const canReadProfiles = permissionScope(ctx.role, 'publishProfile', 'read') !== null;
  const canCreateProfiles = permissionScope(ctx.role, 'publishProfile', 'create') !== null;

  // Запрашивается только то, что человеку положено: обращение за списком,
  // на который нет права, вернуло бы отказ и уронило бы страницу целиком.
  const [profiles, teams, users] = await Promise.all([
    canReadProfiles ? listPublishProfiles(ctx) : Promise.resolve([]),
    canManageTeams || canCreateUsers ? listTeams(ctx) : Promise.resolve([]),
    canCreateUsers ? listUsers(ctx) : Promise.resolve([]),
  ]);

  const t = (key: Parameters<typeof translate>[1]): string => translate(locale, key);

  const formLabels = {
    submit: t('common.save'),
    cancel: t('common.cancel'),
    saving: t('common.loading'),
    failed: t('settings.failed'),
    showPassword: t('common.showPassword'),
    hidePassword: t('common.hidePassword'),
  };

  const roleOptions = [
    { value: 'AGENT', label: t('settings.roles.agent') },
    { value: 'MANAGER', label: t('settings.roles.manager') },
    { value: 'ADMIN', label: t('settings.roles.admin') },
  ];

  // Менеджер и создаёт, и назначает ТОЛЬКО агентов, и держит людей в своей
  // команде (Q2) — область его права на создание равна команде, а не
  // компании. Сервер это проверяет; здесь просто не предлагаются варианты,
  // которые он отклонит: выпадающий список с заведомо отказным пунктом
  // хуже, чем список без него.
  const assignableRoles =
    usersScope === 'team' ? roleOptions.filter((role) => role.value === 'AGENT') : roleOptions;
  const canChangeTeam = usersScope === 'company';

  const localeOptions = LOCALES.map((value) => ({
    value,
    label: LOCALE_LABELS[value] ?? value,
  }));

  return (
    <div className="flex max-w-4xl flex-col gap-10">
      <PageHeader title={t('settings.title')} />

      {/* ── Аккаунт ──────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <SectionHeader
          title={t('settings.account')}
          hint={t('settings.accountHint')}
          action={
            <ChangePasswordForm
              labels={{
                ...formLabels,
                trigger: t('settings.changePassword'),
                failed: t('settings.changePasswordFailed'),
              }}
              fields={{
                currentPassword: t('settings.currentPassword'),
                newPassword: t('settings.newPassword'),
                newPasswordHint: t('settings.newPasswordHint'),
              }}
            />
          }
        />
      </section>

      {/* ── Команды ──────────────────────────────────────────────────────── */}
      {canManageTeams ? (
        <section className="flex flex-col gap-4">
          <SectionHeader
            title={t('settings.teams')}
            hint={t('settings.teamsHint')}
            action={
              canCreateTeams ? (
                <NewTeamForm
                  labels={{ ...formLabels, trigger: t('settings.addTeam') }}
                  fields={{ name: t('settings.teamName') }}
                />
              ) : undefined
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
      ) : null}

      {/* ── Люди ─────────────────────────────────────────────────────────── */}
      {canCreateUsers ? (
        <section className="flex flex-col gap-4">
          <SectionHeader
            title={t('settings.users')}
            hint={t('settings.usersHint')}
            action={
              canCreateUsers ? (
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
                  roles={assignableRoles}
                  teams={teams.map((team) => ({ id: team.id, name: team.name }))}
                  locales={localeOptions}
                />
              ) : undefined
            }
          />

          <Card className="divide-y divide-[var(--color-border)]">
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                isSelf={user.id === ctx.userId}
                canManage={canCreateUsers}
                canChangeTeam={canChangeTeam}
                roles={assignableRoles}
                teams={teams.map((team) => ({ id: team.id, name: team.name }))}
                labels={{
                  ...formLabels,
                  edit: t('settings.edit'),
                  deactivate: t('settings.deactivate'),
                  activate: t('settings.activate'),
                  confirmDeactivate: t('settings.confirmDeactivate'),
                  inactive: t('settings.inactive'),
                  noProfile: t('settings.noProfile'),
                  publishesAs: t('settings.publishesAs'),
                  fullName: t('settings.fullName'),
                  role: t('settings.role'),
                  team: t('settings.team'),
                  noTeam: t('settings.noTeam'),
                }}
              />
            ))}
          </Card>

          <p className="text-xs text-[var(--color-text-secondary)]">{t('settings.noTeamHint')}</p>
        </section>
      ) : null}

      {/* ── Профили публикации ───────────────────────────────────────────── */}
      {canReadProfiles ? (
        <section className="flex flex-col gap-4">
          <SectionHeader
            title={t('settings.profiles')}
            hint={t('settings.profilesHint')}
            action={
              canCreateProfiles ? (
                <NewProfileForm
                  labels={{ ...formLabels, trigger: t('settings.addProfile') }}
                  fields={{
                    displayName: t('settings.displayName'),
                    phone: t('settings.phone'),
                    makeDefault: t('settings.makeDefault'),
                  }}
                />
              ) : undefined
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
                  {profile.isDefault ? (
                    <span className="shrink-0 text-xs text-[var(--color-brand-text)]">
                      {t('settings.default')}
                    </span>
                  ) : null}
                </div>
              ))}
            </Card>
          )}
        </section>
      ) : null}
    </div>
  );
}

const LOCALE_LABELS: Record<string, string> = {
  ka: 'ქართული',
  en: 'English',
  ru: 'Русский',
};
