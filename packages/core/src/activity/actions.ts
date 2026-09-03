/**
 * Действия, попадающие в `ActivityLog` (инвариант 7).
 *
 * Константы, а не enum в базе: набор растёт с каждой фазой, и enum потребовал
 * бы миграции ради каждой новой записи. Опечатку ловит тип, а полноту
 * покрытия — тест.
 */
export const ACTIVITY = {
  // Компания и доступ
  COMPANY_REGISTERED: 'COMPANY_REGISTERED',
  USER_CREATED: 'USER_CREATED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  /// Изменена карточка сотрудника: имя, роль, команда или доступ.
  USER_UPDATED: 'USER_UPDATED',
  USER_LOGGED_IN: 'USER_LOGGED_IN',
  USER_LOGGED_OUT: 'USER_LOGGED_OUT',
  /// Человек сменил язык интерфейса. Пишется потому, что сессия при этом
  /// перевыпускается: без записи выпуск токена выглядел бы беспричинным.
  USER_LOCALE_CHANGED: 'USER_LOCALE_CHANGED',
  /// Пароль сменён. Ни старого, ни нового значения в записи нет — только
  /// сам факт (правило 10).
  USER_PASSWORD_CHANGED: 'USER_PASSWORD_CHANGED',
  /// Повторное использование отозванного refresh-токена — признак кражи.
  REFRESH_REUSE_DETECTED: 'REFRESH_REUSE_DETECTED',
  TEAM_CREATED: 'TEAM_CREATED',
  ASSIGNED_TO_TEAM: 'ASSIGNED_TO_TEAM',

  // Импорт и согласие
  /// Агент получил согласие собственника — единственный путь появления
  /// объекта в базе (правило R14).
  OWNER_AGREED: 'OWNER_AGREED',
  /// Объявление с другой площадки привязано к существующему объекту.
  LISTING_LINKED: 'LISTING_LINKED',
  /// Повторный импорт того же объявления: объект не создан, цена обновлена.
  LISTING_RESEEN: 'LISTING_RESEEN',
  /// Агент упёрся в предупреждение о дубле. Объект не создан.
  ///
  /// Пишется ради метрики «доля дублей» (фаза 8). Без этой записи агентство
  /// никогда не узнает, как часто агенты натыкаются друг на друга, — а это
  /// ровно тот сигнал, который говорит, работает ли дедупликация и не пора
  /// ли разводить команды по районам.
  IMPORT_DUPLICATE_WARNED: 'IMPORT_DUPLICATE_WARNED',

  // Публикация
  PUBLICATION_DRAFTED: 'PUBLICATION_DRAFTED',
  /// Форма заполнена. Отправил ли её агент — неизвестно (инвариант 13).
  PUBLICATION_FILLED: 'PUBLICATION_FILLED',
  /// Агент подтвердил размещение. Единственный путь в статус published.
  LISTING_PUBLISHED: 'LISTING_PUBLISHED',
  /// Своё же объявление вернулось обратно и привязано к исходному объекту.
  SELF_PUBLICATION_LINKED: 'SELF_PUBLICATION_LINKED',
  // Миграция базы агентства
  MIGRATION_APPLIED: 'MIGRATION_APPLIED',
  MIGRATION_ROLLED_BACK: 'MIGRATION_ROLLED_BACK',

  // Работа с объектом в CRM
  /// Смена статуса воронки. Пишется всегда: на ней строится вся аналитика
  /// движения по воронке (инвариант 7).
  PROPERTY_STATUS_CHANGED: 'PROPERTY_STATUS_CHANGED',
  PROPERTY_ASSIGNED: 'PROPERTY_ASSIGNED',
  PROPERTY_UPDATED: 'PROPERTY_UPDATED',
  PROPERTY_CREATED_MANUALLY: 'PROPERTY_CREATED_MANUALLY',

  TASK_CREATED: 'TASK_CREATED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  TASK_CANCELLED: 'TASK_CANCELLED',
  COMMENT_ADDED: 'COMMENT_ADDED',

  /// Изменения самой воронки: стадии заведены, переименованы, удалены
  /// или переставлены. Пишется потому, что переименованная стадия меняет
  /// смысл всей прошлой аналитики, а удалённая — переносит на себе объекты.
  PIPELINE_STATUS_CREATED: 'PIPELINE_STATUS_CREATED',
  PIPELINE_STATUS_UPDATED: 'PIPELINE_STATUS_UPDATED',
  PIPELINE_STATUS_DELETED: 'PIPELINE_STATUS_DELETED',
  PIPELINE_STATUS_REORDERED: 'PIPELINE_STATUS_REORDERED',

  PUBLISH_PROFILE_CREATED: 'PUBLISH_PROFILE_CREATED',
  PUBLISH_PROFILE_UPDATED: 'PUBLISH_PROFILE_UPDATED',
  PUBLISH_PROFILE_DELETED: 'PUBLISH_PROFILE_DELETED',
} as const;

export type ActivityAction = (typeof ACTIVITY)[keyof typeof ACTIVITY];

/** Тип сущности, к которой относится запись журнала. */
export const ENTITY = {
  COMPANY: 'Company',
  USER: 'User',
  TEAM: 'Team',
  PROPERTY: 'Property',
  SOURCE_LISTING: 'SourceListing',
  PUBLISH_PROFILE: 'PublishProfile',
  PUBLICATION: 'Publication',
  MIGRATION_BATCH: 'MigrationBatch',
  TASK: 'Task',
  COMMENT: 'Comment',
  PIPELINE_STATUS: 'PipelineStatus',
} as const;

export type ActivityEntity = (typeof ENTITY)[keyof typeof ENTITY];
