/**
 * След последнего сбора ленты.
 *
 * ЗАЧЕМ ОН ЕСТЬ. Сбор идёт молча и мешать агенту не должен: он не просил
 * собирать, он просто смотрел выдачу. Но однажды сервер несколько дней
 * отвергал каждую пачку целиком — в схему приёма забыли добавить одно
 * поле, — и узнать об этом было неоткуда: «лента пустая» и «сбор сломан»
 * выглядели одинаково. Заметил владелец, а не мы.
 *
 * Одна строка в окошке расширения различает эти два случая и ничего
 * при этом не требует от агента.
 *
 * ОТДЕЛЬНЫМ МОДУЛЕМ, а не в `content/feed.ts`: окошко расширения читает
 * ту же запись, а тянуть ради неё в popup весь разбор площадок незачем.
 */

export interface HarvestNote {
  at: number;
  /** Сколько карточек принял сервер. */
  accepted?: number;
  /** Короткая причина отказа. Для агента она не расшифровывается. */
  failed?: string;
}

const KEY = 'lastHarvest';

export async function rememberHarvest(value: HarvestNote): Promise<void> {
  try {
    await chrome.storage.local.set({ [KEY]: value });
  } catch {
    // Хранилище недоступно — мелочь на фоне того, что мы записываем.
  }
}

export async function lastHarvest(): Promise<HarvestNote | null> {
  try {
    const stored = (await chrome.storage.local.get(KEY)) as Record<string, unknown>;
    const value = stored[KEY];

    return typeof value === 'object' && value !== null ? (value as HarvestNote) : null;
  } catch {
    return null;
  }
}
