/**
 * Имена кук сессии.
 *
 * Вынесены из `handler.ts` в файл без единой внешней зависимости.
 * `middleware.ts` работает в Edge-окружении и импортирует их: если бы имена
 * остались в `handler.ts`, тянущем `@cleekto/core` (там `requireAuth` зовёт
 * `verifyAccessToken`), в edge-бандл попал бы весь барель ядра целиком —
 * включая `exceljs` и `node:crypto`, которых Edge не умеет. Сборка находит
 * это только на `next build`, не на `next dev` и не на typecheck.
 */
export const ACCESS_COOKIE = 'cleekto_access';
export const REFRESH_COOKIE = 'cleekto_refresh';
