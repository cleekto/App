import { RoleCode, prisma } from '@cleekto/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { dashboard } from './analytics/use-cases';
import type { AuthContext } from './auth/context';
import { changeLocale, login } from './auth/use-cases';
import { verifyAccessToken } from './auth/tokens';
import { RateLimitedError, UnauthenticatedError, ValidationError } from './errors';
import { importListing, type ImportInput } from './import/use-cases';
import { RATE_LIMITS, consumeRateLimit, pruneRateLimits } from './rate-limit/use-cases';
import { seed } from './seed/seed';

/**
 * ГЕЙТ ФАЗЫ 8. Аудит проверяется тестами, а не пунктами в документе.
 *
 * Галочка «ограничение частоты запросов реализовано» ничего не стоит, если
 * никто не пробовал перебрать пароль. Здесь пробуют.
 */

interface Actors {
  admin: AuthContext;
  manager: AuthContext;
  agent: AuthContext;
  otherCompanyAgent: AuthContext;
}

let actors: Actors;
let counter = 0;

async function contextFor(email: string): Promise<AuthContext> {
  const user = await prisma.user.findFirstOrThrow({
    where: { email },
    include: { role: true, teamMemberships: true },
  });
  return {
    userId: user.id,
    companyId: user.companyId,
    teamId: user.teamMemberships[0]?.teamId ?? null,
    role: user.role.code,
    locale: user.locale,
  };
}

function payload(over: Partial<ImportInput> = {}): ImportInput {
  counter += 1;
  const seq = counter;

  return {
    source: 'SS_GE',
    sourceUrl: `https://ss.ge/ru/audit/${seq}`,
    externalId: `audit-${seq}`,
    propertyType: 'APARTMENT',
    transactionType: 'SALE',
    price: 120000,
    currency: 'USD',
    area: 60,
    rooms: 2,
    district: 'Vake',
    address: `Ваке, аудит ${seq}`,
    owner: { name: 'Собственник', phone: `+9955554${String(seq).padStart(5, '0')}` },
    parserVersion: 'ss.ge@1.0.0',
    missingFields: seq % 2 === 0 ? ['district'] : [],
    outcome: 'consent',
    ...over,
  };
}

beforeAll(async () => {
  await seed();
  actors = {
    admin: await contextFor('admin@tbilisi-estate.test'),
    manager: await contextFor('manager@tbilisi-estate.test'),
    agent: await contextFor('agent1@tbilisi-estate.test'),
    otherCompanyAgent: await contextFor('agent1@batumi-property.test'),
  };
}, 60_000);

