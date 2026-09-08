import { prisma } from '@kleekto/db';

import type { AuthContext } from '../auth/context';
import { NotFoundError } from '../errors';
import { assertScope, requirePermission } from '../rbac/guard';
import { fileBytes } from '../storage/use-cases';

/**
 * Одна фотография объекта — файлом, готовым к сохранению на диск.
 *
 * ПОЧЕМУ ПО ОДНОЙ, А НЕ АРХИВОМ. Архив приходилось распаковывать перед тем,
 * как перетащить снимки в форму площадки, — лишний шаг на каждом объекте.
 * Отдельные файлы падают в «Загрузки» и перетаскиваются оттуда сразу.
 *
 * Браузер спросит один раз, можно ли сайту сохранять несколько файлов;
 * дальше он молчит. Обойти этот вопрос нельзя, и притворяться, что его нет,
 * тоже не стоит: агенту про него сказано в подсказке.
 */

/** Что подставить, когда тип файла неизвестен. */
const FALLBACK_EXTENSION = 'jpg';

const EXTENSION_BY_TYPE: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

/** Номер в имени: по нему снимки выстраиваются в том же порядке, что в карточке. */
const NAME_PADDING = 2;

export interface PropertyPhoto {
  bytes: Uint8Array;
  contentType: string;
  /** Имя для сохранения. Латиницей: кириллица в заголовке ответа ломается. */
  fileName: string;
}

/**
 * Расширение по типу файла, а если его нет — по самому адресу.
 *
 * Имя важнее, чем кажется: форма площадки принимает файлы по расширению,
 * и снимок с именем `01.bin` она отвергнет.
 */
function extensionOf(key: string, contentType: string | null): string {
  const byType =
    contentType === null ? undefined : EXTENSION_BY_TYPE[contentType.split(';')[0] ?? ''];
  if (byType !== undefined) return byType;

  const fromKey = /\.([a-z0-9]{2,5})(?:$|\?)/iu.exec(key)?.[1]?.toLowerCase();
  return fromKey === undefined ? FALLBACK_EXTENSION : fromKey;
}

/** Сколько снимков у объекта. Нужно интерфейсу, чтобы знать, сколько запросить. */
export async function propertyPhotoCount(ctx: AuthContext, propertyId: string): Promise<number> {
  const property = await readable(ctx, propertyId);
  return property.photos.length;
}

export async function propertyPhoto(
  ctx: AuthContext,
  propertyId: string,
  index: number,
): Promise<PropertyPhoto> {
  const property = await readable(ctx, propertyId);

  const key = property.photos[index];
  if (key === undefined) throw new NotFoundError();

  const file = await fileBytes(ctx, key);

  /*
   * Снимок мог исчезнуть вместе с объявлением: у объектов с площадок
   * в поле лежат чужие адреса. Это не поломка — просто этого файла больше
   * нет, и интерфейс скажет об этом числом.
   */
  if (file === null) throw new NotFoundError();

  const extension = extensionOf(key, file.contentType);
  const number = String(index + 1).padStart(NAME_PADDING, '0');

  return {
    bytes: file.bytes,
    contentType: file.contentType ?? 'application/octet-stream',
    /*
     * Имя начинается с короткого номера объекта: агент за день сохраняет
     * снимки нескольких объектов, и шестнадцать файлов `01.jpg` вперемешку
     * с другими шестнадцатью `01.jpg` он не разберёт. Номер объекта короткий,
     * порядковый номер — с ведущим нулём, чтобы сортировка в папке
     * совпадала с порядком в карточке.
     */
    fileName: `${propertyId.slice(0, 8)}-${number}.${extension}`,
  };
}

/** Объект, который этому человеку разрешено читать. */
async function readable(ctx: AuthContext, propertyId: string): Promise<{ photos: string[] }> {
  const scope = requirePermission(ctx, 'property', 'read');

  const property = await prisma.property.findFirst({
    where: { id: propertyId, companyId: ctx.companyId },
    select: { companyId: true, teamId: true, assignedUserId: true, photos: true },
  });

  // Чужая компания и несуществующий объект снаружи неразличимы (риск R-04).
  if (property === null) throw new NotFoundError();

  assertScope(ctx, scope, {
    companyId: property.companyId,
    teamId: property.teamId,
    ownerUserId: property.assignedUserId,
  });

  return { photos: property.photos };
}
