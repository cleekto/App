import { listTeams, listUsers, permissionScope } from '@kleekto/core';
import { LOCALES, translate } from '@kleekto/i18n';

import { contextLocale, requireContext } from '../../_lib/session';
import { Card, EmptyState, PageHeader, SectionHeader } from '../../_ui/primitives';
import { ChangePasswordForm, NewTeamForm, NewUserForm } from './forms';
import { TeamCard } from './team-card';
import { UserRow } from './user-row';

/**
 * Настройки: аккаунт, команды, люди.
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
  // Удаление команды — право администратора. У менеджера его нет, и кнопка
  // ему не показывается: она вела бы в гарантированный отказ.
  const canDeleteTeams = permissionScope(ctx.role, 'team', 'delete') !== null;

  // Запрашивается только то, что человеку положено: обращение за списком,
  // на который нет права, вернуло бы отказ и уронило бы страницу целиком.
  const [teams, users] = await Promise.all([
    canManageTeams || canCreateUsers ? listTeams(ctx) : Promise.resolve([]),
    canCreateUsers ? listUsers(ctx) : Promise.resolve([]),
  ]);

  /**
   * В общем списке — ТОЛЬКО ТЕ, КТО НЕ В КОМАНДЕ.
   *
   * Агентство устроено командами, и плоский список из пятнадцати фамилий
   * не отвечает на вопрос, который на самом деле задают: кто в какой команде.
   * Состав команды раскрывается на её карточке. А человек без команды иначе
   * не виден нигде — и это как раз тот, кого надо заметить: он не может
   * ни импортировать, ни получить объект.
   */
  const unassigned = users.filter((user) => user.teamId === null);

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

  const teamOptions = teams.map((team) => ({ id: team.id, name: team.name }));

  const rowLabels = {
    ...formLabels,
    edit: t('settings.edit'),
    deactivate: t('settings.deactivate'),
    activate: t('settings.activate'),
    confirmDeactivate: t('settings.confirmDeactivate'),
    inactive: t('settings.inactive'),
    fullName: t('settings.fullName'),
    role: t('settings.role'),
    team: t('settings.team'),
    noTeam: t('settings.noTeam'),
    phone: t('settings.phone'),
    noPhone: t('settings.noPhone'),
    publishesAs: t('settings.publishesAs'),
  };

  return (
    <div className="flex max-w-6xl flex-col gap-10">
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
                <TeamCard
                  key={team.id}
                  team={team}
                  currentUserId={ctx.userId}
                  canManage={canCreateUsers}
                  canDeleteTeam={canDeleteTeams}
                  canChangeTeam={canChangeTeam}
                  roles={assignableRoles}
                  teams={teamOptions}
                  labels={{
                    ...rowLabels,
                    members: t('settings.members'),
                    manager: t('settings.manager'),
                    noManager: t('settings.noManager'),
                    rename: t('settings.rename'),
                    deleteTeam: t('settings.deleteTeam'),
                    confirmDelete: t('settings.confirmDeleteTeam'),
                    empty: t('settings.teamEmpty'),
                    reasons: {
                      team_has_properties: t('settings.teamHasProperties'),
                      team_has_members: t('settings.teamHasMembers'),
                    },
                  }}
                />
              ))}
            </Card>
          )}
        </section>
      ) : null}

      {/* ── Люди вне команд ──────────────────────────────────────────────── */}
      {canCreateUsers ? (
        <section className="flex flex-col gap-4">
          <SectionHeader
            title={t('settings.unassigned')}
            hint={t('settings.unassignedHint')}
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
                  phone: t('settings.phone'),
                  phoneHint: t('settings.phoneHint'),
                }}
                roles={assignableRoles}
                teams={teamOptions}
                locales={localeOptions}
              />
            }
          />

          {unassigned.length === 0 ? (
            <EmptyState title={t('settings.everyoneInTeams')} hint={t('settings.unassignedHint')} />
          ) : (
            <Card className="divide-y divide-[var(--color-border)]">
              {unassigned.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isSelf={user.id === ctx.userId}
                  canManage={canCreateUsers}
                  canChangeTeam={canChangeTeam}
                  roles={assignableRoles}
                  teams={teamOptions}
                  labels={rowLabels}
                />
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
