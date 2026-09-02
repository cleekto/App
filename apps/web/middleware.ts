import { NextResponse, type NextRequest } from 'next/server';

import { ACCESS_COOKIE, REFRESH_COOKIE } from './app/api/_lib/cookie-names';
import {
  clearSessionCookies,
  setSessionCookies,
  type SessionTokens,
} from './app/api/_lib/session-cookies';
import { withCookie } from './app/_lib/cookie-header';

/**
 * Content-Security-Policy с одноразовым числом.
 *
 * ПОЧЕМУ НЕ В `next.config`. Статический заголовок пришлось бы разрешать
 * `'unsafe-inline'` для скриптов: Next вставляет inline-скрипты гидратации
 * в каждую страницу. А CSP, разрешающая произвольный inline-скрипт, защищает
 * ровно от того, чего и так не бывает, — то есть является украшением.
 *
 * Здесь на каждый запрос выдаётся своё число. Next находит его в заголовке
 * запроса и проставляет своим скриптам сам; чужой inline-скрипт, попавший
 * на страницу через уязвимость, числа не знает и не выполнится.
 *
 * `'strict-dynamic'` нужен потому, что скрипты Next подгружают другие скрипты:
 * без него пришлось бы перечислять каждый чанк по имени, а имена меняются
 * при каждой сборке.
 */

/**
 * Тихое обновление сессии.
 *
 * ПОЧЕМУ ПО ОТСУТСТВИЮ КУКИ, А НЕ ПО ПРОВЕРКЕ ТОКЕНА. Access-cookie живёт
 * ровно `expiresIn` секунд (session-cookies.ts) — то же время, что и подпись
 * токена внутри. Браузер стирает её сам день истечения, до JS дело
 * не доходит. Поэтому её отсутствие при наличии refresh-cookie — дешёвый
 * и достаточный признак «токен истёк по времени»; проверять подпись здесь
 * незачем, а страница и так проверит её заново (`requireContext`).
 *
 * ПОЧЕМУ ЧЕРЕЗ HTTP, А НЕ ЧЕРЕЗ `@kleekto/core` НАПРЯМУЮ. `refreshSession`
 * тянет за собой Prisma, а Prisma не работает в Edge-окружении middleware.
 * Внутренний запрос к уже существующему `/api/v1/auth/refresh` держит
 * доменную логику в обработчике маршрута (ADR-0001) — переводить middleware
 * на Node-рантайм ради одного вызова не требуется.
 *
 * Собственные `/api/v1/auth/*` не трогаются: иначе обновление сессии внутри
 * же обработчика `/auth/refresh` дёргало бы `/auth/refresh` ещё раз.
 */
async function refreshSessionCookie(
  request: NextRequest,
): Promise<SessionTokens | 'invalid' | null> {
  if (request.cookies.has(ACCESS_COOKIE)) return null;

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken === undefined) return null;

  if (request.nextUrl.pathname.startsWith('/api/v1/auth/')) return null;

  try {
    const response = await fetch(new URL('/api/v1/auth/refresh', request.nextUrl.origin), {
      method: 'POST',
      headers: { cookie: request.headers.get('cookie') ?? '' },
    });

    if (!response.ok) return 'invalid';
    return (await response.json()) as SessionTokens;
  } catch {
    // Сеть моргнула или ответ не разобрать — не время разлогинивать: просто
    // не чиним сессию сейчас, а requireContext() поведёт себя, как и раньше.
    return null;
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const nonce = crypto.randomUUID();

  const csp = [
    "default-src 'self'",
    // `unsafe-eval` — только в разработке: горячая перезагрузка Next без него
    // не работает. В бою его нет, и это важнее удобства.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${
      process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''
    }`,
    // Стили Next вставляет inline и числа им не проставляет. Инъекция стиля
    // опаснее нуля, но несоизмеримо безопаснее инъекции скрипта.
    "style-src 'self' 'unsafe-inline'",
    // Фотографии объектов лежат на CDN площадок: в MVP хранятся URL,
    // а не файлы (вопрос 11).
    "img-src 'self' data: https:",
    // В разработке сюда же ходит веб-сокет горячей перезагрузки.
    `connect-src 'self'${process.env.NODE_ENV === 'development' ? ' ws:' : ''}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // CRM с контактами собственников не должна открываться во фрейме
    // на чужом сайте: клик по невидимой кнопке там дороже, чем где-либо.
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');

  // Заголовок ставится и на запрос, и на ответ: из запроса число берёт Next,
  // из ответа — браузер.
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', csp);

  const refreshed = await refreshSessionCookie(request);

  if (refreshed !== null && refreshed !== 'invalid') {
    // Страница внутри ЭТОГО ЖЕ запроса должна увидеть уже новый токен —
    // иначе `requireContext()` успеет отправить агента на страницу входа
    // раньше, чем браузер получит новый `Set-Cookie` и повторит запрос сам.
    headers.set(
      'cookie',
      withCookie(request.headers.get('cookie'), ACCESS_COOKIE, refreshed.accessToken),
    );
  }

  const response = NextResponse.next({ request: { headers } });
  response.headers.set('content-security-policy', csp);

  if (refreshed !== null && refreshed !== 'invalid') {
    setSessionCookies(response, refreshed);
  } else if (refreshed === 'invalid') {
    // Refresh-токен явно отвергнут (истёк, отозван, кража) — не держим
    // заведомо мёртвую куку: без этого каждый следующий запрос агента
    // безрезультатно повторял бы этот же внутренний вызов.
    clearSessionCookies(response);
  }

  return response;
}

export const config = {
  /**
   * Статика и картинки заголовка не требуют: у них нет ни скриптов,
   * ни фреймов, а лишний проход через middleware — это задержка на каждый файл.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
