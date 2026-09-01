import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,

  // Корень монорепозитория указан явно. Без этого Next пытается вывести его
  // сам, уходит вверх по дереву каталогов и на Windows упирается в системную
  // ссылку «Application Data», которая ссылается сама на себя.
  outputFileTracingRoot: resolve(dirname(fileURLToPath(import.meta.url)), '../..'),

  /**
   * Движок Prisma кладётся в бандл функции принудительно.
   *
   * ЗАЧЕМ. Сгенерированный клиент лежит по адресу вида
   * `node_modules/.pnpm/@prisma+client@…/node_modules/.prisma/client/`,
   * то есть за симлинками pnpm. Трассировка Next идёт по графу импортов
   * и до бинарного файла движка не доходит: его никто не импортирует,
   * его находят по пути во время работы.
   *
   * Итог без этой настройки: сборка проходит, приложение поднимается,
   * а первый же запрос к базе падает с `engine_missing`. Найдено ровно так
   * на боевом развёртывании.
   *
   * Пути относительны `outputFileTracingRoot`, то есть корня монорепозитория.
   */
  outputFileTracingIncludes: {
    '/**/*': [
      '../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/**/*',
      '../../node_modules/.pnpm/@prisma+client*/node_modules/@prisma/client/**/*',
    ],
  },

  // Пакеты монорепозитория поставляются исходниками на TypeScript.
  transpilePackages: ['@cleekto/contracts', '@cleekto/core', '@cleekto/i18n', '@cleekto/db'],

  // Не бандлятся: оба пакета подгружают нативные бинарники по пути,
  // который бандлер переписать не может. Webpack пытается разобрать .node
  // как исходник и падает.
  serverExternalPackages: ['@prisma/client', '@node-rs/argon2'],

  // serverExternalPackages не действует на зависимости пакетов из
  // transpilePackages: @cleekto/core транспилируется, и argon2 утягивается
  // в бандл вместе с ним. Помечаем внешним напрямую.
  //
  // ВАЖНО: раз пакет объявлен внешним, собранный сервер требует его во время
  // работы — и требует ИЗ apps/web. Поэтому `@node-rs/argon2` записан
  // в зависимости самого приложения, хотя пользуется им только ядро. Без этого
  // pnpm не кладёт его в node_modules приложения, трассировка Vercel не берёт
  // его в бандл функции, и каждая страница отвечает 500.
  //
  // Ни сборка, ни `next dev` этого не ловят: сборка не выполняет require,
  // а в разработке пакет разрешается через workspace. Ловится только запуском
  // production-сборки — что и случилось на Vercel.
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals ?? []), '@node-rs/argon2'];
    }
    return config;
  },

  /**
   * Заголовки безопасности, не зависящие от запроса.
   *
   * CSP здесь НЕТ: она требует одноразового числа на каждый запрос и живёт
   * в `middleware.ts`. Статическая CSP пришлось бы разрешить `unsafe-inline`
   * для скриптов, а такая политика защищает ровно от того, чего и так
   * не бывает.
   *
   * Найдено отсутствующим при аудите фазы 8 (`docs/AUDIT.md` §4.2).
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Дублирует `frame-ancestors` из CSP для браузеров постарше.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Адрес карточки объекта не должен утекать на площадку по клику
          // на ссылку объявления.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
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
