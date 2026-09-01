#!/usr/bin/env node
/**
 * Печатает значения для настроек Vercel.
 *
 * Существует, чтобы не собирать четыре строки вручную из трёх мест и не
 * ошибиться в главном: `DATABASE_URL` обязан идти через пулер, `DIRECT_URL` —
 * мимо него. Перепутать их легко, а последствия разные: без пулера соединения
 * кончатся под нагрузкой, а миграции через пулер в режиме transaction
 * не пройдут вовсе.
 *
 * Секрет подписи генерируется здесь же и КАЖДЫЙ РАЗ НОВЫЙ. Если он уже задан
 * в Vercel — не меняйте: смена разлогинивает всех разом.
 */
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = resolve(root, '.env');

if (existsSync(envFile)) process.loadEnvFile(envFile);

const pooled = process.env.NEON_DATABASE_URL;
const direct = process.env.NEON_DIRECT_URL;

if (pooled === undefined || direct === undefined) {
  console.error('NEON_DATABASE_URL и NEON_DIRECT_URL не найдены в .env.');
  console.error('Возьмите обе строки в консоли Neon: Connect → Pooled и Direct.');
  process.exit(1);
}

if (!pooled.includes('-pooler')) {
  console.error('NEON_DATABASE_URL не похож на адрес через пулер: в нём нет «-pooler».');
  process.exit(1);
}
if (direct.includes('-pooler')) {
  console.error('NEON_DIRECT_URL не должен идти через пулер, а идёт.');
  process.exit(1);
}

console.log('Vercel → Settings → Environment Variables → Add. Отметьте все три среды.\n');
console.log(`DATABASE_URL\n${pooled}\n`);
console.log(`DIRECT_URL\n${direct}\n`);
console.log(`AUTH_JWT_SECRET\n${randomBytes(48).toString('base64url')}\n`);
console.log('DEFAULT_LOCALE\nru\n');
console.log('AUTH_JWT_SECRET печатается новым при каждом запуске.');
console.log('Если он уже задан в Vercel — оставьте прежний: смена разлогинит всех.');
