export interface TestDatabaseTarget {
  url: string;
  descriptor: string;
  hostname: string;
  port: string;
  database: string;
  isLocal: boolean;
}

export interface ValidateTestDatabaseTargetInput {
  testDatabaseUrl?: string | undefined;
  testDatabaseTarget?: string | undefined;
  forbiddenDatabaseUrls?: readonly (string | undefined)[] | undefined;
}

const POSTGRES_PROTOCOLS = new Set(['postgresql:', 'postgres:']);
const DEFAULT_POSTGRES_PORT = '5432';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1', 'postgres']);

function parsePostgresTarget(raw: string, label: string): TestDatabaseTarget {
  let parsed: URL;

  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${label} имеет некорректный формат PostgreSQL URL.`);
  }

  if (!POSTGRES_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`${label} должен использовать протокол postgresql: или postgres:.`);
  }

  if (parsed.hostname === '') {
    throw new Error(`${label} должен содержать hostname.`);
  }

  const pathSegments = parsed.pathname.split('/').filter((segment) => segment !== '');
  if (pathSegments.length !== 1) {
    throw new Error(`${label} должен указывать ровно одно имя базы данных.`);
  }

  let database: string;
  try {
    database = decodeURIComponent(pathSegments[0] ?? '');
  } catch {
    throw new Error(`${label} содержит некорректное имя базы данных.`);
  }

  if (database === '' || database.includes('/')) {
    throw new Error(`${label} должен указывать ровно одно имя базы данных.`);
  }

  const hostname = parsed.hostname.toLowerCase();
  const port = parsed.port === '' ? DEFAULT_POSTGRES_PORT : parsed.port;
  const descriptor = `${hostname}:${port}/${database}`;

  return {
    url: raw,
    descriptor,
    hostname,
    port,
    database,
    isLocal: LOCAL_HOSTS.has(hostname),
  };
}

function descriptorOf(raw: string | undefined): string | null {
  if (raw === undefined || raw.trim() === '') return null;

  try {
    return parsePostgresTarget(raw, 'database URL').descriptor;
  } catch {
    return null;
  }
}

/**
 * Pure validation for the destructive integration-test target.
 *
 * The acknowledgement contains only hostname:port/database. Credentials and
 * query parameters are deliberately excluded so error messages never need to
 * echo a secret-bearing URL.
 */
export function validateTestDatabaseTarget(
  input: ValidateTestDatabaseTargetInput,
): TestDatabaseTarget {
  const testDatabaseUrl = input.testDatabaseUrl?.trim() ?? '';
  if (testDatabaseUrl === '') {
    throw new Error('TEST_DATABASE_URL не задан.');
  }

  const validated = parsePostgresTarget(testDatabaseUrl, 'TEST_DATABASE_URL');

  const declaredTarget = input.testDatabaseTarget?.trim() ?? '';
  if (declaredTarget === '') {
    throw new Error(`TEST_DATABASE_TARGET не задан. Ожидается descriptor ${validated.descriptor}.`);
  }

  if (declaredTarget !== validated.descriptor) {
    throw new Error(
      `TEST_DATABASE_TARGET не совпадает с выбранной test DB. Ожидается ${validated.descriptor}.`,
    );
  }

  for (const forbiddenUrl of input.forbiddenDatabaseUrls ?? []) {
    const forbiddenDescriptor = descriptorOf(forbiddenUrl);
    if (forbiddenDescriptor !== null && forbiddenDescriptor === validated.descriptor) {
      throw new Error(
        'TEST_DATABASE_URL указывает на обычную application/deployment DB. Используйте отдельную test DB.',
      );
    }
  }

  return validated;
}

/**
 * Validates the dedicated test target before replacing DATABASE_URL.
 * Existing application/deployment URLs are treated as forbidden targets.
 */
export function selectTestDatabase(env: NodeJS.ProcessEnv = process.env): TestDatabaseTarget {
  const validated = validateTestDatabaseTarget({
    testDatabaseUrl: env.TEST_DATABASE_URL,
    testDatabaseTarget: env.TEST_DATABASE_TARGET,
    forbiddenDatabaseUrls: [
      env.DATABASE_URL,
      env.DIRECT_URL,
      env.DATABASE_URL_UNPOOLED,
      env.NEON_DATABASE_URL,
      env.NEON_DIRECT_URL,
    ],
  });

  env.DATABASE_URL = validated.url;
  return validated;
}

/**
 * Defense in depth for destructive seed execution.
 *
 * The selected DATABASE_URL must be the exact validated TEST_DATABASE_URL,
 * not merely another URL that happens to resolve to the same host/database.
 */
export function assertSelectedTestDatabase(
  env: NodeJS.ProcessEnv = process.env,
): TestDatabaseTarget {
  if (env.NODE_ENV === 'production') {
    throw new Error('Destructive seed запрещён при NODE_ENV=production.');
  }

  const validated = validateTestDatabaseTarget({
    testDatabaseUrl: env.TEST_DATABASE_URL,
    testDatabaseTarget: env.TEST_DATABASE_TARGET,
  });

  if (env.DATABASE_URL === undefined || env.DATABASE_URL !== validated.url) {
    throw new Error(
      'DATABASE_URL не был выбран из проверенного TEST_DATABASE_URL. Destructive seed остановлен.',
    );
  }

  return validated;
}
