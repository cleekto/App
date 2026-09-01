#!/usr/bin/env node
/**
 * Применяет миграции при боевой сборке на хостинге.
 *
 * ЗАЧЕМ. Схема и код выкатываются вместе. Если миграции применяются отдельной
 * командой руками, рано или поздно её забудут — и приложение поедет на базу
 * без нужной таблицы. Отказ будет выглядеть как случайная ошибка в проде,
 * а не как «забыли шаг».
 *
 * ТОЛЬКО ДЛЯ PRODUCTION. Предварительные сборки (preview) базу не трогают:
 * они поднимаются на каждый push в ветку, и мигрировать боевую базу из ветки,
 * которую ещё никто не смотрел, — прямой путь потерять данные агентства.
 *
 * Локально ничего не делает: `VERCEL_ENV` там не задан, а миграции в разработке
 * применяются `pnpm db:migrate`, где есть и откат, и создание файла миграции.
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const environment = process.env.VERCEL_ENV;

if (environment !== 'production') {
  console.log(
    environment === undefined
      ? '[migrate] не хостинг — миграции не применяются'
      : `[migrate] окружение «${environment}», не production — миграции не применяются`,
  );
  process.exit(0);
}

/**
 * Прямое подключение для миграций.
 *
 * Интеграция Neon с Vercel прописывает переменные под своими именами:
 * `DATABASE_URL` через пулер и `DATABASE_URL_UNPOOLED` мимо него. Prisma
 * ждёт `DIRECT_URL`. Принимаем оба имени, чтобы человеку не приходилось
 * переписывать переменную руками ради разницы в названии, — а руками
 * переписывают с опечатками.
 *
 * Через пулер миграции не идут: в режиме transaction pgbouncer не держит
 * сессию, а миграции её требуют.
 */
const directUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED;

if (directUrl === undefined) {
  // Не молчаливый пропуск: сборка без строки подключения соберётся, а первый
  // же запрос упадёт. Лучше остановиться здесь.
  console.error(
    '[migrate] нет ни DIRECT_URL, ни DATABASE_URL_UNPOOLED — миграции применить не к чему',
  );
  process.exit(1);
}

if (directUrl.includes('-pooler')) {
  console.error('[migrate] прямое подключение указывает на пулер — миграции через него не пройдут');
  process.exit(1);
}

console.log('[migrate] production: применяю миграции');

const result = spawnSync('prisma', ['migrate', 'deploy'], {
  cwd: resolve(root, 'packages/db'),
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    DIRECT_URL: directUrl,
    PATH: [
      resolve(root, 'packages/db/node_modules/.bin'),
      resolve(root, 'node_modules/.bin'),
      process.env.PATH,
    ].join(process.platform === 'win32' ? ';' : ':'),
  },
});

process.exit(result.status ?? 1);
