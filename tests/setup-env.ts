import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { assertSelectedTestDatabase } from '../packages/core/src/seed/test-database-target';

/**
 * Подхватывает корневой .env для интеграционных тестов.
 *
 * Vitest сам файлы окружения для node-тестов не читает. Локально переменные
 * приходят из .env, в CI — из окружения. DATABASE_URL к этому моменту уже
 * обязан быть выбран config-ом из проверенного TEST_DATABASE_URL.
 */
const envFile = resolve(import.meta.dirname, '..', '.env');

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

assertSelectedTestDatabase();
