import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

/**
 * Запас времени зависит от того, где стоит база.
 *
 * Локально каждый запрос — доли миллисекунды, и двадцати секунд на тест
 * с избытком: если тест в них не уложился, он и правда медленный, и это
 * надо увидеть. По сети до ветки разработки в облаке тот же тест делает
 * те же сто запросов, но каждый идёт через океан — двадцати секунд не
 * хватает, и падают заведомо исправные проверки.
 *
 * Поэтому предел выбирается по адресу базы, а не задирается глобально:
 * иначе локальная медленность перестала бы быть заметной.
 */
const envFile = resolve(import.meta.dirname, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const url = process.env.DATABASE_URL ?? '';
const isLocal = /localhost|127\.0\.0\.1|@postgres[:/]/u.test(url);

/**
 * Интеграционные тесты. Требуют работающей базы: `pnpm db:up && pnpm db:migrate`.
 *
 * Отделены от обычных не для удобства, а чтобы `pnpm test` оставался честным:
 * тест, который «пропускается, когда базы нет», рано или поздно пропускается
 * всегда и перестаёт что-либо проверять.
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
