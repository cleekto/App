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
import { ssGePayloadFacts, ssGePayloadPrice } from './ss-ge-payload';
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

    /*
     * ДАННЫЕ СТРАНИЦЫ ВПЕРЁД, РАЗМЕТКА — ЗАПАСНОЙ ПУТЬ.
     *
     * В `__NEXT_DATA__` объявление лежит целиком и точно; разбор разметки
     * даёт меньше и гоняется с отрисовкой. Но форма данных у площадки
     * меняется без предупреждения — фикстуры недельной давности сохранены
     * с другим маршрутом и объекта объявления не содержат вовсе, — поэтому
     * старый разбор остаётся вторым эшелоном, а не удаляется.
     */
    const facts = ssGePayloadFacts(document);

    const fromTitle = detectCurrency(title);
    const priced =
      facts === null
        ? { price: priceFrom(title), currency: fromTitle }
        : ssGePayloadPrice(document, fromTitle);

    const price = track('price', priced.price ?? priceFrom(title));
    const currency = track('currency', priced.currency ?? fromTitle);

    const area = track('area', facts?.area ?? firstDecimal(iconValue(document, 'icon-crop_free')));
    const rooms = track(
      'rooms',
      facts?.rooms ?? firstInteger(iconValue(document, 'icon-meeting_room')),
    );
    const bedrooms = track(
      'bedrooms',
      facts?.bedrooms ?? firstInteger(iconValue(document, 'icon-bed')),
    );

    const domFloors = parseFloorPair(iconValue(document, 'icon-stairs'));
    const floor = track('floor', facts?.floor ?? domFloors.floor);
    const totalFloors = track('totalFloors', facts?.totalFloors ?? domFloors.totalFloors);

    // Фотографии из данных — все и в полном размере. Разбор разметки давал
    // обложку плюс миниатюры: в галерее в полном размере загружено только
    // открытое фото.
    const payloadPhotos = facts?.photos ?? [];
    const photos = payloadPhotos.length > 0 ? payloadPhotos : photoUrls(document, canonical);
    if (photos.length === 0) missing.push('photos');

    // ПРАВИЛО 11: телефон только из раскрытой разметки. В данных страницы он
    // лежит целиком, но берётся он тогда, когда номер раскрыл агент.
    const phones = ownerPhones(document);
    if (phones.length === 0) missing.push('ownerPhone');

    // Адрес и район в разметке отдельными полями не найдены, а выдумывать их
    // разбором заголовка нельзя: в грузинском название района стоит в падеже
    // («ბაგებში» — «в Багеби»). В данных они есть прямо; если данных нет,
    // поля честно объявляются отсутствующими.
    const address = track('address', facts?.address ?? null);
    const district = track('district', facts?.district ?? null);

    const payload: ListingImportPayload = {
      source: this.sourceId,
      sourceUrl: canonical,
      externalId: track('externalId', facts?.externalId ?? externalIdFromUrl(canonical)),
      title: track('title', facts?.title ?? title),
      propertyType: track('propertyType', facts?.propertyType ?? detectPropertyType(title)),
      transactionType: track(
        'transactionType',
        facts?.transactionType ?? detectTransactionType(title),
      ),
      price,
      currency,
      area,
      rooms,
      bedrooms,
      floor,
      totalFloors,
      district,
      address,
      description: track('description', facts?.description ?? metaContent(document, 'description')),
      photos,

      bathrooms: track('bathrooms', facts?.bathrooms ?? null),
      balconies: track('balconies', facts?.balconies ?? null),
      balconyArea: track('balconyArea', facts?.balconyArea ?? null),
      houseArea: track('houseArea', facts?.houseArea ?? null),
      yardArea: track('yardArea', facts?.yardArea ?? null),
      condition: track('condition', facts?.condition ?? null),
      buildingStatus: track('buildingStatus', facts?.buildingStatus ?? null),
      projectType: track('projectType', facts?.projectType ?? null),
      cadastralCode: track('cadastralCode', facts?.cadastralCode ?? null),
      sellerKind: track('sellerKind', facts?.sellerKind ?? null),

      owner: { name: facts?.ownerName ?? null, phones },
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
