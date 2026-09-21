import { NextResponse } from 'next/server';
import { z } from 'zod';

import { HTTP_STATUS_BY_ERROR, errorEnvelope } from '@kleekto/contracts';
import {
  UnauthenticatedError,
  ValidationError,
  contextFromAccessToken,
  isDomainError,
} from '@kleekto/core';
import type { AuthContext } from '@kleekto/core';

import { ACCESS_COOKIE, REFRESH_COOKIE } from './cookie-names';

/**
 * Обвязка обработчиков маршрутов.
 *
 * Обработчик делает ровно четыре вещи (ADR-0001):
 *   1. разобрать и провалидировать вход;
 *   2. получить контекст ТОЛЬКО из сессии;
 *   3. вызвать сценарий из @kleekto/core, передав контекст аргументом;
 *   4. отобразить результат или доменную ошибку в HTTP-ответ.
 *
 * Бизнес-логики здесь нет и быть не должно.
 */

export { ACCESS_COOKIE, REFRESH_COOKIE };

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

  /*
   * Контекст сверяется с базой, а не берётся из токена целиком.
   *
   * Подпись доказывает, что токен наш. Она не доказывает, что человек
   * до сих пор тот, кем был при выдаче: роль, команда и признак «работает»
   * меняются админом, а токен живёт ещё до пятнадцати минут.
   */
  return contextFromAccessToken(token);
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
    return failureResponse(error);
  }
}

/**
 * Доменная ошибка — в HTTP-ответ.
 *
 * Вынесено из `handle`, потому что не всякий маршрут отдаёт JSON: архив
 * фотографий возвращает файл, а ошибаться обязан ровно так же, как все
 * остальные. Два способа отображать одну и ту же ошибку разошлись бы
 * при первой же правке.
 */
export function failureResponse(error: unknown): NextResponse {
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

/** Обычный JSON API не должен принимать мегабайты произвольных данных. */
export const DEFAULT_JSON_BODY_MAX_BYTES = 1024 * 1024;

interface ParseBodyOptions {
  maxBytes?: number;
  /** Нужен auth-маршрутам, где веб передаёт токен cookie и тело отсутствует. */
  allowEmpty?: boolean;
}

function bodyTooLarge(): ValidationError {
  return new ValidationError('Тело запроса превышает допустимый размер');
}

/**
 * Читает тело ПОТОКОМ и останавливается сразу после превышения лимита.
 *
 * Одного Content-Length недостаточно: заголовок можно не прислать или соврать.
 * Поэтому он используется только как быстрый отказ, а фактическое число байт
 * всё равно считается при чтении. Это общая ingress-граница для JSON и
 * multipart — маршруты не должны читать request body напрямую.
 */
async function readBodyBytes(request: Request, maxBytes: number): Promise<Uint8Array> {
  const declaredRaw = request.headers.get('content-length');
  if (declaredRaw !== null) {
    const declared = Number.parseInt(declaredRaw, 10);
    if (Number.isFinite(declared) && declared > maxBytes) throw bodyTooLarge();
  }

  if (request.body === null) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value === undefined) continue;

      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw bodyTooLarge();
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function invalidBody(message: string): z.ZodError {
  return new z.ZodError([{ code: 'custom', path: [], message }]);
}

/**
 * Разбор JSON по схеме с жёстким пределом размера.
 *
 * Невалидное тело остаётся обычной VALIDATION_ERROR из публичного контракта:
 * новый transport-specific error code ради одного лимита не вводится.
 */
export async function parseBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
  options: ParseBodyOptions = {},
): Promise<z.infer<S>> {
  const bytes = await readBodyBytes(request, options.maxBytes ?? DEFAULT_JSON_BODY_MAX_BYTES);

  if (bytes.byteLength === 0) {
    if (options.allowEmpty === true) return schema.parse({});
    throw invalidBody('Тело запроса не является JSON');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw invalidBody('Тело запроса не является JSON');
  }

  return schema.parse(raw);
}

/**
 * Multipart тоже сначала проходит bounded reader.
 *
 * Прямой вызов formData прочитал бы всё тело в память ДО проверки размера
 * File. Для миграции это превращало проверку 20 МБ в декоративную: сотни
 * мегабайт уже были бы приняты сервером к моменту отказа.
 */
export async function parseFormData(request: Request, maxBytes: number): Promise<FormData> {
  const contentType = request.headers.get('content-type');
  if (contentType === null || !contentType.toLowerCase().startsWith('multipart/form-data')) {
    throw invalidBody('Ожидается multipart/form-data');
  }

  const bytes = await readBodyBytes(request, maxBytes);

  try {
    return await new Response(bytes, {
      headers: { 'content-type': contentType },
    }).formData();
  } catch {
    throw invalidBody('Тело multipart не прошло проверку');
  }
}
