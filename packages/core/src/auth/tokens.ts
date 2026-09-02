import { createHash, randomBytes } from 'node:crypto';

import type { RoleCode } from '@kleekto/db';
import { SignJWT, jwtVerify } from 'jose';

import { authConfig } from '../config';
import { UnauthenticatedError } from '../errors';
import type { AuthContext } from './context';

const ALGORITHM = 'HS256';
const ISSUER = 'kleekto';

/**
 * Полезная нагрузка access-токена.
 *
 * Роль, компания и команда лежат в подписанном токене, а не читаются из базы
 * на каждом запросе. Цена названа в ADR-0003: изменение прав вступает в силу
 * в пределах срока жизни access-токена, по умолчанию 15 минут.
 */
interface AccessClaims {
  sub: string;
  companyId: string;
  teamId: string | null;
  role: RoleCode;
  locale: string;
  tokenVersion: number;
}

export interface IssuedAccess {
  token: string;
  expiresInSeconds: number;
}

export async function issueAccessToken(claims: AccessClaims): Promise<IssuedAccess> {
  const config = authConfig();

  const token = await new SignJWT({
    companyId: claims.companyId,
    teamId: claims.teamId,
    role: claims.role,
    locale: claims.locale,
    tokenVersion: claims.tokenVersion,
  })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${config.accessTtlSeconds}s`)
    .sign(config.jwtSecret);

  return { token, expiresInSeconds: config.accessTtlSeconds };
}

export interface VerifiedAccess extends AuthContext {
  tokenVersion: number;
}

/**
 * Разбор access-токена в контекст.
 *
 * Единственное место, где контекст возникает из внешних данных. Всё, что
 * не прошло проверку подписи и срока, — UnauthenticatedError без подробностей:
 * подробности подсказали бы атакующему, что именно не сошлось.
 */
export async function verifyAccessToken(token: string): Promise<VerifiedAccess> {
  const config = authConfig();

  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(token, config.jwtSecret, {
      issuer: ISSUER,
      algorithms: [ALGORITHM],
    });
    payload = result.payload as Record<string, unknown>;
  } catch {
    throw new UnauthenticatedError('Токен недействителен или истёк');
  }

  const sub = payload['sub'];
  const companyId = payload['companyId'];
  const teamId = payload['teamId'];
  const role = payload['role'];
  const locale = payload['locale'];
  const tokenVersion = payload['tokenVersion'];

  if (
    typeof sub !== 'string' ||
    typeof companyId !== 'string' ||
    typeof role !== 'string' ||
    typeof locale !== 'string' ||
    typeof tokenVersion !== 'number' ||
    (teamId !== null && typeof teamId !== 'string')
  ) {
    throw new UnauthenticatedError('Токен недействителен или истёк');
  }

  return {
    userId: sub,
    companyId,
    teamId,
    role: role as RoleCode,
    locale,
    tokenVersion,
  };
}

// ── Refresh-токены ───────────────────────────────────────────────────────────

export interface IssuedRefresh {
  /** Отдаётся клиенту. В базе не хранится. */
  token: string;
  /** Хранится в базе. Утечка базы не должна давать доступ к живым сессиям. */
  tokenHash: string;
  expiresAt: Date;
}

export function issueRefreshToken(): IssuedRefresh {
  const config = authConfig();
  const token = randomBytes(48).toString('base64url');

  return {
    token,
    tokenHash: hashRefreshToken(token),
    expiresAt: new Date(Date.now() + config.refreshTtlSeconds * 1000),
  };
}

/**
 * SHA-256, а не argon2.
 *
 * Refresh-токен — это 48 случайных байт, а не выбранный человеком пароль.
 * Подбирать нечего, поэтому медленный KDF здесь не даёт защиты, а только
 * замедляет каждое обновление сессии.
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
