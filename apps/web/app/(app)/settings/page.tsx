import { listPublishProfiles, listTeams, listUsers } from '@cleekto/core';
import { translate } from '@cleekto/i18n';

import { contextLocale, requireContext } from '../../_lib/session';

/**
 * Настройки: профили публикации, команды, люди.
 *
 * Пока только просмотр. Заведение профилей и пользователей уже есть в API
 * и доступно администратору и менеджеру; форма для них появится здесь же.
 * Показывать пустую форму, которая ничего не создаёт, хуже, чем не
 * показывать её вовсе.
 */
export default async function SettingsPage() {
  const ctx = await requireContext();
  const locale = contextLocale(ctx);

  const [profiles, teams, users] = await Promise.all([
    listPublishProfiles(ctx),
    listTeams(ctx),
    listUsers(ctx),
  ]);

  const t = (key: Parameters<typeof translate>[1]): string => translate(locale, key);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t('settings.title')}</h1>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold">{t('settings.profiles')}</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">{t('settings.profilesHint')}</p>
        </div>

        {profiles.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">{t('settings.noProfiles')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {profiles.map((profile) => (
              <li
                key={profile.id}
                className="flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm"
              >
                <span>{profile.displayName}</span>
                <span className="text-[var(--color-text-secondary)]">{profile.phone}</span>
                {profile.isDefault ? (
                  <span className="text-xs text-[var(--color-brand-primary)]">
                    {t('settings.default')}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">{t('settings.team')}</h2>
        <ul className="flex flex-col gap-2">
          {teams.map((team) => (
            <li
              key={team.id}
              className="flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm"
            >
              <span>{team.name}</span>
              <span className="text-[var(--color-text-secondary)]">{String(team.memberCount)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">{t('settings.users')}</h2>
        <ul className="flex flex-col gap-2">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm"
            >
              <span>{user.fullName}</span>
              <span className="text-[var(--color-text-secondary)]">{user.email}</span>
              <span className="text-xs text-[var(--color-text-secondary)]">{user.role}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
