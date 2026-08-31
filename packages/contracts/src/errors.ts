import { z } from 'zod';

/**
 * Коды ошибок API. Полный список — `docs/architecture/api-contracts.md` §1.
 *
 * Два кода требуют пояснения прямо здесь, потому что их легко применить неверно:
 *
 * NOT_FOUND возвращается и когда ресурса нет, и когда он принадлежит ДРУГОЙ
 * компании. Эти два случая снаружи неразличимы намеренно: 403 подтвердил бы
 * существование объекта, и по перебору идентификаторов можно было бы оценить
 * размер базы конкурента.
 *
 * FORBIDDEN — только для ресурса СВОЕЙ компании, когда роль не позволяет.
 * Внутри компании факт существования объекта секретом не является.
 */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'DUPLICATE_BLOCKED',
  'PHONE_NOT_REVEALED',
  'RATE_LIMITED',
  'INTERNAL',
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const HTTP_STATUS_BY_ERROR: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  DUPLICATE_BLOCKED: 409,
  PHONE_NOT_REVEALED: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    requestId: z.string().optional(),
    details: z.record(z.unknown()).optional(),
  }),
});

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

export function errorEnvelope(
  code: ErrorCode,
  message: string,
  extra?: { requestId?: string; details?: Record<string, unknown> },
): ErrorEnvelope {
  return {
    error: {
      code,
      message,
      ...(extra?.requestId === undefined ? {} : { requestId: extra.requestId }),
      ...(extra?.details === undefined ? {} : { details: extra.details }),
    },
  };
}
