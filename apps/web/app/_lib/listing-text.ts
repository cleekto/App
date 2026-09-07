import { isKnownBuildingStatus, isKnownCondition, isKnownProjectType } from '@kleekto/contracts';
import { formatNumber, LOCALES, translate } from '@kleekto/i18n';
import type { Locale, MessageKey } from '@kleekto/i18n';

/**
 * Описание объекта для формы площадки — сразу на трёх языках.
 *
 * ЗАЧЕМ. Форма myhome требует описание ОТДЕЛЬНО на грузинском, английском
 * и русском — по три поля и на описание, и на адрес. Агент писал их руками
 * трижды, и это самая долгая часть размещения: пять-десять минут против
 * трёх-пяти на фотографии. При этом всё, что нужно, у нас уже есть:
 * характеристики объекта и словари значений, переведённые на все три языка
 * с первого дня (правило 18).
 *
 * ПОЧЕМУ СТРОКАМИ, А НЕ СВЯЗНЫМ ТЕКСТОМ. Связная фраза требует согласования:
 * по-русски «продаётся трёхкомнатная квартира», а словарь даёт «Квартира»
 * в именительном. Без морфологии вышло бы «Продаётся Квартира 3», и такая
 * строка в живом объявлении выглядит хуже, чем честный перечень. Грузинский
 * добавил бы к этому падежи, которых у нас тем более нет.
 *
 * Перечень — это ровно та часть, которую противно набирать трижды. Свою
 * фразу про «светлый двор» агент допишет сам, и она встанет первой.
 *
 * ПРИДУМАННЫХ ЗНАЧЕНИЙ ЗДЕСЬ НЕТ (правило 14). Поле, которого нет,
 * не появляется в тексте вовсе: «состояние не указано» в объявлении хуже,
 * чем отсутствие строки про состояние.
 */

/** Что описывается. Ровно то, что есть в карточке объекта. */
export interface ListingFacts {
  propertyType: string;
  transactionType: string;
  rooms: number | null;
  bedrooms: number | null;
  areaTotal: number | null;
  floor: number | null;
  totalFloors: number | null;
  district: string | null;
  addressRaw: string | null;
  bathrooms: string | null;
  balconies: number | null;
  balconyArea: number | null;
  houseArea: number | null;
  yardArea: number | null;
  condition: string | null;
  buildingStatus: string | null;
  projectType: string | null;
  /** Что агент написал сам. Идёт первым абзацем, если написал. */
  publicDescription: string | null;
}

/** Разделитель значения от подписи и значений между собой. */
const COLON = ': ';
const DOT = ' · ';
const SLASH = '/';
const SQUARE_METRES = 'm²';

/**
 * Значение словарного поля на нужном языке.
 *
 * Площадки отдают и то, чего в наших словарях нет: у ss.ge своё состояние
 * ремонта, у myhome своё. Незнакомое значение выводится КАК ЕСТЬ, а не
 * выбрасывается: агент увидит то, что стояло в объявлении, и поправит сам.
 * Выбросить было бы тише, но он не узнал бы, что потерял.
 */
function dictionaryValue(
  locale: Locale,
  value: string,
  known: (input: string) => boolean,
  group: string,
): string {
  return known(value) ? translate(locale, `property.${group}.${value}` as MessageKey) : value;
}

/** Текст описания на одном языке. */
export function listingText(locale: Locale, facts: ListingFacts): string {
  const t = (key: MessageKey): string => translate(locale, key);
  const lines: string[] = [];

  // Что это и что с ним делают — первой строкой, как в заголовке объявления.
  lines.push(
    [
      translate(locale, `property.type.${facts.propertyType}` as MessageKey),
      translate(locale, `property.transaction.${facts.transactionType}` as MessageKey),
    ].join(DOT),
  );

  // Размеры и этаж — то, по чему объект выбирают.
  const size: string[] = [];
  if (facts.rooms !== null) {
    size.push(`${formatNumber(locale, facts.rooms)} ${t('property.rooms')}`);
  }
  if (facts.areaTotal !== null) {
    size.push(`${formatNumber(locale, facts.areaTotal)} ${SQUARE_METRES}`);
  }
  if (facts.floor !== null && !(facts.floor === 0 && facts.totalFloors === null)) {
    size.push(
      facts.totalFloors === null
        ? String(facts.floor)
        : `${String(facts.floor)}${SLASH}${String(facts.totalFloors)}`,
    );
  }
  if (size.length > 0) lines.push(size.join(DOT));

  const place = [facts.addressRaw, facts.district].filter(
    (part): part is string => part !== null && part !== '',
  );
  if (place.length > 0) lines.push(`${t('property.districtLabel')}${COLON}${place.join(', ')}`);

  /*
   * Дальше — по одной строке на характеристику, и только на заполненную.
   * Порядок тот же, что в карточке объекта: агент читает одно и то же
   * дважды за день, и вторая раскладка заставила бы его перестраиваться.
   */
  const rows: Array<[MessageKey, string | null]> = [
    ['property.bedrooms', facts.bedrooms === null ? null : formatNumber(locale, facts.bedrooms)],
    ['property.bathrooms', facts.bathrooms],
    [
      'property.balconies',
      facts.balconies === null
        ? null
        : [
            formatNumber(locale, facts.balconies),
            facts.balconyArea === null
              ? null
              : `${formatNumber(locale, facts.balconyArea)} ${SQUARE_METRES}`,
          ]
            .filter((part): part is string => part !== null)
            .join(DOT),
    ],
    [
      'property.houseArea',
      facts.houseArea === null ? null : `${formatNumber(locale, facts.houseArea)} ${SQUARE_METRES}`,
    ],
    [
      'property.yardArea',
      facts.yardArea === null ? null : `${formatNumber(locale, facts.yardArea)} ${SQUARE_METRES}`,
    ],
    [
      'property.condition',
      facts.condition === null
        ? null
        : dictionaryValue(locale, facts.condition, isKnownCondition, 'conditionOptions'),
    ],
    [
      'property.buildingStatus',
      facts.buildingStatus === null
        ? null
        : dictionaryValue(
            locale,
            facts.buildingStatus,
            isKnownBuildingStatus,
            'buildingStatusOptions',
          ),
    ],
    [
      'property.projectType',
      facts.projectType === null
        ? null
        : dictionaryValue(locale, facts.projectType, isKnownProjectType, 'projectTypeOptions'),
    ],
  ];

  for (const [key, value] of rows) {
    if (value !== null && value !== '') lines.push(`${t(key)}${COLON}${value}`);
  }

  const own = facts.publicDescription?.trim() ?? '';

  // Своё описание — первым абзацем: перечень характеристик его дополняет,
  // а не наоборот.
  return own === '' ? lines.join('\n') : `${own}\n\n${lines.join('\n')}`;
}

/** Описание сразу на всех трёх языках — их и требует форма myhome. */
export function listingTexts(facts: ListingFacts): Array<{ locale: Locale; text: string }> {
  return LOCALES.map((locale) => ({ locale, text: listingText(locale, facts) }));
}
