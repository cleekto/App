/**
 * Контракты API: схемы запросов, ответов и ошибок.
 *
 * Пакет не зависит ни от чего внутри монорепозитория — его импортируют и веб,
 * и расширение (ADR-0001). Появление здесь импорта из `@cleekto/core` или
 * `@cleekto/db` уронит линтер.
 *
 * Полное описание контракта: `docs/architecture/api-contracts.md`
 * и `docs/architecture/openapi.yaml`.
 */
export * from './errors';
export * from './health';
export * from './listing';
export * from './publish';

/** Версия API в пути. Инвариант 8: ломающее изменение — это `/api/v2`. */
export const API_VERSION = 'v1' as const;
export const API_BASE_PATH = `/api/${API_VERSION}` as const;
