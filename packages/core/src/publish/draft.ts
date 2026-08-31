import type { PropertyType, Source, TransactionType } from '@cleekto/db';

/**
 * Черновик публикации — БЕЛЫЙ СПИСОК ПОЛЕЙ (§6А.4, правило 13).
 *
 * БЛОКА `owner` В ЭТОМ ТИПЕ НЕТ И НЕ ПОЯВИТСЯ. Не «опционально», не «пустой» —
 * его нет в типе. Чтобы контакт собственника попал на площадку, придётся
 * дописать поле, а не забыть проверку. Разница принципиальная: забыть проверку
 * можно случайно, дописать поле — только намеренно.
 *
 * Черновик собирается НА СЕРВЕРЕ. Расширение не получает данных, которые
 * могло бы вписать в форму, — это и есть способ гарантировать правило 13,
 * а не полагаться на дисциплину клиента.
 */
export interface ListingPublishDraft {
  propertyId: string;
  targetSource: Source;

  propertyType: PropertyType | null;
  transactionType: TransactionType | null;

  price: number | null;
  currency: string | null;

  area: number | null;
  rooms: number | null;
  floor: number | null;
  totalFloors: number | null;

  district: string | null;
  address: string | null;

  /** Очищено от телефонов и имени собственника (I7a). */
  publicDescription: string | null;

  /**
   * Контакт ПУБЛИКАТОРА — лицо агентства в объявлении. Никогда не OwnerContact.
   */
  publisher: {
    displayName: string;
    phone: string;
  };
}

/**
 * Поля объекта, попадающие в черновик. Явный список, а не «всё кроме» —
 * при добавлении поля в `Property` оно НЕ утечёт на площадку само собой.
 */
export const DRAFT_PROPERTY_FIELDS = [
  'propertyType',
  'transactionType',
  'price',
  'currency',
  'area',
  'rooms',
  'floor',
  'totalFloors',
  'district',
  'address',
  'publicDescription',
] as const;

/**
 * Поля, которые заполнить автоматически нельзя, и агент узнаёт об этом
 * из отчёта, а не из пустой формы.
 *
 * Фотографии здесь потому, что в MVP хранятся только URL (Q11), а форма
 * принимает файлы (P3, C-18). «Один клик» на практике означает «один клик
 * плюс перетащить фотографии» — это надо говорить вслух, а не обнаруживать.
 */
export const MANUAL_ONLY_FIELDS = ['photos', 'mapLocation'] as const;
