import type { Locale, MessageKey } from '@kleekto/i18n';
import { translate } from '@kleekto/i18n';

import type { EditPropertyLabels } from '../(app)/properties/edit-property';
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

/** Типы недвижимости для выпадающего списка. */
export function propertyTypeOptions(locale: Locale): Array<{ value: string; label: string }> {
  return [
    { value: 'APARTMENT', label: translate(locale, 'property.type.APARTMENT') },
    { value: 'HOUSE', label: translate(locale, 'property.type.HOUSE') },
    { value: 'LAND', label: translate(locale, 'property.type.LAND') },
    { value: 'COMMERCIAL', label: translate(locale, 'property.type.COMMERCIAL') },
  ];
}

/** Виды сделки. Их два, и третьего не предвидится. */
export function transactionOptions(locale: Locale): Array<{ value: string; label: string }> {
  return [
    { value: 'SALE', label: translate(locale, 'property.transaction.SALE') },
    { value: 'RENT', label: translate(locale, 'property.transaction.RENT') },
  ];
}
