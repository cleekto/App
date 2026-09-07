import { propertyPhotoArchive } from '@kleekto/core';

import { failureResponse, requireAuth } from '../../../../_lib/handler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/properties/{id}/photos — все фотографии объекта одним архивом.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ МАРШРУТ, А НЕ ССЫЛКИ. Чтобы разместить объявление,
 * агент перетаскивает в форму площадки до шестнадцати снимков. Сейчас
 * он сохраняет их по одному правой кнопкой — на каждом объекте. Это самая
 * механическая часть размещения и единственная, которую можно убрать
 * целиком, ничего не зная о разметке площадки.
 *
 * ОТВЕТ ЗДЕСЬ НЕ JSON, поэтому и обёртка `handle` не подходит: она всегда
 * заворачивает результат в JSON. Ошибки при этом отдаются тем же способом,
 * что и везде, — общим отображением доменной ошибки в HTTP.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth(request);
    const { id } = await params;
    const archive = await propertyPhotoArchive(ctx, id);

    return new Response(archive.bytes as unknown as BodyInit, {
      headers: {
        'content-type': 'application/zip',
        // `attachment` — чтобы браузер сохранял файл, а не пытался открыть.
        'content-disposition': `attachment; filename="${archive.fileName}"`,
        'content-length': String(archive.bytes.byteLength),
        // Архив собирается из подписанных ссылок и прав текущего человека:
        // класть его в общий кеш нельзя.
        'cache-control': 'private, no-store',
        // Сколько снимков вошло и сколько не дошло — интерфейсу, чтобы
        // сказать это агенту, а не молчать.
        'x-photo-count': String(archive.count),
        'x-photo-missing': String(archive.missing),
      },
    });
  } catch (error) {
    return failureResponse(error);
  }
}
