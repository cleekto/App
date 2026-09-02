import { RoleCode, prisma } from '@cleekto/db';

import { ACTIVITY, ENTITY } from '../activity/actions';
import { writeActivity, writeSystemActivity } from '../activity/write';
import { ConflictError, NotFoundError, UnauthenticatedError, ValidationError } from '../errors';
import { DEFAULT_PIPELINE_STATUSES } from '../pipeline/defaults';
import type { AuthContext } from './context';
import { hashPassword, verifyPassword } from './password';
import { ensureRoles } from './roles';
import { hashRefreshToken, issueAccessToken, issueRefreshToken } from './tokens';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: RoleCode;
  locale: string;
  companyId: string;
  companyName: string;
  teamId: string | null;
  teamName: string | null;
}

// ── Регистрация компании ─────────────────────────────────────────────────────

export interface RegisterCompanyInput {
  companyName: string;
  adminEmail: string;
  adminPassword: string;
  adminFullName: string;
  locale?: string | undefined;
}

/**
 * Регистрация компании и её первого администратора.
 *
 * Создаёт всё, без чего компания нерабочая: справочник ролей, саму компанию,
 * пять статусов воронки и администратора. Одной транзакцией — компания
 * без статусов воронки хуже, чем отсутствие компании.
 */
export async function registerCompany(
  input: RegisterCompanyInput,
): Promise<{ companyId: string; userId: string }> {
  const email = normalizeEmail(input.adminEmail);
  const companyName = input.companyName.trim();

  if (companyName === '') {
    throw new ValidationError('Название компании не указано', { fields: ['companyName'] });
  }

  const passwordHash = await hashPassword(input.adminPassword);
  const locale = input.locale ?? process.env['DEFAULT_LOCALE'] ?? 'en';

  return prisma.$transaction(async (tx) => {
    const roles = await ensureRoles(tx);

    const company = await tx.company.create({
      data: {
        name: companyName,
        locale,
        pipelineStatuses: { create: [...DEFAULT_PIPELINE_STATUSES] },
      },
    });

    const admin = await tx.user.create({
      data: {
        companyId: company.id,
        roleId: roles.ADMIN,
        email,
        passwordHash,
        fullName: input.adminFullName.trim(),
        locale,
      },
    });

    // Пользователя ещё не существовало, когда компания создавалась,
    // поэтому запись системная: приписать действие администратору
    // значило бы соврать о том, кто его выполнил.
    await writeSystemActivity(tx, company.id, {
      entityType: ENTITY.COMPANY,
      entityId: company.id,
      action: ACTIVITY.COMPANY_REGISTERED,
      after: { name: companyName, locale },
    });

    return { companyId: company.id, userId: admin.id };
  });
}

// ── Вход ─────────────────────────────────────────────────────────────────────

export interface LoginInput {
  email: string;
  password: string;
  /** Нужен только если один и тот же адрес заведён в нескольких компаниях. */
  companyId?: string | undefined;
}

/**
 * Вход по email и паролю.
 *
 * Email уникален внутри компании, а не глобально: один человек может работать
 * в двух агентствах, и запрет на это был бы нашей выдумкой. Поэтому адрес
 * может совпасть у пользователей разных компаний — редкий, но возможный
 * случай, и он обрабатывается явно, а не запрещается схемой.
 */
export async function login(input: LoginInput): Promise<SessionTokens> {
  const email = normalizeEmail(input.email);

  const candidates = await prisma.user.findMany({
    where: {
      email,
      isActive: true,
      ...(input.companyId === undefined ? {} : { companyId: input.companyId }),
    },
    include: { role: true, teamMemberships: true },
  });

  const matched: typeof candidates = [];
  for (const candidate of candidates) {
    if (await verifyPassword(candidate.passwordHash, input.password)) {
      matched.push(candidate);
    }
  }

  // Один и тот же ответ и при отсутствии пользователя, и при неверном пароле.
  // Разные ответы позволили бы перебором узнать, кто зарегистрирован.
  if (matched.length === 0) {
    throw new UnauthenticatedError('Неверный email или пароль');
  }

  if (matched.length > 1) {
    throw new ConflictError('Этот адрес заведён в нескольких компаниях. Укажите компанию', {
      companies: matched.map((user) => user.companyId),
    });
  }

  const user = matched[0];
  if (user === undefined) {
    throw new UnauthenticatedError('Неверный email или пароль');
  }

  const tokens = await issueSession({
    userId: user.id,
    companyId: user.companyId,
    teamId: user.teamMemberships[0]?.teamId ?? null,
    role: user.role.code,
    locale: user.locale,
    tokenVersion: user.tokenVersion,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await writeActivity(
    prisma,
    {
      userId: user.id,
      companyId: user.companyId,
      teamId: user.teamMemberships[0]?.teamId ?? null,
      role: user.role.code,
      locale: user.locale,
    },
    { entityType: ENTITY.USER, entityId: user.id, action: ACTIVITY.USER_LOGGED_IN },
  );

  return tokens;
}

// ── Обновление сессии ────────────────────────────────────────────────────────

/**
 * Обновление пары токенов с ротацией.
 *
 * Повторное использование уже отозванного токена означает, что им завладел
 * кто-то ещё: настоящий владелец получил бы новый. Поэтому отзываются все
 * сессии пользователя, а не только предъявленная.
 */
export async function refreshSession(refreshToken: string): Promise<SessionTokens> {
  const tokenHash = hashRefreshToken(refreshToken);

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { role: true, teamMemberships: true } } },
  });

  if (stored === null) {
    throw new UnauthenticatedError('Сессия недействительна');
  }

  if (stored.revokedAt !== null) {
    await revokeAllSessions(stored.userId);

    await writeSystemActivity(prisma, stored.user.companyId, {
      entityType: ENTITY.USER,
      entityId: stored.userId,
      action: ACTIVITY.REFRESH_REUSE_DETECTED,
    });

    throw new UnauthenticatedError('Сессия недействительна');
  }

  if (stored.expiresAt.getTime() <= Date.now() || !stored.user.isActive) {
    throw new UnauthenticatedError('Сессия недействительна');
  }

  const tokens = await issueSession({
    userId: stored.user.id,
    companyId: stored.user.companyId,
    teamId: stored.user.teamMemberships[0]?.teamId ?? null,
    role: stored.user.role.code,
    locale: stored.user.locale,
    tokenVersion: stored.user.tokenVersion,
  });

  // Старый токен отзывается и указывает на пришедший ему на смену:
  // по цепочке видно, что произошло, если он всплывёт повторно.
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date(), replacedById: tokens.refreshTokenId },
  });

  return tokens;
}

