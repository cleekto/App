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
 * НАЗВАНИЯ ЗДЕСЬ СРАЗУ НА ТРЁХ ЯЗЫКАХ. Раньше имя было одно, английское,
 * а перевод подставлялся на экране по коду — и держался ровно до первого
 * переименования: переименованная стадия показывалась одним словом всем.
 * Теперь имя каждого языка живёт в данных с первого дня жизни компании
 * (решение владельца 2026-09-03, ADR-0008: три языка равноправны).
 *
 * `name` — запасное: оно показывается там, где у языка своего имени нет.
 * У этих пяти оно есть у всех троих, и запасное не понадобится никогда;
 * поле заполнено ради единообразия со стадиями, которые заводит агентство.
 *
 * Цвета — из палитры `STATUS_COLORS`, той же, что предлагается при правке
 * стадии. Иначе у только что зарегистрированной компании ни один кружок
 * в выборе цвета не был бы отмечен как текущий.
 */
export interface PipelineStatusSeed {
  code: string;
  name: string;
  nameKa: string;
  nameEn: string;
  nameRu: string;
  sortOrder: number;
  isSystem: boolean;
  colorToken: string;
}

export const DEFAULT_PIPELINE_STATUSES: readonly PipelineStatusSeed[] = [
  {
    code: 'IN_BASE',
    name: 'In base',
    nameKa: 'ბაზაში',
    nameEn: 'In base',
    nameRu: 'В базе',
    sortOrder: 10,
    // Защищён от удаления: сюда попадает объект по «Согласен».
    isSystem: true,
    colorToken: 'brand',
  },
  {
    code: 'IN_PROGRESS',
    name: 'In progress',
    nameKa: 'მუშავდება',
    nameEn: 'In progress',
    nameRu: 'Принят в работу',
    sortOrder: 20,
    // Защищён от удаления: сюда объект переходит по факту заполнения формы.
    isSystem: true,
    colorToken: 'success',
  },
  {
    code: 'OFFERED',
    name: 'Offered to client',
    nameKa: 'შეთავაზებულია კლიენტს',
    nameEn: 'Offered to client',
    nameRu: 'Предложен клиенту',
    sortOrder: 30,
    isSystem: false,
    colorToken: 'neutral',
  },
  {
    code: 'CLOSED',
    name: 'Closed',
    nameKa: 'დახურული',
    nameEn: 'Closed',
    nameRu: 'Закрыт',
    sortOrder: 40,
    isSystem: false,
    colorToken: 'success',
  },
  {
    code: 'ARCHIVED',
    name: 'Archived',
    nameKa: 'არქივი',
    nameEn: 'Archived',
    nameRu: 'Архив',
    sortOrder: 50,
    isSystem: false,
    colorToken: 'neutral',
  },
];

/** Коды, на которых завязаны переходы. Удалять их нельзя. */
export const SYSTEM_STATUS_CODES: readonly string[] = DEFAULT_PIPELINE_STATUSES.filter(
  (status) => status.isSystem,
).map((status) => status.code);
