import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';

const root = dirname(fileURLToPath(import.meta.url));
const outdir = resolve(root, 'dist');

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

// Статика: manifest.json и popup.html идут в сборку как есть.
await cp(resolve(root, 'public'), outdir, { recursive: true });

// Сборщик нужен потому, что MV3 не умеет разрешать модули из node_modules:
// service worker и content script обязаны быть самодостаточными файлами.
await esbuild.build({
  entryPoints: {
    popup: resolve(root, 'src/popup/popup.ts'),
  },
  outdir,
  bundle: true,
  format: 'esm',
  target: 'chrome120',
  platform: 'browser',
  sourcemap: true,
  logLevel: 'info',
});
