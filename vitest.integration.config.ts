import { defineConfig } from 'vitest/config';

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
    testTimeout: 20_000,
  },
});
