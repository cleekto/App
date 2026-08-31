import type { ErrorCode } from '@cleekto/contracts';

/**
 * Доменная ошибка. Несёт код контракта, но ничего не знает о HTTP —
 * в статус её переводит обработчик маршрута (ADR-0001).
 */
export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

export class UnauthenticatedError extends DomainError {
  constructor(message = 'Требуется вход') {
    super('UNAUTHENTICATED', message);
    this.name = 'UnauthenticatedError';
  }
}

/**
 * Ресурс СВОЕЙ компании, но роль не позволяет.
 *
 * Для ресурса другой компании бросается NotFoundError, а не эта ошибка:
 * 403 подтвердил бы существование объекта, и по перебору идентификаторов
 * можно было бы оценить размер базы конкурента (риск R-04).
 */
export class ForbiddenError extends DomainError {
  constructor(message = 'Недостаточно прав') {
    super('FORBIDDEN', message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Ресурса нет ЛИБО он принадлежит другой компании. Снаружи эти два случая
 * неразличимы намеренно — см. комментарий к ForbiddenError.
 */
export class NotFoundError extends DomainError {
  constructor(message = 'Не найдено') {
    super('NOT_FOUND', message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CONFLICT', message, details);
    this.name = 'ConflictError';
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
