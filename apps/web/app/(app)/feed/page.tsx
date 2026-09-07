import Link from 'next/link';

import { workFeed, type FeedStream } from '@kleekto/core';
import { formatDate, formatMoney, formatNumber, translate } from '@kleekto/i18n';
import type { Locale, MessageKey } from '@kleekto/i18n';

import { Photo } from '../../_ui/photo';
import { Card, EmptyState, PageHeader } from '../../_ui/primitives';
import { contextLocale, requireContext } from '../../_lib/session';
import { FeedFilters } from './filters';

/**
 * Рабочая лента — объявления собственников с площадок.
 *
 * ЗАЧЕМ ОНА СУЩЕСТВУЕТ. Агентство зарабатывает на объявлениях, которые подал
 * САМ СОБСТВЕННИК: ему нужна помощь, и за неё платят комиссию. Объявление
 * посредника бесполезно — там уже есть свой агент. Поэтому весь смысл ленты
 * в одном отборе, и он же её единственное жёсткое условие.
 *
 * ОТКУДА ОНА БЕРЁТСЯ. Из страниц выдачи, которые агенты и так открывают
 * каждый день: расширение читает уже загруженное и присылает сюда. Ни одного
 * запроса к площадке от нашего имени — значит, и блокировать нечего.
 *
 * ЧТО ОНА НЕ ДЕЛАЕТ. Не создаёт объектов (правило 0), не звонит и не пишет
 * собственнику (инвариант 17). Строка ведёт на сайт-источник, а дальше
 * работает знакомая схема: агент раскрывает телефон, звонит и отмечает исход
 * расширением.
 *
 * СТРОКИ ЗДЕСЬ ТЕ ЖЕ, ЧТО В «МОИХ ОБЪЕКТАХ», и это не экономия: агент читает
 * и то и другое одними глазами за один день, и вторая манера выкладки
 * заставила бы его каждый раз перестраиваться.
 */

/** Разделители. Литералов в JSX нет (правило 18). */
const DOT = ' · ';
const DASH = '—';
const SLASH = '/';

/** Что принимается из адреса. Всё прочее — не фильтр, а мусор в строке. */
const PROPERTY_TYPES = [
  'APARTMENT',
  'HOUSE',
  'LAND',
  'COMMERCIAL',
  'COUNTRY_HOUSE',
  'HOTEL',
] as const;
const TRANSACTION_TYPES = ['SALE', 'RENT', 'PLEDGE', 'DAILY_RENT'] as const;

/** Порядок полос: сначала то, на чём агентство зарабатывает. */
const STREAMS: readonly FeedStream[] = ['owners', 'fresh'];

/** Имена площадок — не текст интерфейса, а собственные имена. */
const SOURCE_NAME: Readonly<Record<string, string>> = {
  SS_GE: 'ss.ge',
  MYHOME_GE: 'myhome.ge',
};

/** «Квартира · Продажа», но с пропусками: у объявления тип мог не читаться. */
function kindOf(
  locale: Locale,
  item: { propertyType: string | null; transactionType: string | null },
): string {
  return [
    item.propertyType === null
      ? null
      : translate(locale, `property.type.${item.propertyType}` as MessageKey),
    item.transactionType === null
      ? null
      : translate(locale, `property.transaction.${item.transactionType}` as MessageKey),
  ]
    .filter((part): part is string => part !== null)
    .join(DOT);
}

