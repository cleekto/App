import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

import { selectTestDatabase } from './packages/core/src/seed/test-database-target';

/**
 * Integration config обязан fail-closed выбрать отдельную test DB до загрузки
 * setup-файлов, test modules и Prisma.
 */
const envFile = resolve(import.meta.dirname, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const testDatabase = selectTestDatabase();
const isLocal = testDatabase.isLocal;

/**
 * Запас времени зависит от ПРОВЕРЕННОГО test target.
 *
 * Локально каждый запрос — доли миллисекунды. По сети до отдельной test DB
 * тот же suite может делать много round-trips, поэтому remote timeout выше.
 */
export default defineConfig({
  test: {
    include: ['**/*.integration.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
    environment: 'node',
    setupFiles: ['./tests/setup-env.ts'],
    passWithNoTests: false,
    // Живая база и один клиент Prisma на процесс: параллельные файлы
    // дрались бы за соединения.
    fileParallelism: false,
    testTimeout: isLocal ? 20_000 : 120_000,
  },
});
