#!/usr/bin/env node
/**
 * Запускает команду в подкаталоге монорепозитория, подав ей переменные
 * из корневого `.env`.
 *
 * Зачем. Окружение в проекте одно и лежит в корне — иначе секреты пришлось бы
 * держать в нескольких файлах, и рано или поздно они разошлись бы. Но у
 * инструментов разные привычки: Next ищет `.env` рядом с приложением, Prisma —
 * рядом с собой, Vitest не ищет вовсе. Обёртка примиряет их, не заводя ни
 * второго `.env`, ни новой зависимости: `process.loadEnvFile` встроен в Node.
 *
 * Это инструмент локальной разработки. На хостинге переменные приходят из
 * настроек платформы, файла `.env` там нет, и обёртка это переживает.
 *
 * Использование:
 *   node scripts/with-env.mjs --cwd apps/web next dev
 *   node scripts/with-env.mjs --cwd packages/db prisma migrate dev
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = resolve(root, '.env');

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const args = process.argv.slice(2);

let workdir = root;
if (args[0] === '--cwd') {
  const target = args[1];
  if (target === undefined) {
    console.error('Флаг --cwd требует каталог.');
    process.exit(1);
  }
  workdir = resolve(root, target);
  args.splice(0, 2);
}

const [command, ...rest] = args;
if (command === undefined) {
  console.error('Нечего запускать. Пример: node scripts/with-env.mjs --cwd apps/web next dev');
  process.exit(1);
}

if (process.env.DATABASE_URL === undefined) {
  console.error(
    'DATABASE_URL не задан. Скопируй .env.example в .env либо задай переменную в окружении.',
  );
  process.exit(1);
}

// Исполняемые файлы зависимостей лежат в node_modules/.bin своего пакета,
// а не в PATH запускающей оболочки.
const binPaths = [
  resolve(workdir, 'node_modules/.bin'),
  resolve(root, 'node_modules/.bin'),
  process.env.PATH,
].join(delimiter);

const result = spawnSync(command, rest, {
  cwd: workdir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, PATH: binPaths },
});

process.exit(result.status ?? 1);
