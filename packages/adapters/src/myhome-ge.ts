import type { ExtractionResult, ListingImportPayload } from '@kleekto/contracts';

import {
  detectCurrency,
  externalIdFromUrl,
  firstDecimal,
  isGeorgianMobile,
  metaContent,
  ownImages,
  parseFloorPair,
  telLinks,
} from './shared';
import { detectPropertyType, detectTransactionType, roomsFromTitle } from './vocabulary';
import { myhomePayloadFacts, myhomePayloadPrice } from './myhome-ge-payload';
import type { ListingSourceAdapter } from './types';

/**
 * Адаптер чтения myhome.ge.
 *
 * Разбор основан на фикстурах от 2026-08-31, семь страниц: квартиры разной
 * комнатности, частные дома, коммерческое помещение, земельный участок.
 * Подробности и ограничения — `docs/analysis/source-myhome-ge.md`.
 *
 * ОТЛИЧИЕ ОТ ss.ge: здесь Tailwind, то есть классы вида `flex h-12 rounded-lg`.
 * Они описывают вид, а не смысл, и одинаковы у десятка разных элементов —
 * селектор по ним попадёт не туда даже без всякого редизайна. Поэтому опора
 * ещё сильнее смещена в мета-теги: заголовок `og:title` у этой площадки несёт
 * цену, площадь, комнатность и номер объявления сразу.
 */

/** Линия поддержки myhome.ge. Встречается на каждой странице. */
const SUPPORT_PHONE = '0322800015';

export class MyhomeAdapter implements ListingSourceAdapter {
  readonly sourceId = 'MYHOME_GE' as const;
  readonly parserVersion = 'myhome.ge@1.0.0';

  canHandle(url: string): boolean {
    try {
      return /(^|\.)myhome\.ge$/u.test(new URL(url).hostname);
    } catch {
      return false;
    }
  }

  /** ПРАВИЛО 11. Признак тот же, что у ss.ge, — см. комментарий там. */
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
    const description = metaContent(document, 'description');

    /*
     * ДАННЫЕ СТРАНИЦЫ ВПЕРЁД, РАЗМЕТКА — ЗАПАСНОЙ ПУТЬ. Та же причина, что
     * и у ss.ge: в разметке меньше полей, она рисуется позже расширения
     * и ломается от перевёрстки. Старый разбор остаётся вторым эшелоном.
     */
    const facts = myhomePayloadFacts(document);

    const fromTitle = detectCurrency(title);
    const priced =
      facts === null
        ? { price: priceFrom(title), currency: fromTitle }
        : myhomePayloadPrice(document, fromTitle);

    const domFloors = parseFloorPair(floorValue(document));
    const floor = track('floor', facts?.floor ?? domFloors.floor);
    const totalFloors = track('totalFloors', facts?.totalFloors ?? domFloors.totalFloors);

    // Фотографии из данных — все и в полном размере (`large`). Разметка
    // отдавала то, что загружено, а в полном размере загружено только
    // открытое фото.
    const payloadPhotos = facts?.photos ?? [];
    const photos = payloadPhotos.length > 0 ? payloadPhotos : photoUrls(document, canonical);
    if (photos.length === 0) missing.push('photos');

    // ПРАВИЛО 11: телефон только из раскрытой разметки. В данных он приходит
    // замаскированным, но полагаться на чужую маску нельзя — снимут, и правило
    // нарушится молча.
    const phones = ownerPhones(document);
    if (phones.length === 0) missing.push('ownerPhone');

    // Район в заголовке стоит в местном падеже («დიდ დიღომში» — «в Диди
    // Дигоми»), и обратное преобразование было бы догадкой. В данных он есть
    // прямо; без данных поле честно объявляется отсутствующим.
    const district = track('district', facts?.district ?? null);

