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
  transpilePackages: ['@cleekto/contracts', '@cleekto/core', '@cleekto/i18n', '@cleekto/db'],

  // Не бандлятся: оба пакета подгружают нативные бинарники по пути,
  // который бандлер переписать не может. Webpack пытается разобрать .node
  // как исходник и падает.
  serverExternalPackages: ['@prisma/client', '@node-rs/argon2'],

  // serverExternalPackages не действует на зависимости пакетов из
  // transpilePackages: @cleekto/core транспилируется, и argon2 утягивается
  // в бандл вместе с ним. Помечаем внешним напрямую.
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals ?? []), '@node-rs/argon2'];
    }
    return config;
  },

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
