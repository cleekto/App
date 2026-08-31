import { type Prisma, type PropertyType, type Source, prisma } from '@cleekto/db';

import type { AuthContext } from '../auth/context';
import { dedupConfig } from './config';
import { compare, reasonHuman, verdictFor, type Facts, type Reason, type Verdict } from './scoring';

/**
 * Движок дедупликации. Проектный документ — docs/architecture/duplicate-detection.md.
 *
 * ПЯТЬ ПРОВЕРОК, ПЯТЬ ОБЛАСТЕЙ (инвариант 9). Здесь их три:
 *   создание объекта при «Согласен» — область КОМАНДА, блокирует;
 *   тот же объект у другой команды  — область КОМПАНИЯ, только пометка;
 *   исключение телефонов профилей   — область КОМПАНИЯ.
 *
 * Ошибка «заменить компанию на команду везде» ломает защиту от самоимпорта
 * и отравляет базу (риск R-31, ADR-0006).
 */

export interface DedupInput {
  source: Source;
  externalId: string | null;
  canonicalUrl: string;
  facts: Facts;
}

export interface MatchPreview {
  title: string | null;
  address: string | null;
  area: number | null;
  rooms: number | null;
  price: number | null;
  currency: string | null;
  status: string;
  assignedAgent: string | null;
  team: string;
  createdAt: Date;
  /** Только для своей команды. У чужой — null (Q40, C-06). */
  ownerPhone: string | null;
}

export interface DedupMatch {
  propertyId: string;
  verdict: Verdict;
  score: number;
  comparableFields: number;
  matchedFields: number;
  /** `company` означает совпадение в другой команде: оно НИКОГДА не блокирует. */
  scope: 'team' | 'company';
  reasons: Reason[];
  reasonHuman: string;
  preview: MatchPreview;
  /** Площадки, объявления с которых уже привязаны к этому объекту. */
  linkedSources: Source[];
  propertyLinkId: string | null;
}

export type PhoneExclusion = 'publish_profile' | 'agency_threshold' | null;

export interface DedupOutcome {
  /** Точное совпадение по ключу идемпотентности в СВОЕЙ команде. */
  exact: { sourceListingId: string; propertyId: string } | null;
  /** Совпадения своей команды, отсортированы по убыванию уверенности. */
  teamMatches: DedupMatch[];
  /** Совпадения других команд компании. Мягкая пометка, не блокировка. */
  companyMatches: DedupMatch[];
  /** Итоговый вердикт по СВОЕЙ команде — именно он решает судьбу создания. */
  verdict: Verdict;
  phoneExcluded: PhoneExclusion;
}

export async function analyze(ctx: AuthContext, input: DedupInput): Promise<DedupOutcome> {
  const config = dedupConfig();

  const exact = await findExact(ctx, input);
  if (exact !== null) {
    return { exact, teamMatches: [], companyMatches: [], verdict: 'EXACT', phoneExcluded: null };
  }

  const phoneExcluded = await classifyPhones(ctx, input.facts.phones);
  const usablePhones = phoneExcluded === null ? input.facts.phones : [];

  const candidateIds = await gatherCandidates(
    ctx,
    input,
    usablePhones,
    config.candidates.maxCandidates,
  );
  if (candidateIds.length === 0) {
    return { exact: null, teamMatches: [], companyMatches: [], verdict: 'NONE', phoneExcluded };
  }

  const matches = await scoreCandidates(ctx, input, candidateIds, usablePhones);

  const teamMatches = matches.filter((match) => match.scope === 'team');
  const companyMatches = matches.filter((match) => match.scope === 'company');

  return {
    exact: null,
    teamMatches,
    companyMatches,
    // Совпадение в другой команде не влияет на вердикт: конкуренция между
    // командами разрешена владельцем (ADR-0006).
    verdict: strongestVerdict(teamMatches),
    phoneExcluded,
  };
}

// ── Уровень 1: точное совпадение ─────────────────────────────────────────────

/**
 * Ключ идемпотентности — на КОМАНДЕ, а не на компании (Q43, перекрывает Q21).
 *
 * `externalId` может отсутствовать у площадки в принципе (риск R-08), поэтому
 * канонический URL служит запасным ключом.
 */
async function findExact(
  ctx: AuthContext,
  input: DedupInput,
): Promise<{ sourceListingId: string; propertyId: string } | null> {
  if (ctx.teamId === null) return null;

  const byExternalId =
    input.externalId === null
      ? null
      : await prisma.sourceListing.findFirst({
          where: { teamId: ctx.teamId, source: input.source, externalId: input.externalId },
          select: { id: true, propertyId: true },
        });

  const found =
    byExternalId ??
    (await prisma.sourceListing.findFirst({
      where: { teamId: ctx.teamId, source: input.source, canonicalUrl: input.canonicalUrl },
      select: { id: true, propertyId: true },
    }));

  return found === null ? null : { sourceListingId: found.id, propertyId: found.propertyId };
}

// ── Пригодность телефона как признака ────────────────────────────────────────

/**
 * ОБЛАСТЬ — КОМПАНИЯ, не команда (инвариант 9, ADR-0006).
 *
 * Телефон профиля публикации исключается, иначе все объекты агентства станут
 * дублями друг друга: у них один контактный номер (I20). Команда, не знающая
 * о профиле соседней команды, получила бы ложные совпадения.
 *
 * Телефон, встречающийся у многих объектов компании, принадлежит агентству
 * или риелтору, а не собственнику (I21). Команда из трёх агентов сама по себе
 * такой номер не распознает — отсюда область компании.
 */
