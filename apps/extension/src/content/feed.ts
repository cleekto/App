import { harvestPayload, searchHarvest } from '@kleekto/adapters';
import type { SearchCard, SearchHarvest } from '@kleekto/adapters';

import { rememberHarvest } from '../core/harvest-note';
import type { ContentToWorker, WorkerReply } from '../core/messages';

/**
 * Сбор рабочей ленты со страниц выдачи.
 *
 * ЧТО ЭТО ДАЁТ АГЕНТУ. Он и так листает выдачу — десятки страниц в день,
 * своими руками. Пока он смотрит, объявления собственников оседают в общей
 * ленте агентства, и завтра утром они уже там, отсортированные и без тех,
 * по кому кто-то уже отработал. Ничего дополнительного делать не нужно.
 *
 * ЧТО ЭТО НЕ ДЕЛАЕТ. Не открывает объявления, не листает страницы, не ходит
 * по сайту и не собирает телефоны: их в выдаче нет, а на странице объявления
 * номер берётся только после того, как агент раскрыл его сам (правило 11).
 * Объект отсюда не создаётся никогда — только по «Согласен» (правило 0).
 *
 * ПОЧЕМУ ДВА ИСТОЧНИКА. При обычной загрузке страницы данные лежат в разметке.
 * При переходе внутри сайта разметка остаётся старой, а свежие данные приходят
 * ответом, который страница запросила сама, — их пересылает `listen.ts`
 * из общего мира. Без второго источника собиралась бы предыдущая страница.
 */

/** Метка сообщений из общего мира. Совпадает с `listen.ts`. */
const CHANNEL = 'kleekto:payload';

/** Ответ страницы больше этого не разбираем. */
const MAX_BYTES = 4_000_000;

/**
 * Что уже отправлено с этой вкладки.
 *
 * Одно и то же объявление попадается на каждой второй странице выдачи,
 * и без памяти мы слали бы его по десять раз за сессию. Память живёт
 * ровно до перезагрузки: сервер и так знает, что видел, а нам здесь важно
 * лишь не шуметь.
 */
const sent = new Set<string>();

function fresh(cards: readonly SearchCard[]): SearchCard[] {
  return cards.filter((card) => {
    if (sent.has(card.externalId)) return false;
    sent.add(card.externalId);
    return true;
  });
}

async function deliver(harvest: SearchHarvest): Promise<void> {
  const cards = fresh(harvest.cards);
  if (cards.length === 0) return;

  const message: ContentToWorker = { type: 'observations', source: harvest.source, cards };

  /*
   * АГЕНТУ НЕ ПОКАЗЫВАЕМ НИЧЕГО, НО СЛЕД ОСТАВЛЯЕМ.
   *
   * Сбор — фоновая польза, а не действие агента: он не просил, он просто
   * смотрел выдачу. Уведомление об успехе было бы шумом, а сообщение
   * об ошибке — тревогой на пустом месте: не дошло сейчас, дойдёт
   * в следующий раз, главный цикл от этого не зависит.
   *
   * НО МОЛЧАТЬ СОВСЕМ ОКАЗАЛОСЬ НЕЛЬЗЯ. Схема приёма на сервере несколько
   * дней отвергала каждую пачку целиком — в неё не добавили одно поле, —
   * и узнать об этом было неоткуда: здесь стоял пустой `catch`, а лента
   * по myhome просто оставалась пустой. Владелец заметил раньше нас.
   *
   * Поэтому итог кладётся в хранилище расширения: он не мешает агенту
   * и виден в его окошке. «Собрано 20 минуту назад» и «ни одного за день»
   * — разные картины, и различать их должно быть можно, не разбирая код.
   */
  try {
    const reply = (await chrome.runtime.sendMessage(message)) as WorkerReply;
    const accepted = 'accepted' in reply ? reply.accepted : null;

    await rememberHarvest(
      accepted === null
        ? { at: Date.now(), failed: 'error' in reply ? reply.error : 'unknown' }
        : { at: Date.now(), accepted },
    );
  } catch (error) {
    // Worker спит или расширение обновилось. Тоже след, а не тишина.
    await rememberHarvest({
      at: Date.now(),
      failed: error instanceof Error ? error.name : 'unknown',
    });
  }
}

/** Разбор ответа, пересланного из общего мира. */
function onWindowMessage(event: MessageEvent): void {
  if (event.source !== window || event.origin !== window.location.origin) return;

  const data: unknown = event.data;
  if (typeof data !== 'object' || data === null) return;

  const record = data as Record<string, unknown>;
  if (record['channel'] !== CHANNEL || typeof record['body'] !== 'string') return;
  if (record['body'].length > MAX_BYTES) return;

  let payload: unknown;
  try {
    payload = JSON.parse(record['body']);
  } catch {
    return;
  }

  const harvest = harvestPayload(payload);
  if (harvest !== null) void deliver(harvest);
}

/**
 * Включить сбор на этой вкладке.
 *
 * Вызывается на любой странице площадки, в том числе на странице объявления:
 * решает не адрес, а то, нашлись ли в данных карточки выдачи. Адрес выдачи
 * у площадок меняется вместе с фильтрами, и привязка к нему ломалась бы молча.
 */
export function startFeedCollector(): void {
  window.addEventListener('message', onWindowMessage);

  // Первая страница приходит с сервера — её данные лежат в разметке.
  const initial = searchHarvest(document, location.href);
  if (initial !== null) void deliver(initial);
}
