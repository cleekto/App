import { randomUUID } from 'node:crypto';

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { AuthContext } from '../auth/context';
import { ValidationError } from '../errors';

/**
 * Хранилище файлов: аватарки сотрудников и фотографии объектов.
 *
 * РЕШЕНИЕ ПЕРЕСМОТРЕНО. В спецификации записано «только URL, файлы в MVP
 * не хранятся» (Q11). Владелец 2026-09-05 попросил загрузку — старое решение
 * отменено сознательно, а не забыто.
 *
 * БАК ПРИВАТНЫЙ, И ЭТО НЕ ПЕРЕСТРАХОВКА. В открытом баке фотография
 * сотрудника доступна любому, кто узнал адрес: ссылка уходит в мессенджер,
 * попадает в историю браузера, остаётся в логах. Поэтому и на запись,
 * и на чтение выдаются подписанные ссылки с коротким сроком.
 *
 * ФАЙЛ ИДЁТ В ХРАНИЛИЩЕ НАПРЯМУЮ, минуя наш сервер. Пропускать его через
 * функцию значило бы упереться в предел размера тела запроса — фотография
 * с телефона легко больше, — и оплачивать время функции за перекладывание
 * байтов.
 */

/** Что разрешено загружать. Список закрыт: `image/*` пропустил бы SVG. */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * SVG здесь нет намеренно: это не картинка, а документ со скриптами внутри,
 * и открытый из нашего домена он выполняется как часть страницы.
 */
const MAX_BYTES = 12 * 1024 * 1024;

/** Ссылка на запись живёт минуты: её хватает на загрузку и не больше. */
const UPLOAD_TTL_SECONDS = 300;

/** Ссылка на чтение живёт час: страницу успевают посмотреть, не дольше. */
const DOWNLOAD_TTL_SECONDS = 3600;

export type UploadKind = 'avatar' | 'property';

interface StorageConfig {
  client: S3Client;
  bucket: string;
}

let cached: StorageConfig | null = null;

/**
 * Клиент хранилища либо `null`, если оно не настроено.
 *
 * `null`, а не исключение при загрузке модуля: продукт обязан работать
 * и без хранилища — просто без загрузки картинок. Иначе забытая переменная
 * окружения роняла бы весь сервер, включая то, что к файлам отношения
 * не имеет.
 */