async function classifyPhones(
  ctx: AuthContext,
  phones: readonly string[],
): Promise<PhoneExclusion> {
  if (phones.length === 0) return null;

  const ownProfile = await prisma.publishProfile.findFirst({
    where: { companyId: ctx.companyId, phoneNormalized: { in: [...phones] } },
    select: { id: true },
  });
  if (ownProfile !== null) return 'publish_profile';

  const threshold = dedupConfig().agencyPhone.propertiesThreshold;
  const usage = await prisma.ownerContactPhone.findMany({
    where: { companyId: ctx.companyId, phoneNormalized: { in: [...phones] } },
    select: { ownerContact: { select: { properties: { select: { id: true } } } } },
  });

  const propertyIds = new Set(
    usage.flatMap((row) => row.ownerContact.properties.map((property) => property.id)),
  );

  return propertyIds.size >= threshold ? 'agency_threshold' : null;
}

// ── Отбор кандидатов ─────────────────────────────────────────────────────────

/**
 * Сначала дешёвые точные признаки, тяжёлая оценка — только на суженном наборе.
 *
 * Обратный порядок даёт линейный рост времени импорта по мере наполнения базы,
 * и главный KPI продукта деградирует незаметно (риск R-10).
 *
 * Область отбора — КОМПАНИЯ: совпадения чужих команд нужны для мягкой пометки.
 * Блокирует только своя команда, и это решается позже, по полю `scope`.
 */
async function gatherCandidates(
  ctx: AuthContext,
  input: DedupInput,
  usablePhones: readonly string[],
  limit: number,
): Promise<string[]> {
  if (usablePhones.length > 0) {
    const byPhone = await prisma.property.findMany({
      where: {
        companyId: ctx.companyId,
        ownerContact: {
          phones: { some: { phoneNormalized: { in: [...usablePhones] } } },
        },
      },
      select: { id: true },
      take: limit,
    });
    if (byPhone.length > 0) return byPhone.map((property) => property.id);
  }

  // Телефона нет либо он исключён — грубый отбор по параметрам.
  const { facts } = input;
  if (facts.district === null && facts.area === null && facts.rooms === null) return [];

  const tolerance = dedupConfig().candidates.coarseAreaTolerancePercent;
  const areaFilter =
    facts.area === null
      ? {}
      : {
          areaTotal: {
            gte: facts.area * (1 - tolerance / 100),
            lte: facts.area * (1 + tolerance / 100),
          },
        };

  const coarse = await prisma.property.findMany({
    where: {
      companyId: ctx.companyId,
      ...(facts.district === null ? {} : { district: facts.district }),
      ...(facts.rooms === null ? {} : { rooms: facts.rooms }),
      ...areaFilter,
    },
    select: { id: true },
    take: limit,
  });

  return coarse.map((property) => property.id);
}

// ── Полная оценка ────────────────────────────────────────────────────────────

async function scoreCandidates(
  ctx: AuthContext,
  input: DedupInput,
  candidateIds: string[],
  usablePhones: readonly string[],
): Promise<DedupMatch[]> {
  const candidates = await prisma.property.findMany({
    where: { id: { in: candidateIds }, companyId: ctx.companyId },
    include: {
      ownerContact: { include: { phones: true } },
      pipelineStatus: true,
      team: true,
      sourceListings: { select: { source: true } },
    },
  });

  const incoming: Facts = { ...input.facts, phones: usablePhones };

  const matches: DedupMatch[] = [];

  for (const candidate of candidates) {
    const isOwnTeam = candidate.teamId === ctx.teamId;

    const candidateFacts: Facts = {
      phones: candidate.ownerContact?.phones.map((phone) => phone.phoneNormalized) ?? [],
      addressNormalized: candidate.addressNormalized,
      area: toNumber(candidate.areaTotal),
      rooms: candidate.rooms,
      floor: candidate.floor,
      totalFloors: candidate.totalFloors,
      price: toNumber(candidate.price),
      currency: candidate.currency,
      propertyType: candidate.propertyType,
      photos: candidate.photos,
      district: candidate.district,
    };

    const comparison = compare(incoming, candidateFacts);
    const verdict = verdictFor(comparison);

    if (verdict === 'NONE') continue;

    matches.push({
      propertyId: candidate.id,
      verdict,
      score: Number(comparison.score.toFixed(2)),
      comparableFields: comparison.comparable.length,
      matchedFields: comparison.matched.length,
      scope: isOwnTeam ? 'team' : 'company',
      reasons: comparison.reasons,
      reasonHuman: reasonHuman(comparison),
      linkedSources: [...new Set(candidate.sourceListings.map((listing) => listing.source))],
      propertyLinkId: candidate.propertyLinkId,
      preview: {
        title: candidate.addressRaw,
        address: candidate.addressRaw,
        area: toNumber(candidate.areaTotal),
        rooms: candidate.rooms,
        price: toNumber(candidate.price),
        currency: candidate.currency,
        status: candidate.pipelineStatus.name,
        assignedAgent: null,
        team: candidate.team.name,
        createdAt: candidate.createdAt,
        // Телефон собственника — только своей команде. Агент чужой команды
        // понимает «объект занят», но чужого контакта не получает (Q40).
        ownerPhone: isOwnTeam
          ? (candidate.ownerContact?.phones.find((phone) => phone.isPrimary)?.phoneOriginal ??
            candidate.ownerContact?.phones[0]?.phoneOriginal ??
            null)
          : null,
      },
    });
  }

  return matches.sort((a, b) => b.score - a.score);
}

const ORDER: Record<Verdict, number> = { NONE: 0, POSSIBLE: 1, STRONG: 2, EXACT: 3 };

function strongestVerdict(matches: readonly DedupMatch[]): Verdict {
  return matches.reduce<Verdict>(
    (best, match) => (ORDER[match.verdict] > ORDER[best] ? match.verdict : best),
    'NONE',
  );
}

function toNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

export type { Facts, Verdict, PropertyType };
