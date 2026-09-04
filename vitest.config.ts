import { defineConfig } from 'vitest/config';

export default defineConfig({
  /*
   * Константы сборки расширения.
   *
   * В собранном файле их подставляет `apps/extension/build.mjs` через
   * `define`; без них модуль `core/config.ts` падает при загрузке, и вместе
   * с ним — всё, что его импортирует. Значение намеренно непохоже на
   * настоящее: тест, случайно завязавшийся на боевой адрес, должен быть
   * виден сразу.
   */
  define: {
    __KLEEKTO_API_URL__: JSON.stringify('https://kleekto.test'),
    __KLEEKTO_APP_URL__: JSON.stringify('https://kleekto.test'),
  },
  test: {
    // Интеграционные тесты вынесены в *.integration.test.ts: им нужна живая
    // база, и `pnpm test` на свежем клоне не должен падать из-за того, что
    // Docker ещё не поднят. Их запускает `pnpm test:integration` и CI.
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/*.integration.test.ts'],
    environment: 'node',
    passWithNoTests: false,
  },
});
