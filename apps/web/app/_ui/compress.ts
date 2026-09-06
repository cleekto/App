/**
 * Уменьшение фотографий перед отправкой в хранилище.
 *
 * СЖИМАЕТ БРАУЗЕР, А НЕ СЕРВЕР. Файл и так идёт в хранилище напрямую, минуя
 * нашу функцию, — и это не случайность, а решение: пропускать снимок через
 * функцию значило бы упереться в предел размера тела запроса и платить
 * за время перекладывания байтов. Сжатие на сервере вернуло бы всё то,
 * от чего ушли, и добавило бы к этому нагрузку.
 *
 * Здесь же экономится не только место в баке, но и трафик агента: снимок
 * с телефона — это 4–8 мегабайт, из которых после уменьшения остаётся
 * несколько сотен килобайт. В разъездах, на мобильном интернете, разница
 * между «отправилось сразу» и «отправляется минуту» — это разница между
 * заведённым объектом и брошенной формой.
 *
 * ЛЮБАЯ НЕУДАЧА ОЗНАЧАЕТ «ОТПРАВИТЬ КАК ЕСТЬ». Старый браузер, нехватка
 * памяти на огромном снимке, картинка неизвестного вида — во всех случаях
 * уходит оригинал. Потерять фотографию, экономя место, — плохой обмен.
 */

/** Что делаем с каждым видом файла. */
interface Recipe {
  /** Предел по длинной стороне, пикселей. */
  maxSide: number;
  /** Качество WebP от 0 до 1. */
  quality: number;
}

/*
 * Пределы выбраны по тому, как снимок показывается, а не «на глаз».
 *
 * Аватарка живёт в кружках 24–44 пикселя; 512 — с запасом на экраны
 * с двойной плотностью и на будущий крупный показ в профиле.
 *
 * Фотография объекта открывается во всю ширину карточки и может
 * рассматриваться: 1920 по длинной стороне — это полноэкранный просмотр
 * на обычном мониторе без видимой потери. Больше держать незачем: объявление
 * на площадке всё равно ужмёт своё.
 */
const RECIPES: Record<string, Recipe> = {
  avatar: { maxSide: 512, quality: 0.85 },
  property: { maxSide: 1920, quality: 0.82 },
  chat: { maxSide: 1920, quality: 0.82 },
};

/**
 * WebP, а не JPEG: при той же различимой глазом картинке он заметно меньше
 * и, в отличие от JPEG, умеет прозрачность — снимок плана квартиры с белым
 * фоном не почернеет.
 */
const TARGET_TYPE = 'image/webp';

/**
 * Уменьшает изображение. Не изображение возвращается нетронутым.
 *
 * PDF, приложенный к сообщению, сюда попадает наравне с фотографией —
 * и обязан уйти как есть.
 */
export async function compressImage(file: File, kind: string): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  const recipe = RECIPES[kind];
  if (recipe === undefined) return file;

  try {
    const bitmap = await decode(file);
    if (bitmap === null) return file;

    const { width, height } = fit(bitmap.width, bitmap.height, recipe.maxSide);
    const blob = await draw(bitmap, width, height, recipe.quality);
    bitmap.close();

    if (blob === null) return file;

    /*
     * СЖАТОЕ БЕРЁТСЯ, ТОЛЬКО ЕСЛИ ОНО МЕНЬШЕ.
     *
     * Маленький и уже сжатый снимок после пересжатия нередко становится
     * ТЯЖЕЛЕЕ: кодировщик добавляет своё, а экономить уже нечего. Отдать
     * такой результат значило бы занимать больше места ради экономии места.
     */
    if (blob.size >= file.size) return file;

    return new File([blob], rename(file.name), {
      type: TARGET_TYPE,
      lastModified: file.lastModified,
    });
  } catch {
    // Нехватка памяти на огромном снимке, повреждённый файл, старый браузер —
    // причина неважна: уходит оригинал.
    return file;
  }
}

/**
 * Разбор файла в картинку.
 *
 * `createImageBitmap` с `imageOrientation: 'from-image'` САМ ПОВОРАЧИВАЕТ
 * снимок по метке EXIF. Без этого фотография, снятая телефоном вертикально,
 * легла бы набок: холст о метке не знает, а вместе с пересжатием метка
 * теряется — и повернуть обратно было бы уже нечем.
 */
async function decode(file: File): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== 'function') return null;

  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

/**
 * Новые размеры с сохранением пропорций.
 *
 * Снимок меньше предела НЕ РАСТЯГИВАЕТСЯ: увеличение не добавит подробностей,
 * зато добавит веса — ровно наоборот задаче.
 */
export function fit(
  width: number,
  height: number,
  maxSide: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };

  const ratio = maxSide / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/** Перерисовка в нужный размер и кодирование. */
async function draw(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (context === null) return null;

  // Сглаживание высокого качества: при уменьшении в несколько раз без него
  // на мелких деталях появляется зернистость, и снимок выглядит хуже,
  // чем должен при таком размере.
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, TARGET_TYPE, quality);
  });

  // Браузер, не умеющий WebP, отдаёт PNG под другим типом либо `null`.
  // И то и другое означает «не вышло»: PNG фотографии только тяжелее.
  return blob !== null && blob.type === TARGET_TYPE ? blob : null;
}

/**
 * Имя с новым расширением.
 *
 * Содержимое стало другим, и имя обязано это отражать: «договор.jpg»,
 * внутри которого WebP, обманет и человека, и программу, которой он этот
 * файл отдаст. Само имя при этом сохраняется — по нему вложение и узнают.
 */
export function rename(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}.webp`;
}
