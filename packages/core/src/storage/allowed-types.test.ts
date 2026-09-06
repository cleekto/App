import { describe, expect, it } from 'vitest';

import { allowedTypes } from './use-cases';

/**
 * Список закрыт намеренно, и шире он становится только решением, а не
 * побочным эффектом слова «файл» в задании.
 */
describe('что принимает хранилище', () => {
  it('SVG не принимается нигде: это документ со скриптами, а не картинка', () => {
    for (const kind of ['avatar', 'property', 'chat'] as const) {
      expect(allowedTypes(kind), kind).not.toContain('image/svg+xml');
    }
  });

  it('PDF принимается только вложением к сообщению', () => {
    expect(allowedTypes('chat')).toContain('application/pdf');
    expect(allowedTypes('avatar')).not.toContain('application/pdf');
    expect(allowedTypes('property')).not.toContain('application/pdf');
  });

  it('обычные картинки принимаются везде', () => {
    for (const kind of ['avatar', 'property', 'chat'] as const) {
      expect(allowedTypes(kind), kind).toContain('image/jpeg');
      expect(allowedTypes(kind), kind).toContain('image/png');
    }
  });
});
