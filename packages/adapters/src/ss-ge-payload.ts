import type { ListingImportPayload } from '@kleekto/contracts';

import { at, flag, int, isRecord, nextData, num, text } from './payload';
import { detectPropertyType, detectTransactionType } from './vocabulary';

/**
 * Разбор объявления ss.ge из данных страницы.
 *
 * Отдельным модулем от `ss-ge.ts`: там разбор разметки, здесь разбор данных,
 * и смешивать их в одном файле значило бы получить полотно, в котором
 * не видно, откуда взялось конкретное поле.
 *
 * ТЕЛЕФОНА ЗДЕСЬ НЕТ И НЕ БУДЕТ. Он в этих данных лежит целиком, без всякого
 * «показать номер», — я это проверил на живых страницах. Но правило 11 писано
 * не про техническую доступность, а про то, что номер собственника берётся
 * тогда, когда агент решил его взять. Поэтому телефон читается только
 * из раскрытой разметки, и решение изменить это принимает владелец,
 * а не адаптер.
 */

/** Всё, что удалось прочитать. `null` в поле — не прочиталось. */
export type PayloadFacts = Partial<Omit<ListingImportPayload, 'source' | 'owner'>> & {
  ownerName?: string | null;
};

export function ssGePayloadFacts(document: Document): PayloadFacts | null {
  const root = nextData(document);
  if (root === null) return null;

  const app = at(root, ['props', 'pageProps', 'applicationData']);
  if (!isRecord(app)) return null;

  const address = isRecord(app['address']) ? app['address'] : {};

  return {
    externalId: text(app['applicationId']),
    title: text(app['title']),

    // Тип и сделка берутся из отдельных полей, а не из заголовка: в данных
    // они названы прямо, и падежи грузинского заголовка тут ни при чём.
    propertyType: detectPropertyType(text(app['realEstateType'])),
    transactionType: detectTransactionType(text(app['realEstateDealType'])),

    area: num(app['totalArea']),
    rooms: int(app['rooms']),
    bedrooms: int(app['bedrooms']),
    floor: int(app['floor']),
    totalFloors: int(app['floors']),

    district: text(address['subdistrictTitle']) ?? text(address['districtTitle']),
    address: streetLine(address),
    description: descriptionText(app['description']),
    photos: photos(app['appImages']),

    bathrooms: text(app['toilet']),
    balconies: int(app['balcony_Loggia']),
    // Площади балкона ss.ge отдельно не отдаёт — в отличие от myhome.
    balconyArea: null,
    houseArea: num(app['areaOfHouse']),
    yardArea: num(app['areaOfYard']),
    condition: text(app['state']),
    buildingStatus: text(app['realEstateStatus']),
    projectType: text(app['project']),
    cadastralCode: text(app['cadastralCode']),
    sellerKind: sellerKind(app),

    ownerName: text(app['contactPerson']),
  };
}

/**
 * Цена и валюта из данных.
 *
 * Отдаётся сразу в двух валютах — лари и доллары, — и какая из них
 * объявлена, по самим числам не понять: вторая пересчитана. Поэтому валюту
 * определяет заголовок (там стоит знак, который видит человек), а данные
 * дают точную сумму под неё.
 */
export function ssGePayloadPrice(
  document: Document,
  currency: string | null,
): { price: number | null; currency: string | null } {
  const root = nextData(document);
  const price = at(root, ['props', 'pageProps', 'applicationData', 'price']);
  if (!isRecord(price)) return { price: null, currency };

  if (currency === 'GEL') return { price: num(price['priceGeo']), currency };
  if (currency === 'USD') return { price: num(price['priceUsd']), currency };

  // Валюта из заголовка не прочиталась: берётся доллар, если он есть, —
  // в Тбилиси цену недвижимости называют в нём.
  const usd = num(price['priceUsd']);
  if (usd !== null) return { price: usd, currency: 'USD' };

  const gel = num(price['priceGeo']);
  return gel === null ? { price: null, currency } : { price: gel, currency: 'GEL' };
}

/**
 * Фотографии — ПОЛНОГО РАЗМЕРА и все.
 *
 * У каждого снимка два адреса: `fileName` и `fileNameThumb`. Разбор разметки
 * брал обложку из `og:image` плюс миниатюры из галереи, потому что в разметке
 * в полном размере загружено только открытое фото. Отсюда и была жалоба:
 * одно фото крупно, остальные мелкие.
 *
 * Порядок сохраняется авторский (`orderNo`), главный снимок выносится вперёд:
 * первым в карточке должен стоять тот, который выбрал сам продавец.
 */
function photos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const items = value
    .filter(isRecord)
    .map((image) => ({
      url: text(image['fileName']),
      order: int(image['orderNo']) ?? 0,
      isMain: flag(image['isMain']) ?? false,
    }))
    .filter(
      (image): image is { url: string; order: number; isMain: boolean } => image.url !== null,
    );

  items.sort((a, b) => Number(b.isMain) - Number(a.isMain) || a.order - b.order);

  return [...new Set(items.map((image) => image.url))];
}

/**
 * Описание.
 *
 * ss.ge хранит его отдельно на трёх языках. В объекте объявления поле одно,
 * поэтому берётся общий текст: выбирать язык здесь было бы решением
 * за агентство, а показывать все три сразу — мусором в карточке.
 */
function descriptionText(value: unknown): string | null {
  if (!isRecord(value)) return text(value);
  return text(value['text']) ?? text(value['allLanguageTogather']) ?? text(value['ka']);
}

function streetLine(address: Record<string, unknown>): string | null {
  const street = text(address['streetTitle']);
  if (street === null) return null;

  const houseNumber = text(address['streetNumber']);
  return houseNumber === null ? street : `${street} ${houseNumber}`;
}

/**
 * Собственник или посредник.
 *
 * `Individual` — частное лицо. Всё прочее (агентство, застройщик) — посредник:
 * различать их между собой агенту незачем, а вот знать до звонка, что говорить
 * придётся не с собственником, — важно.
 */
function sellerKind(app: Record<string, unknown>): 'owner' | 'agency' | null {
  const entity = text(app['userEntityType']);
  if (entity === null) return null;

  return entity === 'Individual' ? 'owner' : 'agency';
}