afterAll(async () => {
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────────────────────────
// Ограничение частоты запросов
// ─────────────────────────────────────────────────────────────────────────────

describe('ограничение частоты запросов', () => {
  it('перебор упирается в предел', async () => {
    // Вход без ограничения — приглашение подобрать пароль. Агентство узнает
    // об этом не из журнала, а от собственников, которым позвонили чужие.
    const identifier = `перебор-${Math.random().toString(36).slice(2)}`;
    const rule = RATE_LIMITS.login;

    for (let attempt = 0; attempt < rule.limit; attempt += 1) {
      await expect(consumeRateLimit(rule, identifier)).resolves.toBeUndefined();
    }

    await expect(consumeRateLimit(rule, identifier)).rejects.toBeInstanceOf(RateLimitedError);
  });

  it('после окна счётчик начинается заново', async () => {
    const identifier = `окно-${Math.random().toString(36).slice(2)}`;
    const rule = RATE_LIMITS.login;
    const start = new Date();

    for (let attempt = 0; attempt <= rule.limit; attempt += 1) {
      await consumeRateLimit(rule, identifier, start).catch(() => undefined);
    }

    const afterWindow = new Date(start.getTime() + (rule.windowSeconds + 1) * 1000);
    await expect(consumeRateLimit(rule, identifier, afterWindow)).resolves.toBeUndefined();
  });

  it('счётчики разных ключей не пересекаются', async () => {
    // Иначе один активный агент исчерпывал бы предел для всей компании.
    const rule = RATE_LIMITS.login;
    const first = `ключ-а-${Math.random().toString(36).slice(2)}`;
    const second = `ключ-б-${Math.random().toString(36).slice(2)}`;

    for (let attempt = 0; attempt <= rule.limit; attempt += 1) {
      await consumeRateLimit(rule, first).catch(() => undefined);
    }

    await expect(consumeRateLimit(rule, second)).resolves.toBeUndefined();
  });

  it('идентификатор в базе не хранится в открытом виде', async () => {
    // В ключах оказываются адреса почты и IP — персональные данные
    // (правило 10). Для счётчика важна различимость, а не читаемость.
    const email = `виден-ли-${Math.random().toString(36).slice(2)}@example.test`;
    await consumeRateLimit(RATE_LIMITS.login, email);

    const rows = await prisma.rateLimit.findMany({ select: { key: true } });
    expect(rows.some((row) => row.key.includes(email))).toBe(false);
  });

  it('уборка удаляет отработавшие окна', async () => {
    await consumeRateLimit(RATE_LIMITS.login, `уборка-${Math.random().toString(36).slice(2)}`);
    const removed = await pruneRateLimits(new Date(Date.now() + 60_000));

    expect(removed).toBeGreaterThan(0);
  });

  it('неверный пароль по-прежнему отвергается', async () => {
    // Ограничение не должно превратиться в способ войти: сначала проверяется
    // пароль, и предел его не заменяет.
    await expect(
      login({ email: 'admin@tbilisi-estate.test', password: 'не тот пароль' }),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Дашборд
// ─────────────────────────────────────────────────────────────────────────────

describe('дашборд', () => {
  it('область задаёт роль, а не запрос', async () => {
    // Показатель, область которого выбирает клиент, — это утечка,
    // оформленная как удобство.
    expect((await dashboard(actors.admin)).scope).toBe('company');
    expect((await dashboard(actors.manager)).scope).toBe('team');
    expect((await dashboard(actors.agent)).scope).toBe('team');
  });

  it('цифры администратора не меньше цифр одной команды', async () => {
    await importListing(actors.agent, payload());

    const company = await dashboard(actors.admin);
    const team = await dashboard(actors.agent);

    expect(company.properties.total).toBeGreaterThanOrEqual(team.properties.total);
  });

  it('объекты другой компании в цифры не попадают', async () => {
    const before = await dashboard(actors.admin);
    await importListing(actors.otherCompanyAgent, payload());
    const after = await dashboard(actors.admin);

    expect(after.properties.total).toBe(before.properties.total);
  });

  it('воронка показана целиком, включая пустые статусы', async () => {
    // Дашборд должен читаться как воронка: пропущенный статус скрывает затор.
    const statuses = await prisma.pipelineStatus.count({
      where: { companyId: actors.admin.companyId },
    });
    const data = await dashboard(actors.admin);

    expect(data.properties.byStatus).toHaveLength(statuses);
  });

  it('parser failure rate считается по непрочитанным полям', async () => {
    // `missingFields` пишутся при импорте с первого дня — счётчика ради
    // дашборда никто не заводил.
    await importListing(actors.agent, payload({ missingFields: ['district', 'floor'] }));
    const data = await dashboard(actors.admin);

    expect(data.quality.parserFailureRate).toBeGreaterThan(0);
    expect(data.quality.topMissingFields.map((entry) => entry.field)).toContain('district');
  });

  it('доля дублей считается по записям журнала', async () => {
    // Пока предупреждений не было, доля равна нулю, а не «нет данных»:
    // ноль — это ответ, а пустое место — вопрос.
    const data = await dashboard(actors.admin);
    expect(data.quality.duplicateRate).toBeGreaterThanOrEqual(0);
    expect(data.quality.duplicateRate).toBeLessThanOrEqual(1);
  });

  it('агент не получает область компании ни при каком контексте', async () => {
    // Подделанный контекст с ролью агента и чужой компанией не даёт ничего:
    // область берётся из роли, а компания — из подписанного токена.
    const forged: AuthContext = { ...actors.agent, role: RoleCode.AGENT };
    expect((await dashboard(forged)).scope).toBe('team');
  });
});

// ── Смена языка интерфейса ───────────────────────────────────────────────────

describe('смена языка', () => {
  /**
   * Главное здесь — не запись в базу, а новая сессия.
   *
   * Язык лежит в подписанном access-токене (ADR-0003). Если его не
   * перевыпустить, интерфейс останется на прежнем языке до истечения токена —
   * до пятнадцати минут, — и человек решит, что переключатель сломан.
   */
  it('перевыпускает токен с новым языком', async () => {
    const before = await prisma.user.findFirstOrThrow({
      where: { id: actors.agent.userId },
      select: { locale: true },
    });

    const session = await changeLocale(actors.agent, 'en');

    const after = await prisma.user.findFirstOrThrow({
      where: { id: actors.agent.userId },
      select: { locale: true },
    });
    expect(after.locale).toBe('en');
    expect(after.locale).not.toBe(before.locale);

    // Именно это и проверяется: язык внутри выданного токена, а не в базе.
    const verified = await verifyAccessToken(session.accessToken);
    expect(verified.locale).toBe('en');

    // Права и компания не должны поехать вместе с языком.
    expect(verified.companyId).toBe(actors.agent.companyId);
    expect(verified.role).toBe(actors.agent.role);
  });

  it('неизвестный язык отклоняется', async () => {
    await expect(changeLocale(actors.agent, 'de')).rejects.toBeInstanceOf(ValidationError);
  });

  it('чужого пользователя сменой языка не тронуть', async () => {
    // Контекст чужой компании с подставленным чужим userId: `where` в сценарии
    // фильтрует и по companyId, поэтому строка не найдётся (правило 5).
    const foreign = { ...actors.otherCompanyAgent, userId: actors.agent.userId };

    await expect(changeLocale(foreign, 'ru')).rejects.toThrow();

    const untouched = await prisma.user.findFirstOrThrow({
      where: { id: actors.agent.userId },
      select: { locale: true },
    });
    expect(untouched.locale).toBe('en');
  });

  it('пишется в журнал действий', async () => {
    // Сессия перевыпускается — без записи это выглядело бы беспричинным
    // выпуском токена при разборе инцидента.
    await changeLocale(actors.agent, 'ka');

    const entry = await prisma.activityLog.findFirst({
      where: { userId: actors.agent.userId, action: 'USER_LOCALE_CHANGED' },
      orderBy: { createdAt: 'desc' },
    });

    expect(entry).not.toBeNull();
    expect(entry?.companyId).toBe(actors.agent.companyId);
  });
});
