import { RoleCode } from '@kleekto/db';

import type { DbClient } from '../activity/write';

/**
 * Справочник ролей — общий, а не на компанию (Q28, C-09).
 *
 * Три роли, кастомных в MVP нет. Таблица вместо перечисления в коде нужна
 * ради одного: добавить роль позже можно будет без миграции живой базы.
 */
export const ROLE_NAMES: Record<RoleCode, string> = {
  ADMIN: 'Company admin',
  MANAGER: 'Manager',
  AGENT: 'Agent',
};

/**
 * Идемпотентно создаёт справочник ролей.
 *
 * Вызывается сидом и регистрацией компании: первая компания в пустой базе
 * не должна падать из-за того, что справочник ещё не заполнен.
 */
export async function ensureRoles(db: DbClient): Promise<Record<RoleCode, string>> {
  const ids: Partial<Record<RoleCode, string>> = {};

  for (const code of Object.values(RoleCode)) {
    const role = await db.role.upsert({
      where: { code },
      update: {},
      create: { code, name: ROLE_NAMES[code] },
    });
    ids[code] = role.id;
  }

  return ids as Record<RoleCode, string>;
}
