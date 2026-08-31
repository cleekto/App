import { describe, expect, it } from 'vitest';

import { ERROR_CODES, HTTP_STATUS_BY_ERROR, errorEnvelope, errorEnvelopeSchema } from './errors';

describe('модель ошибок', () => {
  it('у каждого кода есть HTTP-статус', () => {
    for (const code of ERROR_CODES) {
      expect(HTTP_STATUS_BY_ERROR[code]).toBeGreaterThanOrEqual(400);
    }
  });

  // Изоляция арендаторов (правило 5, риск R-04): чужая компания обязана
  // выглядеть как отсутствующий ресурс. Если кто-то поменяет 404 на 403,
  // тест упадёт и заставит прочитать обоснование в api-contracts.md.
  it('чужая компания неотличима от отсутствующего ресурса', () => {
    expect(HTTP_STATUS_BY_ERROR.NOT_FOUND).toBe(404);
    expect(HTTP_STATUS_BY_ERROR.FORBIDDEN).toBe(403);
    expect(HTTP_STATUS_BY_ERROR.NOT_FOUND).not.toBe(HTTP_STATUS_BY_ERROR.FORBIDDEN);
  });

  it('конверт ошибки соответствует схеме', () => {
    const envelope = errorEnvelope('VALIDATION_ERROR', 'Поле area должно быть числом', {
      requestId: 'req_1',
      details: { fields: ['area'] },
    });

    expect(() => errorEnvelopeSchema.parse(envelope)).not.toThrow();
    expect(envelope.error.code).toBe('VALIDATION_ERROR');
  });

  it('необязательные поля не появляются как undefined', () => {
    const envelope = errorEnvelope('INTERNAL', 'Что-то пошло не так');

    expect(Object.hasOwn(envelope.error, 'requestId')).toBe(false);
    expect(Object.hasOwn(envelope.error, 'details')).toBe(false);
  });
});
