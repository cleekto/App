// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/build/**',
      '**/coverage/**',
      'packages/db/generated/**',
      // Генерируется Next при каждой сборке и правке не подлежит —
      // в файле об этом написано прямым текстом.
      '**/next-env.d.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.node },
    },
    rules: {
      // Правило 7: никаких `any` и пустых catch.
      '@typescript-eslint/no-explicit-any': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],

      // Правило 7: никаких заглушек, оставленных «на потом», без явной пометки.
      'no-warning-comments': [
        'warn',
        { terms: ['todo', 'fixme', 'заглушка'], location: 'anywhere' },
      ],

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Инвариант 6 (ADR-0001): направление зависимостей только вниз.
  // Логика площадок не протекает в ядро. Нарушение роняет CI,
  // а не остаётся на усмотрение ревью.
  // ─────────────────────────────────────────────────────────────
  {
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@kleekto/adapters', '@kleekto/adapters/*'],
              message:
                'Инвариант 6: ядро не знает о конкретных площадках. Логика ss.ge и myhome.ge живёт только в packages/adapters.',
            },
            {
              group: ['next', 'next/*', 'react', 'react/*'],
              message:
                'ADR-0001: packages/core не знает о HTTP, куки и UI. Сценарий обязан вызываться в тесте без Next.js.',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['packages/adapters/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@kleekto/core', '@kleekto/core/*', '@kleekto/db', '@kleekto/db/*'],
              message:
                'Адаптер извлекает и заполняет. Решения принимает ядро; в базу адаптер не ходит (инвариант 2).',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['packages/contracts/**/*.ts', 'packages/i18n/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@kleekto/*'],
              message:
                'ADR-0001: contracts и i18n не зависят ни от чего внутри монорепозитория — их импортируют и веб, и расширение.',
            },
          ],
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // ADR-0008: ни одной пользовательской строки в коде.
  // Три языка обязательны, и захардкоженный текст переводу не подлежит.
  // ─────────────────────────────────────────────────────────────
  {
    files: ['apps/web/**/*.tsx'],
    plugins: { react },
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/jsx-no-literals': [
        'error',
        { noStrings: true, ignoreProps: true, allowedStrings: [] },
      ],
    },
  },

  {
    files: ['apps/extension/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
  },

  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/vitest.config.ts', 'vitest.workspace.ts'],
    rules: {
      'no-restricted-imports': 'off',
      'no-console': 'off',
    },
  },

  {
    /**
     * Скрипты сборки и обслуживания.
     *
     * Их вывод — это и есть интерфейс: человек читает его в логе сборки,
     * чтобы понять, что произошло. Запрет `console.log` здесь превратил бы
     * сообщения о ходе работы в предупреждения, а предупреждение, которое
     * не про проблему, перестают замечать.
     */
    files: ['scripts/**/*.mjs'],
    rules: {
      'no-console': 'off',
    },
  },
);
