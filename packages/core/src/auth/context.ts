import type { RoleCode } from '@kleekto/db';

/**
 * Кто выполняет действие.
 *
 * ПРАВИЛО 5. Собирается ТОЛЬКО из сессии, в одном месте — обработчике
 * маршрута. Сценарий получает готовый контекст аргументом и не имеет доступа
 * ни к запросу, ни к заголовкам, ни к куки. Взять companyId из тела запроса
 * физически неоткуда — правило обеспечено структурой, а не дисциплиной
 * (ADR-0001).
 */
export interface AuthContext {
  readonly userId: string;
  readonly companyId: string;
  /** Пусто у администратора компании: он может не состоять в команде. */
  readonly teamId: string | null;
  readonly role: RoleCode;
  readonly locale: string;
}

/**
 * Контекст системного действия — сида, миграции, фонового обслуживания.
 *
 * Отдельный тип, а не AuthContext с фиктивным пользователем: подделка
 * пользователя ради обхода прав рано или поздно попадёт в рабочий путь.
 * Сценарии, принимающие SystemContext, перечислимы и проверяемы.
 */
export interface SystemContext {
  readonly kind: 'system';
  readonly reason: string;
}

export function systemContext(reason: string): SystemContext {
  return { kind: 'system', reason };
}
