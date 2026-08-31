import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Подхватывает корневой .env для интеграционных тестов.
 *
 * Vitest сам файлы окружения для node-тестов не читает. Логика та же, что
 * в `scripts/with-env.mjs`: локально переменные приходят из .env, в CI — из
 * окружения, где файла нет, и это норма.
 */
const envFile = resolve(import.meta.dirname, '..', '.env');

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

if (process.env.DATABASE_URL === undefined) {
  throw new Error(
    'Интеграционные тесты требуют живой базы. Выполни: pnpm db:up && pnpm db:migrate',
  );
}
