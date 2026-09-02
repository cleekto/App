import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const API_ROOT = join(ROOT, 'apps/web/app/api/v1');

/**
 * Структурная проверка: каждый эндпоинт, отдающий данные компании, требует
 * аутентификацию.
 *
 * Тесты сценариев проверяют логику доступа, но не поймают маршрут, который
 * просто забыли закрыть — сценарий там вызовут уже с валидным контекстом.
 * Этот тест ловит ровно такой промах: он читает исходники маршрутов.
 *
 * DoD фазы 3 требует, чтобы данные компании B не доставались компании A
 * «ни через один эндпоинт», а не «ни через один сценарий».
 */

/** Открытые по назначению: аутентификации ещё нет или она и есть предмет. */
const PUBLIC_ROUTES = new Set([
  'health/route.ts',
  'auth/register/route.ts',
  'auth/login/route.ts',
  'auth/refresh/route.ts',
  'auth/logout/route.ts',
]);

function routeFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...routeFiles(full));
    else if (entry.name === 'route.ts') found.push(full);
  }
  return found;
}

const routes = routeFiles(API_ROOT).map((file) => ({
  key: relative(API_ROOT, file).split(sep).join('/'),
  source: readFileSync(file, 'utf8'),
}));

describe('маршруты API', () => {
  it('маршруты вообще найдены', () => {
    expect(routes.length).toBeGreaterThan(5);
  });

  it.each(routes.filter((route) => !PUBLIC_ROUTES.has(route.key)))(
    '$key требует аутентификацию',
    ({ source }) => {
      expect(source).toMatch(/requireAuth\(/u);
    },
  );

  // Правило 5, выраженное проверяемо: обработчик не имеет права читать
  // companyId из тела или строки запроса. Он приходит только из сессии.
  //
  // Единственное исключение — вход. До него сессии не существует, брать
  // компанию неоткуда, а параметр ничего не раскрывает: пароль проверяется
  // в любом случае, и при неверном ответ один и тот же. Правило относится
  // к аутентифицированным эндпоинтам, и здесь оно просто неприменимо.
  it.each(routes.filter((route) => route.key !== 'auth/login/route.ts'))(
    '$key не принимает companyId из запроса',
    ({ source }) => {
      expect(source).not.toMatch(/companyId:\s*z\./u);
      expect(source).not.toMatch(/searchParams\.get\(['"]companyId['"]\)/u);
    },
  );

  // Health — инфраструктурный эндпоинт: он проверяет доступность базы,
  // а не отдаёт данные компании. Ему обращение к @kleekto/db положено.
  it.each(routes.filter((route) => route.key !== 'health/route.ts'))(
    '$key не содержит бизнес-логики — только вызов сценария',
    ({ source }) => {
      // Обращение к базе из обработчика означает, что логика утекла из ядра
      // и её больше нельзя вызвать в тесте без HTTP (ADR-0001).
      expect(source).not.toMatch(/from '@kleekto\/db'/u);
      expect(source).not.toMatch(/prisma\./u);
    },
  );
});
