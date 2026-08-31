import { normalizePhone } from '../phone';

/**
 * Очистка текста, уходящего на площадку.
 *
 * ПРАВИЛО 13 и риск R-25. Это единственное место в проекте, где одна ошибка
 * бьёт по третьему лицу, а не по нам: утечка номера собственника в публичное
 * объявление — одновременно спам собственнику, потерянный эксклюзив агентства
 * и инцидент с персональными данными.
 *
 * Здесь недостаточно «стараться не допустить», поэтому защита двухслойная:
 *
 *   1. Любая последовательность, которую наш же нормализатор распознаёт как
 *      грузинский номер, вырезается — независимо от того, чей это номер
 *      и как он записан. Собственник мог вписать в текст номер, которого нет
 *      в карточке контакта.
 *   2. Имя собственника вырезается отдельно.
 *
 * Первый слой намеренно опирается на `normalizePhone`, а не на собственный
 * шаблон: так «что считается телефоном» определено в проекте один раз,
 * и уточнение по фикстурам фазы 5 автоматически усилит очистку.
 */

/** Чем заменяется вырезанное. Пустая строка склеила бы соседние слова. */
const REDACTED = ' ';

/**
 * Кандидат в телефоны: начинается с плюса, скобки или цифры, дальше цифры
 * и разделители, заканчивается цифрой. Минимальная длина отсекает цены
 * и площади: «145 000» — шесть цифр, номер — девять.
 */
const PHONE_CANDIDATE = /[+(]?\d[\d\s\-.()]{6,}\d/gu;

export interface SanitizeInput {
  /** Нормализованные телефоны собственника из карточки контакта. */
  ownerPhones?: readonly string[];
  ownerName?: string | null;
}

export interface SanitizeResult {
  text: string;
  /** Что было вырезано. Нужно отчёту агенту, в логи не пишется. */
  removedPhones: number;
  removedName: boolean;
}

/**
 * Убирает из текста телефоны и имя собственника.
 *
 * Возвращает результат, а не бросает: описание с номером внутри — не ошибка
 * агента, а обычное содержимое объявления на площадке.
 */
export function sanitizePublicText(
  input: string | null | undefined,
  options: SanitizeInput = {},
): SanitizeResult {
  if (input === null || input === undefined || input.trim() === '') {
    return { text: '', removedPhones: 0, removedName: false };
  }

  let removedPhones = 0;

  let text = input.replace(PHONE_CANDIDATE, (candidate) => {
    try {
      normalizePhone(candidate);
      removedPhones += 1;
      return REDACTED;
    } catch {
      // Не разобралось как номер — значит это цена, площадь, год или
      // кадастровый номер. Вырезать их было бы порчей объявления.
      return candidate;
    }
  });

  // Второй проход по известным номерам собственника: он ловит записи,
  // разорванные словами («555 12 34 56, звонить после 18»), которые
  // первый шаблон мог разрезать.
  for (const phone of options.ownerPhones ?? []) {
    const digits = phone.replace(/\D/gu, '');
    const national = digits.slice(-9);
    if (national.length < 9) continue;

    const spaced = national.split('').join('[\\s\\-.()]*');
    const pattern = new RegExp(`(?:\\+?995[\\s\\-.()]*)?0?${spaced}`, 'gu');

    text = text.replace(pattern, () => {
      removedPhones += 1;
      return REDACTED;
    });
  }

  let removedName = false;
  const name = options.ownerName?.trim();
  if (name !== undefined && name !== '' && name.length >= 3) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const pattern = new RegExp(escaped, 'giu');
    if (pattern.test(text)) {
      removedName = true;
      text = text.replace(pattern, REDACTED);
    }
  }

  // Схлопывание пробелов и пунктуации, осиротевшей после вырезания.
  text = text
    .replace(/\s+/gu, ' ')
    .replace(/\s+([,.;:!?])/gu, '$1')
    .replace(/([,;:])\s*([,.;:])/gu, '$1')
    .trim();

  return { text, removedPhones, removedName };
}
