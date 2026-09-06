import { prisma } from '@kleekto/db';
import type { Prisma } from '@kleekto/db';

import type { AuthContext } from '../auth/context';
import { permissionScope } from '../rbac/permissions';
import { requirePermission } from '../rbac/guard';

/**
 * Достижения: какое место человек занимает среди своих.
 *
 * ЗАЧЕМ ЭТО ОТДЕЛЬНО ОТ АНАЛИТИКИ. Аналитика отвечает на вопрос «что
 * происходит в агентстве» и обращена к руководителю. Достижения отвечают
 * на другой вопрос — «как у меня по сравнению с остальными», — и обращены
 * к агенту. Одни и те же числа, поставленные рядом с чужими, работают
 * иначе: сводка сообщает, рейтинг подталкивает.
 *
 * КОГО С КЕМ СРАВНИВАЕМ (решение владельца 2026-09-06):
 *   агент    — себя с коллегами по команде;
 *   менеджер — свои команды между собой в компании;
 *   админ    — видит и то, и другое.
 *
 * СРАВНЕНИЕ ШИРЕ ОБЛАСТИ ЧТЕНИЯ — И ЭТО НАМЕРЕННО. Агент видит только свои
 * объекты, но место в команде без чужих чисел не посчитать. Поэтому наружу
 * уходят ИМЕНА И ИТОГИ, а не сами объекты: узнать, что у коллеги больше
 * сделок, — не то же самое, что открыть его карточку с телефоном
 * собственника.
 */

/** Строка рейтинга: кто, сколько и на каком месте. */
export interface RankRow {
  id: string;
  name: string;
  /** Место в списке, начиная с первого. Одинаковые итоги делят место. */
  place: number;
  closedDeals: number;
  /** Сумма закрытых сделок в валюте компании. */
  closedAmount: number;
  propertiesInBase: number;
  /** Это я (или моя команда) — строку подсвечивают. */
  isMine: boolean;
}

export interface Achievements {
  /** Рейтинг людей внутри команды. Пусто — сравнивать не с кем. */
  people: RankRow[];
  /** Рейтинг команд внутри компании. Пусто — команда одна либо права уже. */
  teams: RankRow[];
  /** По какому показателю расставлены места. */
  rankedBy: 'closedDeals';
}

/** Стадия «закрыто» — та, по которой считается сделка. */
const CLOSED = 'CLOSED';

/**
 * Места по убыванию показателя.
 *
 * Одинаковые итоги делят место: двое с пятью сделками оба вторые, следующий
 * — четвёртый. Так считают везде, и всякий иной порядок читался бы
 * как ошибка.
 */
function withPlaces<T extends { closedDeals: number }>(rows: T[]): Array<T & { place: number }> {
  const sorted = [...rows].sort((a, b) => b.closedDeals - a.closedDeals);

  let place = 0;
  let previous: number | null = null;

  return sorted.map((row, index) => {
    if (previous === null || row.closedDeals !== previous) {
      place = index + 1;
      previous = row.closedDeals;
    }
    return { ...row, place };
  });
}

/** Итоги по одному срезу объектов. */
interface Totals {
  closedDeals: number;
  closedAmount: number;
  propertiesInBase: number;
}

const EMPTY_TOTALS: Totals = { closedDeals: 0, closedAmount: 0, propertiesInBase: 0 };

/**
 * Считает итоги по группам одним проходом.
 *
 * `groupBy` вместо запроса на каждого человека: в агентстве их десятки,
 * и три десятка запросов ради одной страницы — это та самая мелочь,
 * из которой складывается медленный продукт.
 */
async function totalsBy(
  field: 'assignedUserId' | 'teamId',
  where: Prisma.PropertyWhereInput,
  closedStatusIds: string[],
): Promise<Map<string, Totals>> {
  const [all, closed] = await Promise.all([
    prisma.property.groupBy({ by: [field], where, _count: { _all: true } }),
    prisma.property.groupBy({
      by: [field],
      where: { ...where, pipelineStatusId: { in: closedStatusIds } },
      _count: { _all: true },
      _sum: { price: true },
    }),
  ]);

  const totals = new Map<string, Totals>();

  for (const row of all) {
    const key = row[field];
    if (key === null) continue;
    totals.set(key, { ...EMPTY_TOTALS, propertiesInBase: row._count._all });
  }

  for (const row of closed) {
    const key = row[field];
    if (key === null) continue;
    const current = totals.get(key) ?? { ...EMPTY_TOTALS };
    totals.set(key, {
      ...current,
      closedDeals: row._count._all,
      closedAmount: Number(row._sum.price ?? 0),
    });
  }

  return totals;
}

export async function achievements(ctx: AuthContext): Promise<Achievements> {
  requirePermission(ctx, 'property', 'read');

  const closedStatuses = await prisma.pipelineStatus.findMany({
    where: { companyId: ctx.companyId, code: CLOSED },
    select: { id: true },
  });
  const closedStatusIds = closedStatuses.map((status) => status.id);

  const scope = permissionScope(ctx.role, 'property', 'read');

  /*
   * РЕЙТИНГ ЛЮДЕЙ — внутри своей команды, и только для того, у кого команда
   * есть. Администратор без команды сравнивать себя не с кем: он не ведёт
   * объекты, а смотрит за всеми.
   */
  const people: RankRow[] = [];
  if (ctx.teamId !== null) {
    const members = await prisma.teamMember.findMany({
      where: { teamId: ctx.teamId, companyId: ctx.companyId },
      include: { user: { select: { id: true, fullName: true, isActive: true } } },
    });

    const totals = await totalsBy(
      'assignedUserId',
      { companyId: ctx.companyId, teamId: ctx.teamId },
      closedStatusIds,
    );

    people.push(
      ...withPlaces(
        members
          .filter((member) => member.user.isActive)
          .map((member) => ({
            id: member.user.id,
            name: member.user.fullName,
            isMine: member.user.id === ctx.userId,
            ...(totals.get(member.user.id) ?? EMPTY_TOTALS),
          })),
      ),
    );
  }

  /*
   * РЕЙТИНГ КОМАНД — для тех, кто отвечает не за себя. Агенту он не нужен
   * и не показывается: сравнивать команды — не его работа, а лишний экран
   * отвлекает от своей.
   */
  const teams: RankRow[] = [];
  if (scope !== 'own') {
    const allTeams = await prisma.team.findMany({
      where: { companyId: ctx.companyId },
      select: { id: true, name: true },
    });

    const totals = await totalsBy('teamId', { companyId: ctx.companyId }, closedStatusIds);

    teams.push(
      ...withPlaces(
        allTeams.map((team) => ({
          id: team.id,
          name: team.name,
          isMine: team.id === ctx.teamId,
          ...(totals.get(team.id) ?? EMPTY_TOTALS),
        })),
      ),
    );
  }

  return { people, teams, rankedBy: 'closedDeals' };
}
