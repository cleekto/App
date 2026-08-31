import { ValidationError } from './errors';

/**
 * Настройки из окружения.
 *
 * Читаются при вызове, а не при импорте модуля: иначе любой тест, которому
 * настройки не нужны, падал бы при загрузке пакета.
 */

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new ValidationError(`Переменная окружения ${name} не задана. См. .env.example`);
  }
  return value;
}

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;

  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new ValidationError(`Переменная окружения ${name} должна быть положительным числом`);
  }
  return value;
}

export interface AuthConfig {
  jwtSecret: Uint8Array;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
}

/** Минимальная длина секрета подписи. Короче — подбирается. */
const MIN_SECRET_BYTES = 32;

export function authConfig(): AuthConfig {
  const secret = required('AUTH_JWT_SECRET');
  const bytes = new TextEncoder().encode(secret);

  if (bytes.length < MIN_SECRET_BYTES) {
    throw new ValidationError(
      `AUTH_JWT_SECRET короче ${MIN_SECRET_BYTES} байт. Сгенерируй: openssl rand -base64 48`,
    );
  }

  return {
    jwtSecret: bytes,
    // 900 секунд — то же окно, в течение которого изменение роли или команды
    // ещё не вступило в силу. Цена того, что права лежат в подписанном токене,
    // а не читаются из базы на каждом запросе (ADR-0003).
    accessTtlSeconds: positiveInt('AUTH_ACCESS_TTL_SECONDS', 900),
    refreshTtlSeconds: positiveInt('AUTH_REFRESH_TTL_SECONDS', 2_592_000),
  };
}
