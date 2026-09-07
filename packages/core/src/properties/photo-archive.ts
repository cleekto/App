import { prisma } from '@kleekto/db';
import { zipSync } from 'fflate';

import type { AuthContext } from '../auth/context';
import { NotFoundError } from '../errors';
import { assertScope, requirePermission } from '../rbac/guard';
import { fileBytes } from '../storage/use-cases';

/**
 * Все фотографии объекта одним файлом.
 *
 * ЗАЧЕМ. Чтобы разместить объявление на площадке, агент перетаскивает
 * в форму до шестнадцати снимков. Сейчас он сохраняет их по одному правой
 * кнопкой — шестнадцать раз на каждый объект. Это самая механическая часть
 * размещения и единственная, которую можно убрать целиком, ничего
 * не зная о разметке площадки.
 *
 * ПОЧЕМУ АРХИВ БЕЗ СЖАТИЯ. Внутри уже сжатые webp и jpeg; deflate по ним
 * даст проценты и потратит время на каждый запрос. Нужен контейнер,
 * а не сжатие.
 */

/** Порядок в архиве совпадает с порядком в карточке — он же порядок показа. */
const NAME_PADDING = 2;

/** Что подставить, когда тип файла неизвестен. */
const FALLBACK_EXTENSION = 'jpg';

const EXTENSION_BY_TYPE: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

export interface PhotoArchive {
  /** Имя файла для браузера. Латиницей: кириллица в заголовке ломается. */
  fileName: string;
  bytes: Uint8Array;
  /** Сколько снимков вошло. */
  count: number;
  /** Сколько не удалось забрать — их агент увидит числом, а не молча. */
  missing: number;
}

/**
 * Расширение по типу файла, а если его нет — по самому адресу.
 *
 * Имя внутри архива важнее, чем кажется: форма площадки принимает файлы
 * по расширению, и снимок, названный `01.bin`, она отвергнет.
 */
function extensionOf(key: string, contentType: string | null): string {
  const byType =
    contentType === null ? undefined : EXTENSION_BY_TYPE[contentType.split(';')[0] ?? ''];
  if (byType !== undefined) return byType;

  const fromKey = /\.([a-z0-9]{2,5})(?:$|\?)/iu.exec(key)?.[1]?.toLowerCase();
  return fromKey === undefined ? FALLBACK_EXTENSION : fromKey;
}

export async function propertyPhotoArchive(
  ctx: AuthContext,
  propertyId: string,
): Promise<PhotoArchive> {
  const scope = requirePermission(ctx, 'property', 'read');

  const property = await prisma.property.findFirst({
    where: { id: propertyId, companyId: ctx.companyId },
    select: { id: true, companyId: true, teamId: true, assignedUserId: true, photos: true },
  });

  // Чужая компания и несуществующий объект снаружи неразличимы (риск R-04).
  if (property === null) throw new NotFoundError();

  assertScope(ctx, scope, {
    companyId: property.companyId,
    teamId: property.teamId,
    ownerUserId: property.assignedUserId,
  });

  if (property.photos.length === 0) throw new NotFoundError();

  /*
   * Снимки берутся ПАРАЛЛЕЛЬНО. Их до шестнадцати, и последовательное
   * чтение превратило бы одну кнопку в десяток секунд ожидания — ровно
   * та беда, от которой мы уходим.
   */
  const loaded = await Promise.all(
    property.photos.map(async (key, index) => ({ index, key, file: await fileBytes(ctx, key) })),
  );

  const files: Record<string, Uint8Array> = {};
  let missing = 0;

  for (const { index, key, file } of loaded) {
    if (file === null) {
      /*
       * Одна недоступная фотография не отменяет остальные. У объектов
       * с площадок в поле лежат чужие адреса, и они протухают вместе
       * с объявлением — это ожидаемо, а не поломка.
       */
      missing += 1;
      continue;
    }

    const number = String(index + 1).padStart(NAME_PADDING, '0');
    files[`${number}.${extensionOf(key, file.contentType)}`] = file.bytes;
  }

  if (Object.keys(files).length === 0) throw new NotFoundError();

  return {
    // Имя латиницей и по идентификатору объекта: заголовок ответа
    // не переносит кириллицу без возни с кодировками, а объект и так
    // узнаётся по номеру.
    fileName: `kleekto-${propertyId}-photos.zip`,
    // `level: 0` — сложить как есть. Внутри уже сжатые изображения.
    bytes: zipSync(files, { level: 0 }),
    count: Object.keys(files).length,
    missing,
  };
}
