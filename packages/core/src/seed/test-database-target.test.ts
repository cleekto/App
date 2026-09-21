import { afterEach, describe, expect, it, vi } from 'vitest';

import { selectTestDatabase, validateTestDatabaseTarget } from './test-database-target';

const seedMocks = vi.hoisted(() => ({
  firstDeleteMany: vi.fn(),
}));

vi.mock('@kleekto/db', () => ({
  RoleCode: {
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    AGENT: 'AGENT',
  },
  prisma: {
    observationState: {
      deleteMany: seedMocks.firstDeleteMany,
    },
  },
}));

vi.mock('../auth/password', () => ({
  hashPassword: vi.fn(),
}));

vi.mock('../auth/roles', () => ({
  ensureRoles: vi.fn(),
}));

vi.mock('../phone', () => ({
  normalizePhone: vi.fn(),
}));

vi.mock('../pipeline/defaults', () => ({
  DEFAULT_PIPELINE_STATUSES: [],
}));

import { seed } from './seed';

const LOCAL_TEST_URL =
  'postgresql://test-user:test-password@localhost:5432/kleekto_test?schema=public';
const LOCAL_TEST_TARGET = 'localhost:5432/kleekto_test';

afterEach(() => {
  vi.unstubAllEnvs();
  seedMocks.firstDeleteMany.mockClear();
});

describe('test database target validation', () => {
  it('rejects missing TEST_DATABASE_URL', () => {
    expect(() =>
      validateTestDatabaseTarget({
        testDatabaseTarget: LOCAL_TEST_TARGET,
      }),
    ).toThrow('TEST_DATABASE_URL не задан');
  });

  it('rejects malformed TEST_DATABASE_URL', () => {
    expect(() =>
      validateTestDatabaseTarget({
        testDatabaseUrl: 'not-a-url',
        testDatabaseTarget: LOCAL_TEST_TARGET,
      }),
    ).toThrow('некорректный формат');
  });

  it('rejects unsupported protocols', () => {
    expect(() =>
      validateTestDatabaseTarget({
        testDatabaseUrl: 'mysql://user:password@localhost:3306/kleekto_test',
        testDatabaseTarget: 'localhost:3306/kleekto_test',
      }),
    ).toThrow('postgresql: или postgres:');
  });

  it('rejects missing TEST_DATABASE_TARGET', () => {
    expect(() =>
      validateTestDatabaseTarget({
        testDatabaseUrl: LOCAL_TEST_URL,
      }),
    ).toThrow('TEST_DATABASE_TARGET не задан');
  });

  it('rejects a target that does not match the selected database', () => {
    expect(() =>
      validateTestDatabaseTarget({
        testDatabaseUrl: LOCAL_TEST_URL,
        testDatabaseTarget: 'localhost:5432/not_the_test_database',
      }),
    ).toThrow('не совпадает');
  });

  it('rejects using the normal DATABASE_URL as the destructive test database', () => {
    expect(() =>
      selectTestDatabase({
        DATABASE_URL:
          'postgresql://dev-user:dev-password@localhost:5432/kleekto?schema=public',
        TEST_DATABASE_URL:
          'postgresql://other-user:other-password@localhost:5432/kleekto?schema=test',
        TEST_DATABASE_TARGET: 'localhost:5432/kleekto',
      }),
    ).toThrow('обычную application/deployment DB');
  });

  it('rejects using DIRECT_URL as the destructive test database', () => {
    expect(() =>
      selectTestDatabase({
        DIRECT_URL:
          'postgresql://owner:production-secret@db.example.com:5432/kleekto?sslmode=require',
        TEST_DATABASE_URL:
          'postgresql://test-user:test-secret@db.example.com/kleekto?schema=test',
        TEST_DATABASE_TARGET: 'db.example.com:5432/kleekto',
      }),
    ).toThrow('обычную application/deployment DB');
  });

  it('accepts a dedicated local database and selects it as DATABASE_URL', () => {
    const env: NodeJS.ProcessEnv = {
      DATABASE_URL: 'postgresql://kleekto:dev@localhost:5432/kleekto?schema=public',
      DIRECT_URL: 'postgresql://kleekto:dev@localhost:5432/kleekto?schema=public',
      TEST_DATABASE_URL: LOCAL_TEST_URL,
      TEST_DATABASE_TARGET: LOCAL_TEST_TARGET,
    };

    const selected = selectTestDatabase(env);

    expect(selected.descriptor).toBe(LOCAL_TEST_TARGET);
    expect(selected.isLocal).toBe(true);
    expect(env.DATABASE_URL).toBe(LOCAL_TEST_URL);
  });

  it('accepts an explicitly acknowledged remote dedicated test database', () => {
    const selected = validateTestDatabaseTarget({
      testDatabaseUrl:
        'postgres://integration:secret@ep-test.example.neon.tech/kleekto_test?sslmode=require',
      testDatabaseTarget: 'ep-test.example.neon.tech:5432/kleekto_test',
    });

    expect(selected.descriptor).toBe('ep-test.example.neon.tech:5432/kleekto_test');
    expect(selected.isLocal).toBe(false);
  });

  it('does not leak credentials or query secrets in validation errors', () => {
    const username = 'sensitive-user';
    const password = 'super-secret-password';
    const querySecret = 'query-secret-value';

    let message = '';
    try {
      validateTestDatabaseTarget({
        testDatabaseUrl:
          `postgresql://${username}:${password}@db.example.com/kleekto_test?sslpassword=${querySecret}`,
        testDatabaseTarget: 'wrong.example.com:5432/wrong',
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).not.toContain(username);
    expect(message).not.toContain(password);
    expect(message).not.toContain(querySecret);
    expect(message).not.toContain('postgresql://');
  });

  it('runs the destructive seed guard before the first deleteMany', async () => {
    vi.stubEnv('TEST_DATABASE_URL', LOCAL_TEST_URL);
    vi.stubEnv('TEST_DATABASE_TARGET', LOCAL_TEST_TARGET);
    vi.stubEnv(
      'DATABASE_URL',
      'postgresql://kleekto:dev@localhost:5432/kleekto?schema=public',
    );

    await expect(seed()).rejects.toThrow(
      'DATABASE_URL не был выбран из проверенного TEST_DATABASE_URL',
    );
    expect(seedMocks.firstDeleteMany).not.toHaveBeenCalled();
  });
});
