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
  USER_LOGGED_IN: 'USER_LOGGED_IN',
  USER_LOGGED_OUT: 'USER_LOGGED_OUT',
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

  // Публикация
  PUBLICATION_DRAFTED: 'PUBLICATION_DRAFTED',
  /// Форма заполнена. Отправил ли её агент — неизвестно (инвариант 13).
  PUBLICATION_FILLED: 'PUBLICATION_FILLED',
  /// Агент подтвердил размещение. Единственный путь в статус published.
  LISTING_PUBLISHED: 'LISTING_PUBLISHED',
  /// Своё же объявление вернулось обратно и привязано к исходному объекту.
  SELF_PUBLICATION_LINKED: 'SELF_PUBLICATION_LINKED',
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
} as const;

export type ActivityEntity = (typeof ENTITY)[keyof typeof ENTITY];
