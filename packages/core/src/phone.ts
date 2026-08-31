import { ValidationError } from './errors';

/**
 * Нормализация телефонов в E.164.
 *
 * ЧТО ЗДЕСЬ ИЗВЕСТНО И ЧТО НЕТ. Полный набор форматов, в которых номер
 * встречается на ss.ge и myhome.ge, неизвестен — это `OPEN QUESTION` Q18,
 * и он ждёт фикстур фазы 5 (правило R2).
 *
 * Написанное ниже покрывает номера, которые в CRM вводит человек: телефоны
 * профилей публикации. Для номеров собственника, приходящих со страницы,
 * этот код будет пересмотрен по фикстурам — и тогда набор форматов станет
 * фактом, а не предположением.
 *
 * Хранятся всегда два вида: оригинал как ввели и нормализованный (Q18).
 * Без оригинала разобраться в неверной нормализации будет невозможно,
 * а неверная нормализация ломает дедупликацию молча (риск R-06).
 */

/** Код Грузии. Единственная страна MVP. */
const GEORGIA_CODE = '995';

/** Национальный номер Грузии — девять цифр. */
const GEORGIA_NATIONAL_LENGTH = 9;

export interface NormalizedPhone {
  /** Как ввёл человек. Хранится без изменений. */
  original: string;
  /** E.164: `+995XXXXXXXXX`. */
  normalized: string;
}

/**
 * Приводит номер к E.164 или бросает ValidationError.
 *
 * Не «старается угадать»: номер, который не разобрался, — это ошибка ввода,
 * а не повод записать в базу мусор, который потом сломает сравнение.
 */
export function normalizePhone(input: string): NormalizedPhone {
  const original = input.trim();

  if (original === '') {
    throw new ValidationError('Телефон не указан', { fields: ['phone'] });
  }

  // Всё, кроме цифр и ведущего плюса, — оформление: пробелы, скобки, дефисы.
  const digits = original.replace(/[^\d]/gu, '');

  if (digits === '') {
    throw new ValidationError('В номере нет цифр', { fields: ['phone'] });
  }

  const national = toGeorgianNational(digits);

  if (national === null) {
    throw new ValidationError(
      'Не удалось разобрать номер. Ожидается грузинский номер, например +995 555 12 34 56',
      { fields: ['phone'] },
    );
  }

  return { original, normalized: `+${GEORGIA_CODE}${national}` };
}

/**
 * Выделяет девятизначный национальный номер из последовательности цифр.
 *
 * Три формы, которые реально пишут люди:
 *   995555123456  — с кодом страны
 *   0555123456    — с национальным префиксом
 *   555123456     — только номер
 */
function toGeorgianNational(digits: string): string | null {
  if (digits.startsWith(GEORGIA_CODE)) {
    const rest = digits.slice(GEORGIA_CODE.length);
    return rest.length === GEORGIA_NATIONAL_LENGTH ? rest : null;
  }

  if (digits.startsWith('0')) {
    const rest = digits.slice(1);
    return rest.length === GEORGIA_NATIONAL_LENGTH ? rest : null;
  }

  return digits.length === GEORGIA_NATIONAL_LENGTH ? digits : null;
}

/**
 * Маска для журналов и сообщений об ошибках.
 *
 * ПРАВИЛО 10: телефоны не логируются. Показываются код страны и последние
 * две цифры — этого хватает, чтобы человек узнал свой номер, и не хватает,
 * чтобы номер утёк.
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/gu, '');
  if (digits.length < 4) return '***';

  return `+${digits.slice(0, 3)}•••••••${digits.slice(-2)}`;
}
