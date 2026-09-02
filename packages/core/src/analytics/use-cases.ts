import { Prisma, PublicationStatus, prisma } from '@kleekto/db';

import { ACTIVITY } from '../activity/actions';
import type { AuthContext } from '../auth/context';
import { requirePermission, scopeFilter } from '../rbac/guard';

/**
 * Дашборд по ролям.
 *
 * ОБЛАСТЬ ЗАДАЁТ МАТРИЦА ПРАВ, а не параметр запроса: администратор видит
 * компанию, менеджер — свою команду, агент — свою команду и себя. Показатель,
 * область которого выбирает клиент, — это утечка, оформленная как удобство.
 *
 * Все метрики считаются по УЖЕ ЗАПИСАННЫМ данным: журнал ведётся с первого
 * дня (инвариант 7), `missingFields` пишутся при импорте, `unfilledFields` —
 * при заполнении формы. Ни одного счётчика, заведённого ради дашборда.
 */

export interface Dashboard {
  scope: 'company' | 'team';
  period: { dayFrom: string; weekFrom: string };

  properties: {
    createdToday: number;
    createdThisWeek: number;
    total: number;
    byStatus: Array<{
      statusId: string;
      /**
       * Код статуса. Нужен показу: по нему подставляется перевод, потому что
       * `statusName` лежит в базе по-английски — его туда положила регистрация,
       * когда язык компании ещё не был известен (инвариант 4).
       */
      statusCode: string;
      statusName: string;
      count: number;
    }>;
  };

  /** Активность людей за неделю. Пустой список — никто ничего не сделал. */
  people: Array<{
    userId: string;
    fullName: string;
    /** Согласий за неделю — главная продуктовая метрика (§6.5). */
    consentsThisWeek: number;
    propertiesOwned: number;
  }>;

  quality: {
    /**
     * Доля попыток импорта, упёршихся в дубль.
     *
     * Высокая доля означает не поломку, а то, что команды работают по одному
     * и тому же полю: агенты звонят одним и тем же собственникам.
     */
    duplicateRate: number;
    duplicateWarnings: number;
    importAttempts: number;

    /**
     * `parser failure rate` — доля объявлений, у которых адаптер не смог
     * прочитать хотя бы одно поле.
     *
     * О смене вёрстки площадки мы должны узнавать отсюда, а не от
     * разозлённого агента (§6.5).
     */
    parserFailureRate: number;
    /** Поля, которые чаще всего не читаются. Очередь на доработку адаптера. */
    topMissingFields: Array<{ field: string; count: number }>;
  };

  publishing: {
    filledToday: number;
    filledThisWeek: number;
    publishedThisWeek: number;
    /** Доля объектов, размещённых хотя бы на одной площадке. */
    publishedShare: number;
    /** Среднее число незаполненных полей на форму. */
    averageUnfilled: number;
    /**
     * `fill failure rate` — доля заполнений, где осталось хоть одно поле.
     *
     * Частичное заполнение штатно (правило 14), поэтому сама по себе высокая
     * доля не тревожна. Тревожно, когда пустое поле одно и то же у всех:
     * см. `chronicallyUnfilled`.
     */
    fillFailureRate: number;
    /**
     * Поля, пустые почти всегда.
     *
     * Означает одно из двух: данных не хватает в CRM либо в словаре адаптера
     * дыра. И то и другое — очередь на доработку, а не фон.
     */
    chronicallyUnfilled: Array<{ field: string; count: number; share: number }>;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Ограничение по команде из уже посчитанной области.
 *
 * Область берётся из матрицы прав один раз и переиспользуется: считать её
 * заново в каждой метрике значило бы завести пять мест, где она может
 * разойтись.
 */
function teamOf(where: Prisma.PropertyWhereInput): { teamId?: string } {
  return typeof where.teamId === 'string' ? { teamId: where.teamId } : {};
}

export async function dashboard(ctx: AuthContext, now: Date = new Date()): Promise<Dashboard> {
  const scope = requirePermission(ctx, 'property', 'read');
  const where = scopeFilter(ctx, scope) as Prisma.PropertyWhereInput;

  const dayFrom = new Date(now.getTime() - DAY_MS);
  const weekFrom = new Date(now.getTime() - 7 * DAY_MS);

  const [createdToday, createdThisWeek, total, byStatusRaw] = await Promise.all([
    prisma.property.count({ where: { ...where, createdAt: { gte: dayFrom } } }),
    prisma.property.count({ where: { ...where, createdAt: { gte: weekFrom } } }),
    prisma.property.count({ where }),
    prisma.property.groupBy({
      by: ['pipelineStatusId'],
      where,
      _count: { _all: true },
    }),
  ]);

  const statusNames = await prisma.pipelineStatus.findMany({
    where: { companyId: ctx.companyId },
    select: { id: true, code: true, name: true },
    orderBy: { sortOrder: 'asc' },
  });

  const counts = new Map(byStatusRaw.map((row) => [row.pipelineStatusId, row._count._all]));

  return {
    scope: scope === 'company' ? 'company' : 'team',
    period: { dayFrom: dayFrom.toISOString(), weekFrom: weekFrom.toISOString() },

    properties: {
      createdToday,
      createdThisWeek,
      total,
      // Порядок статусов — как в воронке, а не по количеству: дашборд должен
      // читаться как воронка, иначе по нему нельзя увидеть, где затор.
      byStatus: statusNames.map((status) => ({
        statusId: status.id,
        statusCode: status.code,
        statusName: status.name,
        count: counts.get(status.id) ?? 0,
      })),
    },

    people: await peopleActivity(ctx, where, weekFrom),
    quality: await quality(ctx, where, weekFrom),
    publishing: await publishing(ctx, where, dayFrom, weekFrom, total),
  };
}

async function peopleActivity(
  ctx: AuthContext,
  where: Prisma.PropertyWhereInput,
  weekFrom: Date,
): Promise<Dashboard['people']> {
  const owned = await prisma.property.groupBy({
    by: ['assignedUserId'],
    where,
    _count: { _all: true },
  });

  const consents = await prisma.activityLog.groupBy({
    by: ['userId'],
    where: {
      companyId: ctx.companyId,
      action: ACTIVITY.OWNER_AGREED,
      createdAt: { gte: weekFrom },
      ...teamOf(where),
    },
    _count: true,
  });

  const ids = [
    ...new Set(
      [...owned.map((row) => row.assignedUserId), ...consents.map((row) => row.userId)].filter(
        (id): id is string => id !== null,
      ),
    ),
  ];
  if (ids.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: ids }, companyId: ctx.companyId },
    select: { id: true, fullName: true },
  });

  const ownedBy = new Map(owned.map((row) => [row.assignedUserId, row._count._all]));
  const consentsBy = new Map(consents.map((row) => [row.userId, row._count]));

  return users
    .map((user) => ({
      userId: user.id,
      fullName: user.fullName,
      consentsThisWeek: consentsBy.get(user.id) ?? 0,
      propertiesOwned: ownedBy.get(user.id) ?? 0,
    }))
    .sort((a, b) => b.consentsThisWeek - a.consentsThisWeek);
}

