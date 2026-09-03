import {
  formatDate,
  formatMoney,
  formatNumber,
  optionalMessage,
  translate,
  type Locale,
} from '@kleekto/i18n';
import type { MessageKey } from '@kleekto/i18n';

/**
 * Строки для показа.
 *
 * Собираются здесь, а не в разметке: в JSX литералов нет вовсе (правило 18,
 * линтер это проверяет), а строка «2 комн. · 85 м² · 7 этаж» — это склейка
 * переведённых кусков, а не текст.
 *
 * У объекта нет поля «заголовок», и это осознанно: `Property` описан
 * структурно, а заголовок хранился бы на одном языке из трёх.
 */

export interface PropertyFacts {
  propertyType: string;
  transactionType: string;
  rooms: number | null;
  areaTotal: number | null;
  floor: number | null;
  totalFloors: number | null;
  district: string | null;
  addressRaw: string | null;
  price: number | null;
  currency: string | null;
}

/** «Квартира · Продажа» — что это и что с ним делают. */
export function kindLine(locale: Locale, facts: PropertyFacts): string {
  return [
    translate(locale, `property.type.${facts.propertyType}` as MessageKey),
    translate(locale, `property.transaction.${facts.transactionType}` as MessageKey),
  ].join(' · ');
}

/** «2 комн. · 85 м² · 7/10» — то, по чему объект узнают с одного взгляда. */
export function factsLine(locale: Locale, facts: PropertyFacts): string {
  const parts: string[] = [];

  if (facts.rooms !== null) {
    parts.push(`${formatNumber(locale, facts.rooms)} ${translate(locale, 'property.rooms')}`);
  }
  if (facts.areaTotal !== null) {
    // «м²» — не текст интерфейса: обозначение единицы одинаково во всех трёх
    // языках, и переводить его было бы выдумкой.
    parts.push(`${formatNumber(locale, facts.areaTotal)} m²`);
  }
  if (facts.floor !== null) {
    const floors =
      facts.totalFloors === null ? String(facts.floor) : `${facts.floor}/${facts.totalFloors}`;
    parts.push(`${floors} ${translate(locale, 'property.floor')}`);
  }

  return parts.join(' · ');
}

export function placeLine(facts: PropertyFacts): string {
  return [facts.addressRaw, facts.district]
    .filter((part) => part !== null && part !== '')
    .join(', ');
}

/**
 * Цена.
 *
 * Валюта передаётся явно и из языка не выводится (Q13): агентство в Тбилиси
 * ведёт объекты в долларах, а интерфейс при этом может быть грузинским.
 */
export function priceLine(locale: Locale, facts: PropertyFacts): string {
  if (facts.price === null) return '—';
  return facts.currency === null
    ? formatNumber(locale, facts.price)
    : formatMoney(locale, facts.price, facts.currency);
}

export function dateLine(locale: Locale, iso: string): string {
  return formatDate(locale, new Date(iso));
}

/** «Сегодня 18:00» тут не нужен: срок задачи читается датой и временем. */
export function dueLine(locale: Locale, iso: string | null): string {
  if (iso === null) return '';
  const value = new Date(iso);
  const time = new Intl.DateTimeFormat(
    locale === 'ka' ? 'ka-GE' : locale === 'ru' ? 'ru-RU' : 'en-GB',
    {
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(value);

  return `${formatDate(locale, value)}, ${time}`;
}

/**
 * Название статуса воронки на языке человека.
 *
 * ПОЧЕМУ ПО КОДУ, А НЕ ПО ИМЕНИ. Имя лежит в базе и создаётся при регистрации
 * компании — по-английски, потому что при регистрации язык компании ещё
 * неизвестен. Переводить само имя нельзя: компания вправе переписать его
 * под себя, и тогда перевод затёр бы её текст (инвариант 4).
 *
 * Код же у пяти статусов, созданных сидом, известен заранее. Он и служит
 * ключом. Статус, заведённый компанией самостоятельно, перевода не имеет —
 * и показывается ровно так, как его назвали.
 *
 * Найдено ручным проходом: грузинский агент видел «In base» и «Offered to
 * client» посреди грузинского интерфейса — и это самые частые надписи в CRM.
 *
 * ПЕРЕИМЕНОВАННАЯ СТАДИЯ ПЕРЕВОДА НЕ ПОЛУЧАЕТ. Код у неё остаётся прежним —
 * на нём держатся переходы импорта и публикации, — и без флага перевод по
 * коду молча возвращал бы старое название: агентство переименовало бы «В базе»
 * и не увидело бы на доске ничего.
 */
export function statusLabel(
  locale: Locale,
  /**
   * `nameIsCustom` обязателен намеренно.
   *
   * Пока он был необязательным, половина экранов собирала объект статуса
   * руками и флаг не передавала — переименованная стадия показывалась
   * на доске новым именем, а в списке объектов и в сводке прежним переводом.
   * Обязательное поле превращает такой промах в ошибку компиляции.
   */
  status: { code: string; name: string; nameIsCustom: boolean },
): string {
  if (status.nameIsCustom) return status.name;

  return optionalMessage(locale, `pipeline.${status.code}`) ?? status.name;
}
