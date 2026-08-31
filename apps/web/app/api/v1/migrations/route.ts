import { ValidationError, uploadMigrationFile } from '@cleekto/core';

import { handle, requireAuth } from '../../_lib/handler';

export const dynamic = 'force-dynamic';

/** Файл агентства бывает на тысячи строк, но не на сотни мегабайт. */
const MAX_FILE_BYTES = 20 * 1024 * 1024;

/**
 * POST /api/v1/migrations — загрузка файла как есть.
 *
 * multipart, а не JSON: xlsx это бинарный формат, и base64 раздул бы его
 * на треть без всякой пользы.
 */
export async function POST(request: Request) {
  return handle(
    async () => {
      const ctx = await requireAuth(request);

      const form = await request.formData();
      const file = form.get('file');
      const teamId = form.get('teamId');
      const sheetName = form.get('sheetName');

      if (!(file instanceof File)) {
        throw new ValidationError('Файл не приложен', { fields: ['file'] });
      }
      if (file.size > MAX_FILE_BYTES) {
        throw new ValidationError('Файл больше 20 МБ', { fields: ['file'] });
      }
      if (typeof teamId !== 'string' || teamId === '') {
        throw new ValidationError('Не указана команда-получатель', { fields: ['teamId'] });
      }

      return uploadMigrationFile(ctx, {
        buffer: Buffer.from(await file.arrayBuffer()),
        fileName: file.name,
        teamId,
        ...(typeof sheetName === 'string' && sheetName !== '' ? { sheetName } : {}),
      });
    },
    { status: 201 },
  );
}