export async function logout(refreshToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(refreshToken);

  // Выход несуществующей сессии — не ошибка: результат тот же, сессии нет.
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Полный отзыв: смена пароля, отключение пользователя, подозрение на кражу. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ── Текущий пользователь ─────────────────────────────────────────────────────

/**
 * Профиль для интерфейса. Фронтенд по нему прячет кнопки; сервер по нему
 * ничего не решает — у него есть контекст (правило 6).
 */
export async function currentUser(ctx: AuthContext): Promise<CurrentUser> {
  const user = await prisma.user.findFirst({
    // companyId из контекста, а не из запроса (правило 5).
    where: { id: ctx.userId, companyId: ctx.companyId },
    include: {
      role: true,
      company: true,
      teamMemberships: { include: { team: true } },
    },
  });

  if (user === null) {
    throw new NotFoundError();
  }

  const membership = user.teamMemberships[0];

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role.code,
    locale: user.locale,
    companyId: user.companyId,
    companyName: user.company.name,
    teamId: membership?.teamId ?? null,
    teamName: membership?.team.name ?? null,
  };
}

// ── Внутреннее ───────────────────────────────────────────────────────────────

interface IssuedSession extends SessionTokens {
  refreshTokenId: string;
}

async function issueSession(claims: {
  userId: string;
  companyId: string;
  teamId: string | null;
  role: RoleCode;
  locale: string;
  tokenVersion: number;
}): Promise<IssuedSession> {
  const access = await issueAccessToken({
    sub: claims.userId,
    companyId: claims.companyId,
    teamId: claims.teamId,
    role: claims.role,
    locale: claims.locale,
    tokenVersion: claims.tokenVersion,
  });

  const refresh = issueRefreshToken();

  const stored = await prisma.refreshToken.create({
    data: {
      userId: claims.userId,
      tokenHash: refresh.tokenHash,
      expiresAt: refresh.expiresAt,
    },
    select: { id: true },
  });

  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    expiresIn: access.expiresInSeconds,
    refreshTokenId: stored.id,
  };
}

export function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(trimmed)) {
    throw new ValidationError('Неверный формат email', { fields: ['email'] });
  }

  return trimmed;
}

// ── Смена языка интерфейса ───────────────────────────────────────────────────

/**
 * Меняет язык пользователя и ВЫДАЁТ НОВУЮ СЕССИЮ.
 *
 * Новая сессия здесь обязательна, а не «на всякий случай»: язык лежит
 * в подписанном access-токене (ADR-0003), и без перевыпуска интерфейс
 * остался бы на прежнем языке до истечения токена — то есть до пятнадцати
 * минут после нажатия. Человек решил бы, что переключатель сломан.
 *
 * Права и команда при этом не меняются: перевыпускается тот же набор
 * утверждений, в котором отличается одно поле.
 */
export async function changeLocale(ctx: AuthContext, locale: string): Promise<SessionTokens> {
  // Список продублирован намеренно: ядро не зависит от пакета интерфейса
  // (ADR-0001), а три языка — решение владельца, а не деталь вёрстки.
  if (!['ka', 'en', 'ru'].includes(locale)) {
    throw new ValidationError('Неизвестный язык', { fields: ['locale'] });
  }

  const user = await prisma.user.update({
    // companyId из контекста (правило 5): чужого пользователя этим не тронуть.
    where: { id: ctx.userId, companyId: ctx.companyId },
    data: { locale },
    select: { id: true, companyId: true, role: { select: { code: true } }, tokenVersion: true },
  });

  const membership = await prisma.teamMember.findFirst({
    where: { userId: user.id },
    select: { teamId: true },
  });

  const session = await issueSession({
    userId: user.id,
    companyId: user.companyId,
    teamId: membership?.teamId ?? null,
    role: user.role.code,
    locale,
    tokenVersion: user.tokenVersion,
  });

  await writeActivity(prisma, ctx, {
    action: ACTIVITY.USER_LOCALE_CHANGED,
    entityType: ENTITY.USER,
    entityId: user.id,
    after: { locale },
  });

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresIn: session.expiresIn,
  };
}
