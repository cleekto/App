import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,

  // Корень монорепозитория указан явно. Без этого Next пытается вывести его
  // сам, уходит вверх по дереву каталогов и на Windows упирается в системную
  // ссылку «Application Data», которая ссылается сама на себя.
  outputFileTracingRoot: resolve(dirname(fileURLToPath(import.meta.url)), '../..'),

  // Пакеты монорепозитория поставляются исходниками на TypeScript.
  transpilePackages: ['@cleekto/contracts', '@cleekto/i18n', '@cleekto/db'],

  // Prisma не бандлится: клиент подгружает бинарный движок по пути,
  // который бандлер переписать не может.
  serverExternalPackages: ['@prisma/client'],

  typescript: {
    // Ошибки типов роняют сборку. Правило 4: «готово» — это зелёный typecheck.
    ignoreBuildErrors: false,
  },
  eslint: {
    // Линтер запускается отдельной командой на весь монорепозиторий.
    ignoreDuringBuilds: true,
  },
};

export default config;
