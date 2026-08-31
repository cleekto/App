/**
 * Статусы воронки по умолчанию.
 *
 * Пять, а не десять: черновой набор из спецификации §10 отменён версией 2.2
 * (Q4, Q17). Первые шесть его стадий описывают период, когда объекта ещё нет,
 * и переехали в состояние объявления — до звонка объекта не существует.
 *
 * Инвариант 4: набор создаётся сидом и редактируется компанией. Хардкод
 * статусов в логике запрещён — код обращается к `PipelineStatus` по коду,
 * а не по порядковому номеру.
 *
 * Названия на английском: язык живёт на пользователе, а статусы — данные
 * компании, и агентство переименовывает их под себя на своём языке
 * (ADR-0008, следствие 7).
 */
export interface PipelineStatusSeed {
  code: string;
  name: string;
  sortOrder: number;
  isSystem: boolean;
  colorToken: string;
}

export const DEFAULT_PIPELINE_STATUSES: readonly PipelineStatusSeed[] = [
  {
    code: 'IN_BASE',
    name: 'In base',
    sortOrder: 10,
    // Защищён от удаления: сюда попадает объект по «Согласен».
    isSystem: true,
    colorToken: 'brand-primary',
  },
  {
    code: 'IN_PROGRESS',
    name: 'In progress',
    sortOrder: 20,
    // Защищён от удаления: сюда объект переходит по факту заполнения формы.
    isSystem: true,
    colorToken: 'success',
  },
  {
    code: 'OFFERED',
    name: 'Offered to client',
    sortOrder: 30,
    isSystem: false,
    colorToken: 'text-secondary',
  },
  { code: 'CLOSED', name: 'Closed', sortOrder: 40, isSystem: false, colorToken: 'success' },
  {
    code: 'ARCHIVED',
    name: 'Archived',
    sortOrder: 50,
    isSystem: false,
    colorToken: 'text-secondary',
  },
];

/** Коды, на которых завязаны переходы. Удалять их нельзя. */
export const SYSTEM_STATUS_CODES: readonly string[] = DEFAULT_PIPELINE_STATUSES.filter(
  (status) => status.isSystem,
).map((status) => status.code);