function storage(): StorageConfig | null {
  if (cached !== null) return cached;

  const endpoint = process.env['AWS_ENDPOINT_URL_S3'];
  const bucket = process.env['S3_BUCKET'];
  const accessKeyId = process.env['AWS_ACCESS_KEY_ID'];
  const secretAccessKey = process.env['AWS_SECRET_ACCESS_KEY'];

  if (
    endpoint === undefined ||
    bucket === undefined ||
    accessKeyId === undefined ||
    accessKeyId === '' ||
    secretAccessKey === undefined ||
    secretAccessKey === ''
  ) {
    return null;
  }

  cached = {
    bucket,
    client: new S3Client({
      endpoint,
      region: process.env['AWS_REGION'] ?? 'us-east-2',
      // Neon отдаёт бак путём, а не поддоменом: без этого адрес собирается
      // как `bucket.endpoint` и не резолвится.
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };

  return cached;
}

export function storageConfigured(): boolean {
  return storage() !== null;
}

/**
 * Каких переменных окружения не хватает хранилищу.
 *
 * ИМЕНА, НИКОГДА ЗНАЧЕНИЯ. Ровно тот же приём, что и у проверки базы:
 * `urlConfigured` отличает «не настроено» от «не достучались», не показывая
 * строку подключения. Имя незаданной переменной — не секрет, а секрет по
 * определению не задан, и показывать в нём нечего.
 *
 * Без этого списка «не грузятся фотографии» на чужой машине решается
 * перебором: пять переменных, и какая из них потерялась при переносе
 * в облако, снаружи не видно.
 */
export function storageMissing(): string[] {
  const required = {
    AWS_ENDPOINT_URL_S3: process.env['AWS_ENDPOINT_URL_S3'],
    S3_BUCKET: process.env['S3_BUCKET'],
    AWS_ACCESS_KEY_ID: process.env['AWS_ACCESS_KEY_ID'],
    AWS_SECRET_ACCESS_KEY: process.env['AWS_SECRET_ACCESS_KEY'],
  };

  // Пустая строка — это тоже «не задано»: в панели облака переменную легко
  // завести и оставить без значения, и выглядит она там заполненной.
  return Object.entries(required)
    .filter(([, value]) => value === undefined || value === '')
    .map(([name]) => name);
}

/**
 * Ссылка для загрузки файла прямо в хранилище.
 *
 * КЛЮЧ СОБИРАЕТ СЕРВЕР, а не клиент. Иначе браузер прислал бы
 * `../../чужая-компания/...` или просто перезаписал бы чужой файл: имя,
 * пришедшее снаружи, — это адрес записи, и доверять ему нельзя.
 *
 * В ключ входит `companyId`: файлы компаний лежат порознь, и по одному
 * взгляду на хранилище видно, чьё что.
 */
export async function createUploadUrl(
  ctx: AuthContext,
  input: { kind: UploadKind; contentType: string; sizeBytes: number },
): Promise<{ uploadUrl: string; key: string }> {
  const config = storage();
  if (config === null) {
    throw new ValidationError('Хранилище файлов не настроено');
  }

  if (!(ALLOWED_TYPES as readonly string[]).includes(input.contentType)) {
    throw new ValidationError('Такой тип файла не принимается', { fields: ['contentType'] });
  }

  if (input.sizeBytes <= 0 || input.sizeBytes > MAX_BYTES) {
    throw new ValidationError('Файл слишком большой', { fields: ['sizeBytes'] });
  }

  const extension =
    input.contentType === 'image/png' ? 'png' : input.contentType === 'image/webp' ? 'webp' : 'jpg';
  const key = `${ctx.companyId}/${input.kind}/${randomUUID()}.${extension}`;

  const uploadUrl = await getSignedUrl(
    config.client,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: input.contentType,
    }),
    { expiresIn: UPLOAD_TTL_SECONDS },
  );

  return { uploadUrl, key };
}

/**
 * Ссылка для показа файла.
 *
 * Подписывается на каждый показ: бак приватный, и постоянного адреса
 * у файла нет. Подпись — это HMAC без обращения к сети, поэтому подписать
 * два десятка картинок в списке дёшево.
 *
 * Чужой ключ не подписывается: файл принадлежит компании, и проверка идёт
 * по началу ключа. Без неё, зная ключ, можно было бы получить ссылку
 * на файл другого агентства.
 */
export async function fileUrl(ctx: AuthContext, key: string | null): Promise<string | null> {
  if (key === null || key === '') return null;

  /*
   * В поле фотографий лежат ДВА РАЗНЫХ ВИДА ЗНАЧЕНИЙ, и это не беспорядок,
   * а история: у объектов, пришедших с площадок, там внешние адреса
   * (правило «только URL», как было с первого дня), у заведённых вручную —
   * ключи нашего хранилища.
   *
   * Внешний адрес отдаётся как есть: подписывать чужую ссылку нечем,
   * да и незачем — она и так публична на самой площадке.
   */
  if (key.startsWith('http://') || key.startsWith('https://')) return key;

  const config = storage();
  if (config === null) return null;

  if (!key.startsWith(`${ctx.companyId}/`)) return null;

  return getSignedUrl(config.client, new GetObjectCommand({ Bucket: config.bucket, Key: key }), {
    expiresIn: DOWNLOAD_TTL_SECONDS,
  });
}

/** Ссылки сразу для списка — чтобы не подписывать по одной в цикле вызовов. */
export async function fileUrls(
  ctx: AuthContext,
  keys: readonly string[],
): Promise<Array<string | null>> {
  return Promise.all(keys.map((key) => fileUrl(ctx, key)));
}
