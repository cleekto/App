import { z } from 'zod';

import { RATE_LIMITS, consumeRateLimit, login } from '@cleekto/core';

import { clientAddress } from '../../../_lib/client-address';
import { handle, parseBody } from '../../../_lib/handler';
import { setSessionCookies } from '../../../_lib/session-cookies';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  /** Нужен, только если адрес заведён в нескольких компаниях. */
  companyId: z.string().uuid().optional(),
});

/**
 * Вход.
 *
 * Токены и возвращаются телом, и кладутся в `httpOnly` cookie: телом их берёт
 * расширение (cookie нашего домена ему на чужой странице недоступны), cookie
 * использует веб (токен в JS вынесла бы первая же XSS). Один маршрут на двоих
 * лучше двух: иначе правила выпуска токенов пришлось бы держать в двух местах.
 *
 * ЕДИНСТВЕННЫЙ маршрут, где `companyId` приходит телом. Сессии ещё нет,
 * взять его больше неоткуда, и на проверку пароля он не влияет: пароль
 * сверяется в любом случае, а поле лишь выбирает компанию, когда один
 * и тот же адрес заведён в нескольких.
 *
 * ОГРАНИЧЕНИЕ ЧАСТОТЫ считается по двум ключам сразу. По адресу — чтобы
 * перебор с одной машины упёрся. По адресу почты — потому что заголовок
 * с IP подделывается, а вот отказаться от адреса почты, продолжая
 * подбирать пароль к этому аккаунту, нельзя.
 */
export async function POST(request: Request) {
  return handle(
    async () => {
      const body = await parseBody(request, schema);

      await consumeRateLimit(RATE_LIMITS.login, clientAddress(request));
      await consumeRateLimit(RATE_LIMITS.login, body.email.toLowerCase());

      return login(body);
    },
    { onResponse: (response, result) => setSessionCookies(response, result) },
  );
}
