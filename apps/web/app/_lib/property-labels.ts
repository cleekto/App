import { BUILDING_STATUSES, CONDITIONS, PROJECT_TYPES } from '@kleekto/contracts';
import type { Locale, MessageKey } from '@kleekto/i18n';
import { translate } from '@kleekto/i18n';

import type { EditPropertyLabels } from '../(app)/properties/edit-property';
import type { FactDictionaries } from '../(app)/properties/fact-fields';
import type { FactLabels } from '../(app)/properties/fact-fields';

/**
 * Подписи полей объекта — в одном месте на все экраны.
 *
 * Форма заведения, форма правки в списке, форма правки на доске и карточка
 * объекта показывают ОДНИ И ТЕ ЖЕ поля. Пока каждый экран выписывал подписи
 * заново, добавленное поле приходилось вписывать в четыре места, и
 * четвёртое забывалось.
 *
 * Собираются на сервере: `translate` уходит в словарь, а не в браузер.
 */
export function factLabels(locale: Locale): FactLabels {
  const t = (key: MessageKey): string => translate(locale, key);

  return {
    transactionType: t('property.transactionLabel'),
    propertyType: t('property.typeLabel'),
    rooms: t('property.roomsLabel'),
    bedrooms: t('property.bedrooms'),
    area: t('property.areaLabel'),
    floor: t('property.floorLabel'),
    totalFloors: t('property.totalFloorsLabel'),
    bathrooms: t('property.bathrooms'),
    balconies: t('property.balconies'),
    balconyArea: t('property.balconyArea'),
    houseArea: t('property.houseArea'),
    yardArea: t('property.yardArea'),
    condition: t('property.condition'),
    buildingStatus: t('property.buildingStatus'),
    projectType: t('property.projectType'),
    cadastralCode: t('property.cadastralCode'),
    sellerKind: t('property.sellerKind'),
    sellerOwner: t('property.sellerOwner'),
    sellerAgency: t('property.sellerAgency'),
    notSpecified: t('property.notSpecified'),
    district: t('property.districtLabel'),
    address: t('property.addressLabel'),
    price: t('property.priceLabel'),
    currency: t('property.currencyLabel'),
    exclusive: t('property.exclusive'),
    exclusiveHint: t('property.exclusiveHint'),
  };
}

/** Подписи окна правки: те же поля плюс кнопки. */
export function editLabels(locale: Locale): EditPropertyLabels {
  const t = (key: MessageKey): string => translate(locale, key);

  return {
    ...factLabels(locale),
    trigger: t('property.edit'),
    title: t('property.editTitle'),
    submit: t('common.save'),
    cancel: t('common.cancel'),
    saving: t('common.loading'),
    loading: t('common.loading'),
    failed: t('property.editFailed'),
  };
}

/**
 * Типы недвижимости для выпадающего списка.
 *
 * Порядок — по частоте на рынке Тбилиси, а не по алфавиту: квартира стоит
 * первой, потому что в девяти случаях из десяти выбирают её, и лишний взгляд
 * на список — это лишний взгляд, повторённый сто раз за день.
 */
export function propertyTypeOptions(locale: Locale): Array<{ value: string; label: string }> {
  return [
    { value: 'APARTMENT', label: translate(locale, 'property.type.APARTMENT') },
    { value: 'HOUSE', label: translate(locale, 'property.type.HOUSE') },
    { value: 'COUNTRY_HOUSE', label: translate(locale, 'property.type.COUNTRY_HOUSE') },
    { value: 'LAND', label: translate(locale, 'property.type.LAND') },
    { value: 'COMMERCIAL', label: translate(locale, 'property.type.COMMERCIAL') },
    { value: 'HOTEL', label: translate(locale, 'property.type.HOTEL') },
  ];
}

/**
 * Все справочники формы одним объектом.
 *
 * Собираются в одном месте: экранов, показывающих эти поля, четыре —
 * заведение, правка в списке, правка на доске и карточка объекта, — и пока
 * каждый собирал списки сам, добавленная категория появлялась в трёх местах
 * из четырёх.
 */
export function factDictionaries(locale: Locale): FactDictionaries {
  return {
    types: propertyTypeOptions(locale),
    transactions: transactionOptions(locale),
    conditions: conditionOptions(locale),
    buildingStatuses: buildingStatusOptions(locale),
    projectTypes: projectTypeOptions(locale),
  };
}

/**
 * Справочники раскрывающихся полей.
 *
 * Коды берутся из `@kleekto/contracts` — одного списка на весь продукт, —
 * а подписи из словаря. Порядок в коде и есть порядок на экране: он выбран
 * владельцем и алфавиту не подчиняется.
 */
export function conditionOptions(locale: Locale): Array<{ value: string; label: string }> {
  return CONDITIONS.map((code) => ({
    value: code,
    label: translate(locale, `property.conditionOptions.${code}` as MessageKey),
  }));
}

export function buildingStatusOptions(locale: Locale): Array<{ value: string; label: string }> {
  return BUILDING_STATUSES.map((code) => ({
    value: code,
    label: translate(locale, `property.buildingStatusOptions.${code}` as MessageKey),
  }));
}

export function projectTypeOptions(locale: Locale): Array<{ value: string; label: string }> {
  return PROJECT_TYPES.map((code) => ({
    value: code,
    label: translate(locale, `property.projectTypeOptions.${code}` as MessageKey),
  }));
}

/** Виды сделки. Четыре: рынок Грузии знает залог и посуточную аренду. */
export function transactionOptions(locale: Locale): Array<{ value: string; label: string }> {
  return [
    { value: 'SALE', label: translate(locale, 'property.transaction.SALE') },
    { value: 'RENT', label: translate(locale, 'property.transaction.RENT') },
    { value: 'PLEDGE', label: translate(locale, 'property.transaction.PLEDGE') },
    { value: 'DAILY_RENT', label: translate(locale, 'property.transaction.DAILY_RENT') },
  ];
}
