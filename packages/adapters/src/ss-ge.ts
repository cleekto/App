import type { ExtractionResult, ListingImportPayload } from '@kleekto/contracts';

import {
  detectCurrency,
  externalIdFromUrl,
  firstDecimal,
  firstInteger,
  isGeorgianMobile,
  metaContent,
  ownImages,
  parseFloorPair,
  telLinks,
} from './shared';
import { detectPropertyType, detectTransactionType } from './vocabulary';
import type { ListingSourceAdapter } from './types';

/**
 * Адаптер чтения ss.ge.
 *
 * Разбор основан на фикстурах от 2026-08-31, семь страниц: квартира,
 * коммерция, земля, посуточная аренда, аренда коммерции и офиса.
 * Подробности и ограничения — `docs/analysis/source-ss-ge.md`.
 *
 * ГЛАВНОЕ О РАЗМЕТКЕ: сайт собран на Next.js со styled-components, и классы
 * вида `sc-6186d2c3-1 bjeTyH` меняются при каждой сборке площадки. Селекторов
 * по ним здесь нет ни одного — иначе адаптер ломался бы на каждом их деплое.
 *
 * Опоры выбраны по устойчивости, в порядке убывания:
 *   1. мета-теги `og:*` — часть SEO, менять их площадке невыгодно;
 *   2. ссылки `tel:` — часть смысла страницы, а не оформления;
 *   3. семантические классы иконок `icon-crop_free`, `icon-stairs` — они
 *      описывают смысл поля, а не его вид.
 */

/** Номер собственной линии поддержки ss.ge. Встречается на каждой странице. */
const SUPPORT_PHONE = '0322121661';

export class SsGeAdapter implements ListingSourceAdapter {
  readonly sourceId = 'SS_GE' as const;
  readonly parserVersion = 'ss.ge@1.0.0';

  canHandle(url: string): boolean {
    try {
      return /(^|\.)ss\.ge$/u.test(new URL(url).hostname);
    } catch {
      return false;
    }
  }

  /**
   * ПРАВИЛО 11. Признак — наличие ссылки `tel:` с мобильным номером.
   *
   * Именно ссылки, а не кнопки «показать номер»: на разобранных страницах
   * текст кнопки присутствует в разметке и после раскрытия — он лежит
   * в словаре переводов, встроенном в страницу. Считать его признаком
   * означало бы блокировать импорт там, где номер уже виден.
   */
  isPhoneRevealed(document: Document): boolean {
    return ownerPhones(document).length > 0;
  }

  extract(document: Document, url: string): ExtractionResult {
    const missing: string[] = [];
    const track = <T>(field: string, value: T | null): T | null => {
      if (value === null) missing.push(field);
      return value;
    };

    const canonical = metaContent(document, 'og:url') ?? url;
    const title = stripSuffix(metaContent(document, 'og:title'));

    const price = track('price', priceFrom(title));
    const currency = track('currency', detectCurrency(title));

    const area = track('area', firstDecimal(iconValue(document, 'icon-crop_free')));
    const rooms = track('rooms', firstInteger(iconValue(document, 'icon-meeting_room')));
    const bedrooms = track('bedrooms', firstInteger(iconValue(document, 'icon-bed')));

    const floors = parseFloorPair(iconValue(document, 'icon-stairs'));
    if (floors.floor === null) missing.push('floor');
    if (floors.totalFloors === null) missing.push('totalFloors');

    const photos = photoUrls(document, canonical);
    if (photos.length === 0) missing.push('photos');

    const phones = ownerPhones(document);
    if (phones.length === 0) missing.push('ownerPhone');

    // Адрес и район на разобранных страницах в отдельных полях не найдены.
    // Выдумывать их разбором заголовка нельзя: в грузинском название района
    // стоит в падеже («ბაგებში» — «в Багеби»), и обратное преобразование
    // было бы догадкой. Оба поля объявлены отсутствующими честно.
    missing.push('address', 'district');

    const payload: ListingImportPayload = {
      source: this.sourceId,
      sourceUrl: canonical,
      externalId: track('externalId', externalIdFromUrl(canonical)),
      title: track('title', title),
      propertyType: track('propertyType', detectPropertyType(title)),
      transactionType: track('transactionType', detectTransactionType(title)),
      price,
      currency,
      area,
      rooms,
      bedrooms,
      floor: floors.floor,
      totalFloors: floors.totalFloors,
      district: null,
      address: null,
      description: track('description', metaContent(document, 'description')),
      photos,
      owner: { name: null, phones },
    };

    return { payload, missingFields: [...new Set(missing)], parserVersion: this.parserVersion };
  }
}

// ── Разбор разметки ss.ge ────────────────────────────────────────────────────

/**
 * Значение параметра по семантическому классу иконки.
 *
 * ПРИНИМАЕТСЯ ТОЛЬКО БЛОК С ПОДПИСЬЮ. На странице объявления есть блок
 * похожих предложений, и в его карточках те же иконки стоят без подписи.
 * Без этой проверки адаптер брал бы этаж чужой квартиры: на фикстуре
 * коммерческого помещения, где этажа нет вовсе, первое совпадение
 * `icon-stairs` по документу давало «6/10» из соседней карточки.
 */
function iconValue(document: Document, iconClass: string): string | null {
  for (const icon of document.querySelectorAll(`.${iconClass}`)) {
    const container = icon.parentElement;
    if (container === null) continue;

    const label = container.querySelector('p');
    if (label === null) continue;

    const value = label.nextElementSibling?.textContent?.trim();
    if (value !== undefined && value !== '') return value;
  }
  return null;
}

/** «იყიდება ... , 179000 $ - 31346373 | ss.ge» → 179000. */
function priceFrom(title: string | null): number | null {
  if (title === null) return null;

  const match = /([\d][\d\s ,]*)\s*(?:\$|€|₾|ლარი|USD|GEL|EUR)/iu.exec(title);
  return match === null ? null : firstInteger(match[1] as string);
}

function stripSuffix(title: string | null): string | null {
  if (title === null) return null;
  const cleaned = title.replace(/\s*\|\s*ss\.ge\s*$/iu, '').trim();
  return cleaned === '' ? null : cleaned;
}

/**
 * Телефоны собственника.
 *
 * Из ссылок `tel:` исключается линия поддержки площадки и всё, что не похоже
 * на грузинский мобильный. Без этого телефон ss.ge попал бы в базу как телефон
 * собственника — и отравил бы дедупликацию всей команды.
 */
function ownerPhones(document: Document): string[] {
  return telLinks(document)
    .filter((phone) => phone.replace(/\D/gu, '') !== SUPPORT_PHONE)
    .filter(isGeorgianMobile);
}

/**
 * Фотографии.
 *
 * `og:image` — главный снимок, он же обложка. Остальное берётся только из
 * своей галереи: отбор по CDN без проверки владельца давал 19 миниатюр
 * из карточек чужих объявлений (`shared.ownImages`).
 *
 * НА ФИКСТУРАХ ГАЛЕРЕЯ НЕПРОВЕРЯЕМА. Браузер при сохранении страницы
 * переписывает пути своих картинок на локальные, поэтому на сохранённом
 * файле остаётся ровно один снимок — `og:image`. Это ограничение фикстур,
 * а не кода; разбор галереи проверяется на живой странице в фазе 6.
 */
function photoUrls(document: Document, base: string): string[] {
  const primary = metaContent(document, 'og:image');
  const gallery = ownImages(document, base, /static\.ss\.ge/u);

  return [...new Set([primary, ...gallery].filter((src): src is string => src !== null))];
}
