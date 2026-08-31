import { hash, verify } from '@node-rs/argon2';

import { ValidationError } from '../errors';

/**
 * Пароли: argon2id (ADR-0003).
 *
 * Не bcrypt: argon2id устойчив к подбору на видеокартах и является текущей
 * рекомендацией OWASP. Пакет поставляется с готовыми бинарниками — сборка
 * на машине разработчика не требуется.
 */

/** Минимальная длина пароля. Короткий пароль подбирается независимо от KDF. */
export const MIN_PASSWORD_LENGTH = 12;

export function assertPasswordAcceptable(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`, {
      fields: ['password'],
    });
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordAcceptable(password);
  return hash(password);
}

/**
 * Проверка пароля.
 *
 * Никогда не бросает при неверном пароле — возвращает false. Разные исходы
 * для «нет пользователя» и «неверный пароль» позволили бы перебором узнать,
 * кто зарегистрирован в системе.
 */
export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  try {
    return await verify(storedHash, password);
  } catch {
    // Битый или чужого формата хеш — это не совпадение пароля.
    // Ошибку наружу не выпускаем: её текст описывает формат хранения.
    return false;
  }
}