async function quality(
  ctx: AuthContext,
  where: Prisma.PropertyWhereInput,
  weekFrom: Date,
): Promise<Dashboard['quality']> {
  const teamFilter = teamOf(where);

  const [agreed, warned] = await Promise.all([
    prisma.activityLog.count({
      where: {
        companyId: ctx.companyId,
        action: ACTIVITY.OWNER_AGREED,
        createdAt: { gte: weekFrom },
        ...teamFilter,
      },
    }),
    prisma.activityLog.count({
      where: {
        companyId: ctx.companyId,
        action: ACTIVITY.IMPORT_DUPLICATE_WARNED,
        createdAt: { gte: weekFrom },
        ...teamFilter,
      },
    }),
  ]);

  const attempts = agreed + warned;

  const listings = await prisma.sourceListing.findMany({
    where: { companyId: ctx.companyId, ...teamFilter },
    select: { missingFields: true },
    take: 2000,
  });

  const withMissing = listings.filter((listing) => listing.missingFields.length > 0).length;

  const fieldCounts = new Map<string, number>();
  for (const listing of listings) {
    for (const field of listing.missingFields) {
      fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + 1);
    }
  }

  return {
    duplicateWarnings: warned,
    importAttempts: attempts,
    duplicateRate: attempts === 0 ? 0 : round(warned / attempts),
    parserFailureRate: listings.length === 0 ? 0 : round(withMissing / listings.length),
    topMissingFields: topOf(fieldCounts, 5),
  };
}

async function publishing(
  ctx: AuthContext,
  where: Prisma.PropertyWhereInput,
  dayFrom: Date,
  weekFrom: Date,
  totalProperties: number,
): Promise<Dashboard['publishing']> {
  const teamFilter = teamOf(where);
  const base = { companyId: ctx.companyId, ...teamFilter };

  const [filledToday, filledThisWeek, publishedThisWeek, publishedProperties, reports] =
    await Promise.all([
      prisma.publication.count({ where: { ...base, filledAt: { gte: dayFrom } } }),
      prisma.publication.count({ where: { ...base, filledAt: { gte: weekFrom } } }),
      prisma.publication.count({ where: { ...base, publishedAt: { gte: weekFrom } } }),
      prisma.publication.findMany({
        where: { ...base, status: PublicationStatus.published },
        select: { propertyId: true },
        distinct: ['propertyId'],
      }),
      prisma.publication.findMany({
        where: { ...base, filledAt: { not: null } },
        select: { unfilledFields: true },
        take: 2000,
      }),
    ]);

  const fieldCounts = new Map<string, number>();
  let totalUnfilled = 0;
  let withUnfilled = 0;

  for (const report of reports) {
    const fields = unfilledNames(report.unfilledFields);
    totalUnfilled += fields.length;
    if (fields.length > 0) withUnfilled += 1;

    for (const field of fields) {
      fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + 1);
    }
  }

  return {
    filledToday,
    filledThisWeek,
    publishedThisWeek,
    publishedShare: totalProperties === 0 ? 0 : round(publishedProperties.length / totalProperties),
    averageUnfilled: reports.length === 0 ? 0 : round(totalUnfilled / reports.length),
    fillFailureRate: reports.length === 0 ? 0 : round(withUnfilled / reports.length),
    chronicallyUnfilled: topOf(fieldCounts, 5).map((entry) => ({
      ...entry,
      share: reports.length === 0 ? 0 : round(entry.count / reports.length),
    })),
  };
}

/**
 * Имена незаполненных полей из отчёта.
 *
 * Отчёт хранится как JSON и мог быть записан прошлой версией расширения
 * в другой форме. Слепое доверие обернулось бы падением дашборда
 * на исторических данных — там, где ошибку никто не ждёт.
 */
function unfilledNames(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) =>
      typeof entry === 'object' && entry !== null && 'field' in entry
        ? String((entry as { field: unknown }).field)
        : typeof entry === 'string'
          ? entry
          : null,
    )
    .filter((field): field is string => field !== null);
}

function topOf(
  counts: Map<string, number>,
  limit: number,
): Array<{ field: string; count: number }> {
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([field, count]) => ({ field, count }));
}

/** Доли округляются до сотых: три знака после запятой никто не читает. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
