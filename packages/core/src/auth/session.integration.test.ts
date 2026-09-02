import { prisma } from '@cleekto/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ACTIVITY } from '../activity/actions';
import { UnauthenticatedError } from '../errors';
import { seed } from '../seed/seed';
import { hashRefreshToken } from './tokens';
import { REFRESH_REUSE_GRACE_MS, login, refreshSession } from './use-cases';

/**
 * Ротация refresh-токена с защитой от кражи — и с допуском на то, что
 * повторное предъявление одного и того же токена не всегда означает кражу.
 *
 * Веб теперь обновляет сессию сам, из `middleware.ts`
 * (`docs/launch-checklist.md`, «сессия обрывается каждые пятнадцать минут»).
 * Браузер может выстрелить несколько запросов почти одновременно, пока
 * access-cookie уже истекла: каждый видит в куке один и тот же refresh-токен,
 * потому что ни один ещё не получил новый `Set-Cookie`. Без допуска второй
 * такой запрос выглядел бы кражей и отзывал бы все сессии агента посреди
 * работы — то есть чинили бы один разлогин, заводя другой.
 */

let password: string;

beforeAll(async () => {
  const result = await seed();
  password = result.password;
}, 60_000);

afterAll(async () => {
  await prisma.$disconnect();
});

async function loggedInAgent() {
  return login({ email: 'agent2@tbilisi-estate.test', password });
}

describe('обновление сессии', () => {
  it('ротация: старый токен разово заменяется новым, цепочка продолжается', async () => {
    const first = await loggedInAgent();
    const rotated = await refreshSession(first.refreshToken);

    expect(rotated.accessToken).not.toBe(first.accessToken);
    expect(rotated.refreshToken).not.toBe(first.refreshToken);

    await expect(refreshSession(rotated.refreshToken)).resolves.toBeDefined();
  });

  it('гонка параллельных запросов веба: почти сразу после ротации тот же токен ещё принимается', async () => {
    const first = await loggedInAgent();

    // Первый запрос — легитимная ротация. Второй — «параллельный» запрос
    // браузера с тем же ещё-не-замененным cookie: middleware.ts вызывает
    // /auth/refresh независимо для каждого запроса, и оба видят одну и ту же
    // куку, пока браузер не применил новый Set-Cookie.
    const rotated = await refreshSession(first.refreshToken);
    const race = await refreshSession(first.refreshToken);

    expect(race.accessToken).not.toBe(rotated.accessToken);
    expect(race.refreshToken).not.toBe(rotated.refreshToken);

    // Тревога не поднята: обе выданные сессии рабочие, ни одна не отозвана.
    await expect(refreshSession(rotated.refreshToken)).resolves.toBeDefined();
    await expect(refreshSession(race.refreshToken)).resolves.toBeDefined();
  });

  it('гонка не пишется в журнал как кража', async () => {
    const since = new Date();
    const first = await loggedInAgent();
    await refreshSession(first.refreshToken);
    await refreshSession(first.refreshToken);

    const stolen = await prisma.activityLog.count({
      where: { action: ACTIVITY.REFRESH_REUSE_DETECTED, createdAt: { gte: since } },
    });
    expect(stolen).toBe(0);
  });

  it('повтор ЗА пределами окна допуска — тревога и отзыв всех сессий', async () => {
    const first = await loggedInAgent();
    const rotated = await refreshSession(first.refreshToken);

    // Отодвигаем момент отзыва за пределы допуска напрямую в базе — не сном
    // в тесте (иначе тест то падает, то нет, см. vitest.integration.config.ts).
    await prisma.refreshToken.update({
      where: { tokenHash: hashRefreshToken(first.refreshToken) },
      data: { revokedAt: new Date(Date.now() - REFRESH_REUSE_GRACE_MS - 1_000) },
    });

    await expect(refreshSession(first.refreshToken)).rejects.toBeInstanceOf(UnauthenticatedError);

    // «Отозвать все сессии» — то есть и легитимного преемника тоже,
    // а не только повторно предъявленный токен.
    await expect(refreshSession(rotated.refreshToken)).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it('настоящая кража по-прежнему пишется в журнал', async () => {
    const first = await loggedInAgent();
    await refreshSession(first.refreshToken);

    await prisma.refreshToken.update({
      where: { tokenHash: hashRefreshToken(first.refreshToken) },
      data: { revokedAt: new Date(Date.now() - REFRESH_REUSE_GRACE_MS - 1_000) },
    });

    await expect(refreshSession(first.refreshToken)).rejects.toBeInstanceOf(UnauthenticatedError);

    const entry = await prisma.activityLog.findFirst({
      where: { action: ACTIVITY.REFRESH_REUSE_DETECTED },
      orderBy: { createdAt: 'desc' },
    });
    expect(entry).not.toBeNull();
  });

  it('несуществующий токен отвергается без допусков', async () => {
    await expect(refreshSession('не-существует-совсем')).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });
});