    const payload: ListingImportPayload = {
      source: this.sourceId,
      sourceUrl: canonical,
      externalId: track('externalId', facts?.externalId ?? externalIdFromUrl(canonical)),
      title: track('title', facts?.title ?? title),
      propertyType: track('propertyType', detectPropertyType(title)),
      transactionType: track('transactionType', detectTransactionType(title)),
      price: track('price', priced.price ?? priceFrom(title)),
      currency: track('currency', priced.currency ?? fromTitle),
      area: track('area', facts?.area ?? areaFrom(title)),
      rooms: track('rooms', facts?.rooms ?? roomsFromTitle(title)),
      bedrooms: track('bedrooms', facts?.bedrooms ?? null),
      floor,
      totalFloors,
      district,
      address: track('address', facts?.address ?? addressFrom(description)),
      description: track('description', facts?.description ?? description),
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

// ── Разбор разметки myhome.ge ────────────────────────────────────────────────

/**
 * Этаж: подпись «სართული» и значение «8 / 12» рядом с ней.
 *
 * Опора на текст подписи, а не на классы: у Tailwind классы описывают вид
 * и повторяются по всей странице. Цена такой опоры честная — при смене языка
 * интерфейса подпись станет русской или английской, поэтому проверяются все три.
 */
const FLOOR_LABELS = ['სართული', 'этаж', 'floor'];

function floorValue(document: Document): string | null {
  for (const span of document.querySelectorAll('span')) {
    const text = span.textContent?.trim().toLowerCase() ?? '';
    if (!FLOOR_LABELS.includes(text)) continue;

    const value = span.nextElementSibling?.textContent?.trim();
    if (value !== undefined && /\d/u.test(value)) return value;
  }
  return null;
}

/** «... , 70000 $, 66 მ², 25704507» → 70000. */
function priceFrom(title: string | null): number | null {
  if (title === null) return null;

  const match = /([\d][\d\s ,]*)\s*(?:\$|€|₾|ლარი|USD|GEL|EUR)/iu.exec(title);
  if (match === null) return null;

  const value = Number.parseInt((match[1] as string).replace(/[\s ,]/gu, ''), 10);
  return Number.isFinite(value) ? value : null;
}

/** «... , 66 მ², ...» → 66. */
function areaFrom(title: string | null): number | null {
  if (title === null) return null;

  const match = /([\d][\d\s ]*(?:[.,]\d+)?)\s*(?:მ²|m²|кв\.?\s*м)/iu.exec(title);
  return match === null ? null : firstDecimal(match[1] as string);
}

/**
 * Адрес из мета-описания.
 *
 * Формат у всех разобранных страниц одинаков:
 *   «<что и где>, <адрес>, <площадь> მ². ნახე ...»
 * Берётся отрезок между последней запятой перед площадью и предыдущей.
 *
 * Это единственное место, где на myhome.ge нашёлся адрес. На ss.ge адреса
 * не нашлось нигде — разница между площадками зафиксирована в документах.
 */
function addressFrom(description: string | null): string | null {
  if (description === null) return null;

  const match = /,\s*([^,]+?)\s*,\s*[\d\s.,]+\s*(?:მ²|m²)/u.exec(description);
  if (match === null) return null;

  const address = (match[1] as string).trim();
  return address === '' ? null : address;
}

function stripSuffix(title: string | null): string | null {
  if (title === null) return null;
  const cleaned = title.replace(/\s*\|\s*Myhome\s*$/iu, '').trim();
  return cleaned === '' ? null : cleaned;
}

function ownerPhones(document: Document): string[] {
  return telLinks(document)
    .filter((phone) => phone.replace(/\D/gu, '') !== SUPPORT_PHONE)
    .filter(isGeorgianMobile);
}

/**
 * Фотографии.
 *
 * Только свои: отбор по одному лишь CDN давал чужие снимки. На фикстуре
 * участка (25880360) все 32 картинки принадлежали соседним участкам того
 * же Лиси — почти одинаковым объектам, худший случай для дедупликации
 * по фотографиям. Подробности правила — `shared.ownImages`.
 */
function photoUrls(document: Document, base: string): string[] {
  const primary = metaContent(document, 'og:image');
  const gallery = ownImages(document, base, /static-statements\.tnet\.ge/u);

  return [...new Set([primary, ...gallery].filter((src): src is string => src !== null))];
}
