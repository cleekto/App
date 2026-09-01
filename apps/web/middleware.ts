import { NextResponse, type NextRequest } from 'next/server';

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

export function middleware(request: NextRequest): NextResponse {
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

  const response = NextResponse.next({ request: { headers } });
  response.headers.set('content-security-policy', csp);
  return response;
}

export const config = {
  /**
   * Статика и картинки заголовка не требуют: у них нет ни скриптов,
   * ни фреймов, а лишний проход через middleware — это задержка на каждый файл.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
