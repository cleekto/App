import { Prisma } from '@kleekto/db';
import { describe, expect, it } from 'vitest';

import { FACT_FIELDS } from './use-cases';

/**
 * Факты копируются в запрос циклом по именам, и на этом участке TypeScript
 * уже не помогает: имя проверено против интерфейса, а не против колонок
 * базы. Разойдутся они молча — правка перестанет доезжать, и увидит это
 * только тот, кто её сделал.
 */
describe('список редактируемых фактов', () => {
  it('каждое имя — настоящая колонка объекта', () => {
    const columns = new Set(Object.keys(Prisma.PropertyScalarFieldEnum));

    for (const field of FACT_FIELDS) {
      expect(columns.has(field), field).toBe(true);
    }
  });

  it('без повторов: дважды скопированное поле — признак слияния впопыхах', () => {
    expect(new Set(FACT_FIELDS).size).toBe(FACT_FIELDS.length);
  });
});
