/**
 * Доменная логика kleekTo.
 *
 * Пакет НЕ ЗНАЕТ о HTTP, куки, Next.js и Chrome (ADR-0001). Каждый сценарий
 * принимает `AuthContext` первым аргументом и не имеет доступа к запросу:
 * взять `companyId` из тела физически неоткуда — правило 5 обеспечено
 * структурой, а не дисциплиной.
 *
 * Импорт `@kleekto/adapters`, `next` и `react` отсюда роняет линтер:
 * логика площадок в ядро не протекает (инвариант 6).
 */

export * from './errors';
export * from './config';
export * from './phone';

export * from './auth/context';
export * from './auth/password';
export * from './auth/roles';
export * from './auth/tokens';
export * from './auth/use-cases';

export * from './rbac/permissions';
export * from './rbac/guard';

export * from './activity/actions';
export * from './activity/write';

export * from './users/use-cases';
export * from './teams/use-cases';
export * from './pipeline/defaults';
export * from './pipeline/use-cases';

export * from './normalize';
export * from './dedup/config';
export * from './dedup/scoring';
export * from './dedup/engine';
export * from './import/use-cases';

export * from './publish/draft';
export * from './publish/sanitize';
export * from './publish/use-cases';
export * from './chat/use-cases';

export * from './migration/mapping';
export * from './migration/parse';
export * from './migration/use-cases';

export * from './properties/use-cases';
export * from './tasks/use-cases';
export * from './comments/use-cases';
export * from './activity/feed';
export * from './analytics/use-cases';
export * from './rate-limit/use-cases';
