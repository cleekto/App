import { prisma, SellerKind } from '@kleekto/db';
import type { Source } from '@kleekto/db';

/**
 * Очередь опознания продавцов ss.ge.
 *
 * ЗАЧЕМ. В списке ss.ge тип продавца не виден — частный маклер там неотличим
 * от собственника. Пока тип не выяснен, объявление в ленту собственников
 * не попадает (решение владельца: прятать до выяснения). Выяснить можно
 * только со страницы объявления, и это единственное место, ради которого
 * сборщик вообще открывает карточки.
 *
 * ПОЧЕМУ ЭТО ДЁШЕВО. Опознаётся ПРОДАВЕЦ, а не объявление: одного запроса
 * хватает на все его объявления — прошлые и будущие. У myhome очередь пуста
 * всегда: там площадка называет тип прямо в списке.
 *
 * ТЕЛЕФОН СЮДА НЕ ПОПАДАЕТ. Со страницы читается одно поле — тип продавца.
 * Лента вообще не база: номер собственника появляется в системе только после
 * того, как агент раскрыл его сам и получил согласие (правило 0 и 11).
 */

export interface SellerToResolve {
  sellerId: string;
  /** Любое объявление этого продавца — по нему и узнаётся тип. */
  listingUrl: string;
  /** Сколько его объявлений мы уже видели. Чем больше, тем выше в очереди. */
  listingsSeen: number;
}

/**
 * Кого опознавать в первую очередь.
 *
 * Порядок — по числу объявлений: один запрос, открывающий продавцу с восемью
 * объявлениями, стоит восьми строк в ленте, а продавцу с одним — одной.
 * Так очередь разбирается с максимальной пользой на обращение.
 */
export async function sellersToResolve(source: Source, limit: number): Promise<SellerToResolve[]> {
  const sellers = await prisma.listingSeller.findMany({
    where: {
      source,
      entityType: null,
      // Продавец без единого объявления в индексе — опознавать нечего.
      observations: { some: {} },
    },
    orderBy: [{ listingsSeen: 'desc' }, { lastSeenAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      listingsSeen: true,
      observations: {
        take: 1,
        orderBy: { lastSeenAt: 'desc' },
        select: { canonicalUrl: true },
      },
    },
  });

  return sellers.flatMap((seller) => {
    const url = seller.observations[0]?.canonicalUrl;
    if (url === undefined) return [];

    return [{ sellerId: seller.id, listingUrl: url, listingsSeen: seller.listingsSeen }];
  });
}

/**
 * Записать выясненный тип и разом пометить все объявления продавца.
 *
 * Ради этого «разом» сущность продавца и заведена: одно открытие карточки
 * зажигает в ленте все его объявления, и площадка при этом получает
 * один запрос, а не по одному на объявление.
 */
export async function applySellerKind(
  sellerId: string,
  kind: 'owner' | 'agency',
  resolvedFrom: 'listing' | 'volume',
): Promise<number> {
  const entityType = kind === 'owner' ? SellerKind.owner : SellerKind.agency;

  await prisma.listingSeller.update({
    where: { id: sellerId },
    data: { entityType, resolvedFrom },
  });

  const { count } = await prisma.listingObservation.updateMany({
    where: { sellerId },
    data: { sellerKind: entityType },
  });

  return count;
}
