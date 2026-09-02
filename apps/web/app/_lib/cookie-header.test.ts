import { describe, expect, it } from 'vitest';

import { withCookie } from './cookie-header';

describe('withCookie', () => {
  it('добавляет куку в пустой заголовок', () => {
    expect(withCookie(null, 'a', '1')).toBe('a=1');
  });

  it('добавляет куку, которой ещё не было, сохраняя остальные', () => {
    expect(withCookie('x=1; y=2', 'z', '3')).toBe('x=1; y=2; z=3');
  });

  it('заменяет значение существующей куки, не трогая соседние', () => {
    expect(withCookie('cleekto_access=old; cleekto_refresh=r', 'cleekto_access', 'new')).toBe(
      'cleekto_refresh=r; cleekto_access=new',
    );
  });

  it('не путает куку с именем-префиксом другой', () => {
    // Раньше `startsWith` совпал бы с `cleekto_access_extra` и стёр её.
    expect(withCookie('cleekto_access_extra=keep', 'cleekto_access', 'new')).toBe(
      'cleekto_access_extra=keep; cleekto_access=new',
    );
  });

  it('терпит лишние пробелы и пустые пары в исходном заголовке', () => {
    expect(withCookie(' a=1 ;  ; b=2', 'c', '3')).toBe('a=1; b=2; c=3');
  });
});