/** «2 комн. · 85 m² · 7/10». */
function factsOf(
  locale: Locale,
  item: {
    rooms: number | null;
    area: number | null;
    floor: number | null;
    totalFloors: number | null;
  },
): string {
  const parts: string[] = [];

  if (item.rooms !== null) {
    parts.push(`${formatNumber(locale, item.rooms)} ${translate(locale, 'property.rooms')}`);
  }
  // «m²» одинаково во всех трёх языках — переводить его было бы выдумкой.
  if (item.area !== null) parts.push(`${formatNumber(locale, item.area)} m²`);

  /*
   * «Нулевой этаж без дома» — это не этаж, а пустое поле.
   *
   * У участков ss.ge присылает `floorNumber: 0` и ни одного этажа в доме,
   * и в строке появлялось «950 m² · 0» — увидено на живой ленте. Настоящий
   * первый этаж от этого не страдает: у него есть дом, а значит, и число
   * этажей в нём.
   */
  const noFloor = item.floor === 0 && item.totalFloors === null;

  if (item.floor !== null && !noFloor) {
    parts.push(
      item.totalFloors === null
        ? String(item.floor)
        : `${String(item.floor)}${SLASH}${String(item.totalFloors)}`,
    );
  }

  return parts.join(DOT);
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireContext();
  const locale = contextLocale(ctx);
  const params = await searchParams;

  const single = (key: string): string | undefined => {
    const value = params[key];
    return typeof value === 'string' && value !== '' ? value : undefined;
  };

  const priceMax = Number(single('priceMax'));

  /*
   * Значения из адреса СВЕРЯЮТСЯ СО СПИСКОМ, а не передаются как есть.
   *
   * Адрес правит кто угодно, а тип уходит в запрос перечислением: чужое
   * слово там — не «ничего не найдено», а пятисотая на странице. Незнакомое
   * значение просто игнорируется: фильтр — удобство просмотра, и ронять
   * из-за него ленту незачем.
   */
  const pick = <T extends string>(key: string, allowed: readonly T[]): T | undefined => {
    const value = single(key);
    return value !== undefined && (allowed as readonly string[]).includes(value)
      ? (value as T)
      : undefined;
  };

  // Полоса живёт в адресе: ссылкой на «новые» можно поделиться.
  const stream: FeedStream = single('stream') === 'fresh' ? 'fresh' : 'owners';

  const items = await workFeed(ctx, {
    stream,
    district: single('district'),
    propertyType: pick('type', PROPERTY_TYPES),
    transactionType: pick('deal', TRANSACTION_TYPES),
    ...(Number.isFinite(priceMax) && priceMax > 0 ? { priceMax } : {}),
  });

  const t = (key: Parameters<typeof translate>[1]): string => translate(locale, key);
  const foundLine = `${String(items.length)} ${t('feed.found')}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('feed.title')}
        action={<p className="text-sm text-[var(--color-text-secondary)]">{foundLine}</p>}
      />

      {/*
        ДВЕ ПОЛОСЫ ОТВЕЧАЮТ НА РАЗНЫЕ ВОПРОСЫ, поэтому они рядом, а не одна
        под фильтром. «Собственники» — кому звонить: на них агентство
        и зарабатывает. «Новые» — что появилось: тип продавца выясняется
        не сразу, и без второй полосы свежее объявление было бы не видно
        вовсе, хотя это может быть лучший лид дня.
      */}
      <nav className="-mt-3 flex flex-wrap items-center gap-1">
        {STREAMS.map((one) => {
          const active = one === stream;
          const next = new URLSearchParams(
            Object.entries(params).flatMap(([key, value]) =>
              typeof value === 'string' && key !== 'stream'
                ? [[key, value] as [string, string]]
                : [],
            ),
          );
          if (one === 'fresh') next.set('stream', 'fresh');

          return (
            <Link
              key={one}
              href={next.size === 0 ? '/feed' : `/feed?${next.toString()}`}
              aria-current={active ? 'page' : undefined}
              className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-[0.8125rem] font-medium transition-colors duration-[var(--duration-fast)] ${
                active
                  ? 'bg-[var(--color-brand)] text-white'
                  : 'text-[var(--color-text-secondary)] [@media(hover:hover)and(pointer:fine)]:hover:bg-[var(--color-surface-muted)]'
              }`}
            >
              {one === 'owners' ? t('feed.streamOwners') : t('feed.streamFresh')}
            </Link>
          );
        })}
      </nav>

      <p className="-mt-4 text-[0.8125rem] text-[var(--color-text-secondary)]">
        {stream === 'owners' ? t('feed.streamOwnersHint') : t('feed.streamFreshHint')}
      </p>

      <FeedFilters
        labels={{
          district: t('feed.district'),
          priceMax: t('feed.priceMax'),
          allTypes: t('property.allTypes'),
          allDeals: t('feed.filterAll'),
          apartment: t('property.type.APARTMENT'),
          house: t('property.type.HOUSE'),
          land: t('property.type.LAND'),
          commercial: t('property.type.COMMERCIAL'),
          sale: t('property.transaction.SALE'),
          rent: t('property.transaction.RENT'),
        }}
      />

      {items.length === 0 ? (
        <EmptyState title={t('feed.empty')} hint={t('feed.emptyHint')} />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--color-border)]">
            {items.map((item) => (
              <li key={item.observationId} className="flex items-center">
                {/*
                  ОБЪЯВЛЕНИЕ ОТКРЫВАЕТСЯ НА САЙТЕ, В НОВОЙ ВКЛАДКЕ.

                  Своей карточки у него нет и не будет: пока собственник
                  не согласился, объекта не существует (правило 0). Лента
                  остаётся открытой — агент вернётся к ней после звонка.

                  noopener noreferrer: открытая страница не получает ни ссылки
                  на наше окно, ни адреса, с которого пришла.
                */}
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative grid flex-1 grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3 transition-colors duration-[var(--duration-fast)] before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:bg-transparent before:transition-colors [@media(hover:hover)and(pointer:fine)]:hover:bg-[var(--color-surface-muted)] [@media(hover:hover)and(pointer:fine)]:hover:before:bg-[var(--color-brand)]"
                >
                  <Photo
                    src={item.thumbnailUrl}
                    alt={t('feed.photoAlt')}
                    className="h-12 w-16 transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)] [@media(hover:hover)and(pointer:fine)]:group-hover:scale-[1.04]"
                  />

                  <div className="min-w-0">
                    <p className="truncate text-[0.9375rem] leading-5 font-medium">
                      {kindOf(locale, item)}
                    </p>
                    <p className="mt-0.5 truncate text-[0.8125rem] leading-5 text-[var(--color-text-secondary)]">
                      {[factsOf(locale, item), item.district ?? '']
                        .filter((part) => part !== '')
                        .join(DOT)}
                    </p>
                    {/* Смена цены — повод позвонить даже по давнему
                        объявлению: собственник начал двигаться. */}
                    {item.lastPriceChangeAt === null ? null : (
                      <p className="mt-1 text-[0.75rem] text-[var(--color-warning)]">
                        {t('feed.priceChanged')}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-[0.9375rem] leading-5 font-semibold">
                      {item.price === null
                        ? DASH
                        : item.currency === null
                          ? formatNumber(locale, item.price)
                          : formatMoney(locale, item.price, item.currency)}
                    </p>
                    {/*
                      НА ТЕЛЕФОНЕ ДАТА УХОДИТ, ПЛОЩАДКА ОСТАЁТСЯ.

                      «myhome.ge · 7 сен. 2026» занимает полтораста пикселей,
                      и на экране в 375 средней колонке оставалось около ста:
                      тип объекта обрезался до «Кварти…». Из двух подписей
                      важнее площадка — по ней агент понимает, куда его сейчас
                      уведут; лента и без того отсортирована по свежести.
                    */}
                    <p className="mt-0.5 truncate text-[0.75rem] leading-4 text-[var(--color-text-tertiary)]">
                      {SOURCE_NAME[item.source] ?? ''}
                      <span className="hidden sm:inline">
                        {DOT}
                        {formatDate(locale, new Date(item.lastSeenAt))}
                      </span>
                    </p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-[0.75rem] text-[var(--color-text-tertiary)]">{t('feed.hint')}</p>
    </div>
  );
}
