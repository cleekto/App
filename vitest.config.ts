import { defineConfig } from 'vitest/config';

export default defineConfig({
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
