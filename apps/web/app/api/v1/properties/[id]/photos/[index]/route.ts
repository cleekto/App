import { propertyPhoto } from '@kleekto/core';

import { failureResponse, requireAuth } from '../../../../../_lib/handler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/properties/{id}/photos/{index} — одна фотография файлом.
 *
 * ЗАЧЕМ ПО ОДНОЙ. Раньше снимки отдавались архивом, и агент распаковывал его
 * перед тем, как перетащить в форму площадки, — лишний шаг на каждом объекте.
 * Отдельные файлы падают в «Загрузки» и перетаскиваются оттуда сразу.
 *
 * ПОЧЕМУ ЧЕРЕЗ НАС, А НЕ ПРЯМОЙ ССЫЛКОЙ. Свои снимки лежат в приватном баке,
 * а у объектов с площадок в поле стоит чужой адрес: атрибут `download`
 * на ссылку в другой домен браузер игнорирует, и вместо сохранения
 * открылась бы вкладка с картинкой.
 *
 * Ответ здесь не JSON, поэтому и обёртка `handle` не подходит: она всегда
 * заворачивает результат в JSON. Ошибки при этом отдаются общим способом.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  try {
    const ctx = await requireAuth(request);
    const { id, index } = await params;

    const photo = await propertyPhoto(ctx, id, Number.parseInt(index, 10));

    return new Response(photo.bytes as unknown as BodyInit, {
      headers: {
        'content-type': photo.contentType,
        // `attachment` — чтобы браузер сохранял файл, а не показывал его.
        'content-disposition': `attachment; filename="${photo.fileName}"`,
        'content-length': String(photo.bytes.byteLength),
        // Снимок отдаётся по правам текущего человека: в общий кеш нельзя.
        'cache-control': 'private, no-store',
      },
    });
  } catch (error) {
    return failureResponse(error);
  }
}
