import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { middleware } from './middleware';

const ACCESS_COOKIE = 'kleekto_access';
const REFRESH_COOKIE = 'kleekto_refresh';

function request(cookie: string, pathname = '/properties'): NextRequest {
  return new NextRequest(`http://localhost:3000${pathname}`, { headers: { cookie } });
}

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Гейт задачи: агент должен оставаться в системе без разговора с ней после
 * истечения access-токена, а не переоткрывать вход каждые 15 минут
 * (docs/launch-checklist.md, «сессия обрывается»).
 */
describe('middleware — тихое обновление сессии', () => {
  it('не трогает сеть, пока access-cookie ещё жива', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await middleware(request(`${ACCESS_COOKIE}=live; ${REFRESH_COOKIE}=r1`));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('без refresh-cookie сеть тоже не трогает', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await middleware(request(''));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('access-cookie истекла — вызывает /api/v1/auth/refresh с тем же заголовком куки', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ accessToken: 'new-a', refreshToken: 'new-r', expiresIn: 900 }),
      );
    vi.stubGlobal('fetch', fetchSpy);

    await middleware(request(`${REFRESH_COOKIE}=r1`));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe('http://localhost:3000/api/v1/auth/refresh');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).cookie).toBe(`${REFRESH_COOKIE}=r1`);
  });

  it('успешное обновление ставит новые куки И пробрасывает access-токен дальше по этому же запросу', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ accessToken: 'new-a', refreshToken: 'new-r', expiresIn: 900 }),
        ),
    );

    const response = await middleware(request(`${REFRESH_COOKIE}=r1`));

    expect(response.cookies.get(ACCESS_COOKIE)?.value).toBe('new-a');
    expect(response.cookies.get(REFRESH_COOKIE)?.value).toBe('new-r');

    // Без этого страница внутри ТОГО ЖЕ запроса ещё не видит новый токен
    // и `requireContext()` успевает отправить агента на страницу входа.
    const overridden = response.headers.get('x-middleware-request-cookie');
    expect(overridden).toContain(`${ACCESS_COOKIE}=new-a`);
  });

  it('явный отказ (401) чистит куки, а не оставляет мёртвый refresh-токен', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, { status: 401 })));

    const response = await middleware(request(`${REFRESH_COOKIE}=r1`));

    expect(response.cookies.get(ACCESS_COOKIE)?.value).toBe('');
    expect(response.cookies.get(REFRESH_COOKIE)?.value).toBe('');
  });

  it('сбой сети не разлогинивает — просто не чинит сессию сейчас', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('сеть моргнула')));

    const response = await middleware(request(`${REFRESH_COOKIE}=r1`));

    expect(response.cookies.get(ACCESS_COOKIE)).toBeUndefined();
    expect(response.cookies.get(REFRESH_COOKIE)).toBeUndefined();
  });

  it('маршруты /api/v1/auth/* не обновляют сессию сами через себя', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await middleware(request(`${REFRESH_COOKIE}=r1`, '/api/v1/auth/me'));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('CSP по-прежнему выставляется независимо от обновления сессии', async () => {
    vi.stubGlobal('fetch', vi.fn());

    const response = await middleware(request(`${ACCESS_COOKIE}=live`));

    expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
  });
});
