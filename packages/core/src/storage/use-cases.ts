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
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * К сообщению прикладывают не только картинки.
 *
 * PDF добавлен потому, что в переписке агентства ходят договоры и выписки,
 * и заставлять человека фотографировать документ экраном — не решение.
 * Список всё равно ЗАКРЫТ: ни архивов, ни офисных документов с макросами,
 * ни тем более исполняемых файлов. Открыть его шире — отдельное решение,
 * а не побочный эффект слова «файл» в задании.
 */
const CHAT_TYPES = [...IMAGE_TYPES, 'application/pdf'] as const;

export function allowedTypes(kind: UploadKind): readonly string[] {
  return kind === 'chat' ? CHAT_TYPES : IMAGE_TYPES;
}

/** Расширение по типу. Тип пришёл снаружи, поэтому берётся из таблицы. */
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/**
 * SVG здесь нет намеренно: это не картинка, а документ со скриптами внутри,
 * и открытый из нашего домена он выполняется как часть страницы.
 */
const MAX_BYTES = 12 * 1024 * 1024;

/** Ссылка на запись живёт минуты: её хватает на загрузку и не больше. */
const UPLOAD_TTL_SECONDS = 300;

/**
 * Ссылка на чтение живёт два часа, а подписывается на границе часа.
 *
 * ПОЧЕМУ ЭТО ВАЖНО, А НЕ МЕЛОЧЬ. Подпись включает время, и раньше оно бралось
 * текущее — то есть у одной и той же фотографии адрес получался НОВЫЙ
 * на каждую отрисовку страницы. Для браузера новый адрес — это новый файл:
 * кэш промахивался всегда, и снимок ехал из хранилища заново при каждом
 * открытии карточки. Отсюда и жалоба «загруженные вручную грузятся медленно»,
 * тогда как фотографии с площадок открываются мгновенно: у них адрес
 * постоянный.
 *
 * Время округляется вниз до часа, поэтому в пределах часа адрес у файла
 * один и тот же, и второй показ берётся из кэша. Срок — два часа: ссылка,
 * подписанная в 12:00 и открытая в 12:59, обязана прожить ещё сколько-то.
 *
 * Замерено на живой странице: первая загрузка снимка — 409 мс, повторная —
 * 4 мс, и браузер сообщает `transferSize: 0`, то есть сети не было вовсе.
 */
const DOWNLOAD_TTL_SECONDS = 7200;

/** Окно, в пределах которого адрес файла не меняется. */
const URL_WINDOW_MS = 60 * 60 * 1000;

/**
 * Насколько долго браузеру держать файл у себя.
 *
 * `private`, а не `public`: ссылка подписана и предназначена одному человеку,
 * общим кэшам её хранить незачем.
 */
const BROWSER_CACHE = 'private, max-age=3600';

export type UploadKind = 'avatar' | 'property' | 'chat';

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

  if (!allowedTypes(input.kind).includes(input.contentType)) {
    throw new ValidationError('Такой тип файла не принимается', { fields: ['contentType'] });
  }

  if (input.sizeBytes <= 0 || input.sizeBytes > MAX_BYTES) {
    throw new ValidationError('Файл слишком большой', { fields: ['sizeBytes'] });
  }

  const extension = EXTENSIONS[input.contentType] ?? 'bin';
  const key = `${ctx.companyId}/${input.kind}/${randomUUID()}.${extension}`;

  const uploadUrl = await getSignedUrl(
    config.client,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: input.contentType,
      /*
       * Заголовок кэширования кладётся на файл. Хранилище Neon его сейчас
       * НЕ ВОЗВРАЩАЕТ — проверено запросом, в ответе `cache-control` пуст, —
       * но отправлять его правильно: это обычный заголовок S3, и если Neon
       * начнёт его отдавать, кэш станет ещё определённее. Работать же оно
       * работает и без него, за счёт постоянного адреса: браузер при пустом
       * заголовке применяет свои правила по дате изменения файла.
       */
      CacheControl: BROWSER_CACHE,
    }),
    { expiresIn: UPLOAD_TTL_SECONDS },
  );

  return { uploadUrl, key };
}

/**
 * Ссылка для показа файла.
 *
 * Подписывается на каждый показ: бак приватный, постоянного адреса у файла
 * нет. Подпись — это HMAC без обращения к сети, поэтому подписать два
 * десятка картинок в списке дёшево.
 *
 * АДРЕС ПРИ ЭТОМ ОДИН И ТОТ ЖЕ В ПРЕДЕЛАХ ЧАСА — см. `DOWNLOAD_TTL_SECONDS`.
 * Иначе браузер считал бы каждую отрисовку новым файлом и качал бы снимок
 * заново при каждом открытии карточки.
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
    // Округление до часа и есть то, что делает адрес постоянным.
    signingDate: new Date(Math.floor(Date.now() / URL_WINDOW_MS) * URL_WINDOW_MS),
  });
}

/**
 * Содержимое файла — байтами, а не ссылкой.
 *
 * Нужно там, где файл собирается на сервере, а не отдаётся браузеру: сложить
 * фотографии объекта в один архив по ссылкам значило бы подписать адрес,
 * сходить по нему наружу и вернуться — вместо того чтобы взять из хранилища
 * напрямую.
 *
 * Внешние адреса (объекты с площадок) скачиваются обычным запросом: своего
 * там ничего нет, и подписывать нечем.
 */
export async function fileBytes(
  ctx: AuthContext,
  key: string,
): Promise<{ bytes: Uint8Array; contentType: string | null } | null> {
  if (key === '') return null;

  if (key.startsWith('http://') || key.startsWith('https://')) {
    try {
      const response = await fetch(key);
      if (!response.ok) return null;

      return {
        bytes: new Uint8Array(await response.arrayBuffer()),
        contentType: response.headers.get('content-type'),
      };
    } catch {
      // Чужая ссылка могла протухнуть вместе с объявлением. Это не поломка
      // архива: остальные фотографии всё равно нужны агенту.
      return null;
    }
  }

  const config = storage();
  if (config === null) return null;

  /*
   * Та же граница, что и у подписи адреса: ключ обязан начинаться
   * с идентификатора компании. Без этой строки любой ключ из тела запроса
   * читал бы чужой файл (правило 5).
   */
  if (!key.startsWith(`${ctx.companyId}/`)) return null;

  try {
    const object = await config.client.send(
      new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    );
    if (object.Body === undefined) return null;

    return {
      bytes: await object.Body.transformToByteArray(),
      contentType: object.ContentType ?? null,
    };
  } catch {
    return null;
  }
}

/** Ссылки сразу для списка — чтобы не подписывать по одной в цикле вызовов. */
export async function fileUrls(
  ctx: AuthContext,
  keys: readonly string[],
): Promise<Array<string | null>> {
  return Promise.all(keys.map((key) => fileUrl(ctx, key)));
}
