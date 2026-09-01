import { NextResponse } from 'next/server';
import { z } from 'zod';

import { HTTP_STATUS_BY_ERROR, errorEnvelope } from '@cleekto/contracts';
import { UnauthenticatedError, isDomainError, verifyAccessToken } from '@cleekto/core';
import type { AuthContext } from '@cleekto/core';

/**
 * Обвязка обработчиков маршрутов.
 *
 * Обработчик делает ровно четыре вещи (ADR-0001):
 *   1. разобрать и провалидировать вход;
 *   2. получить контекст ТОЛЬКО из сессии;
 *   3. вызвать сценарий из @cleekto/core, передав контекст аргументом;
 *   4. отобразить результат или доменную ошибку в HTTP-ответ.
 *
 * Бизнес-логики здесь нет и быть не должно.
 */

export const ACCESS_COOKIE = 'cleekto_access';
export const REFRESH_COOKIE = 'cleekto_refresh';

/**
 * Контекст из сессии. ЕДИНСТВЕННОЕ место, где он возникает из внешних данных.
 *
 * ПРАВИЛО 5: `companyId` берётся отсюда и только отсюда. Поля `companyId`
 * и `teamId`, пришедшие в теле запроса, игнорируются молча — ошибка
 * подсказала бы атакующему, что такой параметр вообще существует.
 */
export async function requireAuth(request: Request): Promise<AuthContext> {
  const token = extractToken(request);

  if (token === null) {
    throw new UnauthenticatedError();
  }

  const verified = await verifyAccessToken(token);

  return {
    userId: verified.userId,
    companyId: verified.companyId,
    teamId: verified.teamId,
    role: verified.role,
    locale: verified.locale,
  };
}

function extractToken(request: Request): string | null {
  // Расширение передаёт токен заголовком: cookie чужого домена ему недоступны.
  const header = request.headers.get('authorization');
  if (header !== null && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim() || null;
  }

  // Веб — httpOnly cookie: она недоступна скриптам на странице.
  const cookie = request.headers.get('cookie');
  if (cookie === null) return null;

  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === ACCESS_COOKIE) {
      return decodeURIComponent(rest.join('=')) || null;
    }
  }

  return null;
}

/**
 * Выполняет сценарий и переводит доменную ошибку в HTTP-ответ.
 *
 * Неизвестная ошибка отдаёт INTERNAL без подробностей: текст исключения может
 * содержать строку подключения или структуру запроса.
 */
export async function handle<T>(
  run: () => Promise<T>,
  options: {
    status?: number;
    /**
     * Правка успешного ответа — например, установка cookie сессии.
     *
     * Отдельным крючком, а не работой сценария: ядро о HTTP не знает
     * и знать не должно (ADR-0001), а cookie — это чистый HTTP.
     * На ошибочный ответ не вызывается: ставить сессию при неудачном
     * входе было бы прямой дырой.
     */
    onResponse?: (response: NextResponse, result: T) => NextResponse;
  } = {},
): Promise<NextResponse> {
  try {
    const result = await run();
    const response = NextResponse.json(result, { status: options.status ?? 200 });
    return options.onResponse === undefined ? response : options.onResponse(response, result);
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json(
        errorEnvelope(error.code, error.message, {
          ...(error.details === undefined ? {} : { details: error.details }),
        }),
        { status: HTTP_STATUS_BY_ERROR[error.code] },
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        errorEnvelope('VALIDATION_ERROR', 'Тело запроса не прошло проверку', {
          details: { fields: error.issues.map((issue) => issue.path.join('.')) },
        }),
        { status: HTTP_STATUS_BY_ERROR.VALIDATION_ERROR },
      );
    }

    console.error('[api] необработанная ошибка:', error instanceof Error ? error.name : 'unknown');

    return NextResponse.json(errorEnvelope('INTERNAL', 'Внутренняя ошибка'), {
      status: HTTP_STATUS_BY_ERROR.INTERNAL,
    });
  }
}

/** Разбор тела запроса по схеме. Невалидное тело даёт 400, а не 500. */
export async function parseBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new z.ZodError([{ code: 'custom', path: [], message: 'Тело запроса не является JSON' }]);
  }
  return schema.parse(raw);
}
