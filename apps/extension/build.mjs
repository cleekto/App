import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';

const root = dirname(fileURLToPath(import.meta.url));
const outdir = resolve(root, 'dist');

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

// Статика: popup.html идёт в сборку как есть, manifest.json — с правкой ниже.
await cp(resolve(root, 'public'), outdir, { recursive: true });

/**
 * Адреса сервера подставляются на сборке.
 *
 * В расширении нет `.env`: у страницы расширения нет процесса, из которого
 * его читать. Значение приходит из окружения сборки, а по умолчанию —
 * локальная разработка. Секретов здесь нет и быть не может: всё, что попало
 * в бандл расширения, публично по определению.
 */
const define = {
  __CLEEKTO_API_URL__: JSON.stringify(process.env.CLEEKTO_API_URL ?? 'http://localhost:3000'),
  __CLEEKTO_APP_URL__: JSON.stringify(process.env.CLEEKTO_APP_URL ?? 'http://localhost:3000'),
};

/**
 * `host_permissions` приводится в соответствие с адресом API.
 *
 * Иначе манифест и бандл разъезжаются: собранное расширение стучится
 * на боевой адрес, а разрешение в манифесте осталось на localhost — и
 * service worker получает сетевую ошибку без внятной причины. Проверять
 * это руками при каждой сборке никто не станет, поэтому делает сборка.
 */
{
  const manifestPath = resolve(outdir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  const api = new URL(process.env.CLEEKTO_API_URL ?? 'http://localhost:3000');
  manifest.host_permissions = [`${api.origin}/*`];

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

const shared = {
  bundle: true,
  target: 'chrome120',
  platform: 'browser',
  sourcemap: true,
  define,
  logLevel: 'info',
};

// Сборщик нужен потому, что MV3 не умеет разрешать модули из node_modules:
// service worker и content script обязаны быть самодостаточными файлами.
await esbuild.build({
  ...shared,
  entryPoints: {
    popup: resolve(root, 'src/popup/popup.ts'),
    'service-worker': resolve(root, 'src/background/service-worker.ts'),
  },
  outdir,
  format: 'esm',
});

/**
 * Content script собирается отдельно и в IIFE.
 *
 * MV3 не грузит content script как ES-модуль: в манифесте для него нет
 * `"type": "module"`, а `import` в таком файле — синтаксическая ошибка
 * во время исполнения. Разделение сборки здесь вынужденное, а не стилевое.
 */
await esbuild.build({
  ...shared,
  entryPoints: { content: resolve(root, 'src/content/content.ts') },
  outdir,
  format: 'iife',
});
