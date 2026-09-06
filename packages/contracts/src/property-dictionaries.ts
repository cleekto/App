/**
 * Справочники раскрывающихся полей объявления.
 *
 * ОДИН СПИСОК НА ВСЕ МЕСТА: форма заведения, форма правки, фильтры, разбор
 * объявления. Пока каждый экран выписывал свой набор, они расходились —
 * и «белый каркас» из формы не совпадал с «თეთრი კარკასი» из импорта,
 * то есть два одинаковых объекта считались разными.
 *
 * ХРАНИТСЯ КОД, ПОКАЗЫВАЕТСЯ ПЕРЕВОД. Иначе поле пришлось бы хранить
 * на одном языке из трёх, а искать и сравнивать — по написанию.
 *
 * ПОЧЕМУ ЭТИ ТРИ ПОЛЯ ОСТАЛИСЬ СТРОКАМИ В БАЗЕ, а не стали перечислениями.
 * Их заполняет не только человек: с площадок приходит то, что там написано,
 * и список у ss.ge с myhome.ge свой. Перечисление отвергло бы незнакомое
 * значение, то есть потеряло бы данные, которые агент видел глазами
 * на странице объявления (правило 14: придуманных и «ближайших похожих»
 * значений не бывает, но и терять увиденное нельзя). Поэтому колонка
 * свободная, а список — в интерфейсе; пришедшее с площадки чужое значение
 * показывается как есть и при сохранении не затирается.
 */

/** Состояние ремонта. */
export const CONDITIONS = [
  'newly_renovated',
  'old_renovated',
  'ongoing_renovation',
  'needs_renovation',
  'white_frame',
  'black_frame',
  'green_frame',
  'white_plus',
] as const;

/** Статус дома. */
export const BUILDING_STATUSES = ['old_build', 'new_build', 'under_construction'] as const;

/**
 * Тип проекта.
 *
 * Список рынка Тбилиси: советские серии, городские типы застройки
 * и современные комплексы. «Нестандартный» стоит первым — это самое частое
 * значение и честный ответ, когда серия неизвестна.
 */
export const PROJECT_TYPES = [
  'non_standard',
  'tukhareli',
  'italian_yard',
  'leningrad',
  'lvov',
  'moscow',
  'kalakuri',
  'kavlashvili',
  'czech',
  'khrushchev',
  'dormitory',
  'duplex',
  'triplex',
  'm2_complex',
  'optima_m2',
  'metra_park',
] as const;

export type ConditionCode = (typeof CONDITIONS)[number];
export type BuildingStatusCode = (typeof BUILDING_STATUSES)[number];
export type ProjectTypeCode = (typeof PROJECT_TYPES)[number];

/** Известен ли код справочнику. Незнакомое пришло с площадки и не трогается. */
export function isKnownCondition(value: string): value is ConditionCode {
  return (CONDITIONS as readonly string[]).includes(value);
}

export function isKnownBuildingStatus(value: string): value is BuildingStatusCode {
  return (BUILDING_STATUSES as readonly string[]).includes(value);
}

export function isKnownProjectType(value: string): value is ProjectTypeCode {
  return (PROJECT_TYPES as readonly string[]).includes(value);
}
