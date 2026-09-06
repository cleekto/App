/**
 * Слушатель ответов страницы. Работает в MAIN-мире площадки.
 *
 * ЗАЧЕМ ОН НУЖЕН. Агент листает выдачу переходами внутри сайта, а не
 * перезагрузками. При таком переходе блок `__NEXT_DATA__` в разметке
 * остаётся от предыдущей страницы — проверено на сохранённых страницах
 * обеих площадок. Значит, читать только разметку нельзя: собиралось бы
 * вчерашнее.
 *
 * ЧТО ОН ДЕЛАЕТ И ЧЕГО НЕ ДЕЛАЕТ. Он подменяет `fetch` и `XMLHttpRequest`
 * страницы, чтобы ПРОЧИТАТЬ КОПИЮ уже полученного ответа. Он не отправляет
 * ни одного запроса, ничего не запрашивает от своего имени, не листает
 * выдачу за человека и не меняет то, что получает страница: оригинальный
 * ответ уходит в неё нетронутым. Со стороны площадки нагрузка ровно та же,
 * что от обычного посетителя, — и блокировать здесь нечего.
 *
 * ПОЧЕМУ MAIN-МИР. Content script живёт в изолированном мире со своей копией
 * `window`, и подмена `fetch` там не видна странице. Это единственная часть
 * расширения в общем мире со страницей, и поэтому она умеет ровно одно:
 * переслать текст ответа своим. Ни токена, ни адреса сервера здесь нет —
 * всё, что попадает в MAIN-мир, доступно и площадке.
 */

/** Метка сообщений. Проверяется на приёме: в окно пишет кто угодно. */
const CHANNEL = 'kleekto:payload';

/** Ответы больше этого не разбираем: выдача столько не весит. */
const MAX_BYTES = 4_000_000;

/**
 * Что вообще стоит смотреть.
 *
 * Дешёвая отсечка по тексту до разбора JSON: разбирать каждый ответ чужой
 * страницы — это десятки мегабайт в её главном потоке, а тормозящий сайт
 * агент выключит вместе с расширением.
 *
 * Признак ровно один — `user_type`, поле карточки выдачи. Требовать заодно
 * `statements` (ключ кэша списка) было бы ошибкой: он есть только в ответе
 * перехода Next.js, а в ответе собственного API площадки его нет, и вторая
 * половина сбора отсекалась бы молча. Разбор всё равно решает сам: сюда
 * проходит кандидат, а не находка.
 */
function interesting(body: string): boolean {
  return body.length <= MAX_BYTES && body.includes('user_type');
}

function forward(body: string): void {
  try {
    if (!interesting(body)) return;
    window.postMessage({ channel: CHANNEL, body }, window.location.origin);
  } catch {
    /*
     * Что бы здесь ни случилось, страница агента не должна пострадать: он
     * пришёл работать, а не отлаживать нас. Сбор — дело десятое, главный
     * цикл идёт через страницу объявления и без нас.
     */
  }
}

const originalFetch = window.fetch;

window.fetch = async function patchedFetch(
  ...args: Parameters<typeof originalFetch>
): Promise<Response> {
  const response = await originalFetch.apply(this, args);

  /*
   * КОПИЯ, А НЕ ОРИГИНАЛ. Тело ответа читается один раз; прочитай мы его
   * здесь — страница получила бы пустой поток и сломалась. `clone()`
   * существует ровно для этого случая.
   */
  try {
    const type = response.headers.get('content-type') ?? '';
    if (type.includes('json')) {
      void response
        .clone()
        .text()
        .then(forward)
        .catch(() => undefined);
    }
  } catch {
    // См. выше: молчим.
  }

  return response;
};

const originalOpen = XMLHttpRequest.prototype.open;

/*
 * Часть запросов площадки идёт старым способом. Приём тот же: читаем то,
 * что уже пришло, и ничего не меняем.
 *
 * У `open` два объявления — с третьим аргументом и без, — и точно повторить
 * их подменой нельзя. Поэтому лишние аргументы принимаются как есть
 * и передаются дальше нетронутыми: наша задача — не потерять ни одного.
 */
type OpenArgs = [method: string, url: string | URL, ...rest: unknown[]];
const callOpen = originalOpen as unknown as (this: XMLHttpRequest, ...args: OpenArgs) => void;

XMLHttpRequest.prototype.open = function patchedOpen(
  this: XMLHttpRequest,
  ...args: OpenArgs
): void {
  this.addEventListener('load', () => {
    try {
      if (this.responseType === '' || this.responseType === 'text') forward(this.responseText);
    } catch {
      // См. выше.
    }
  });

  callOpen.apply(this, args);
} as typeof XMLHttpRequest.prototype.open;
