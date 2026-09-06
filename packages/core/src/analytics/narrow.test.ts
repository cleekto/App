import { Prisma } from '@kleekto/db';
import { describe, expect, it } from 'vitest';

/**
 * Область подставляется в запросы по ИМЕНИ КОЛОНКИ, и на этом участке
 * TypeScript уже не помогает: строка есть строка.
 *
 * Стоило области агента впервые стать «своё», и выяснилось, что «чьё»
 * называется в каждой таблице по-своему. Один общий фрагмент `where`
 * подходил одной таблице из трёх, а в остальных давал запрос
 * по несуществующей колонке — то есть падение целой страницы, и не там,
 * где меняли код.
 *
 * Тест сторожит именно это: имена, на которые опирается `narrowWhere`,
 * обязаны быть настоящими колонками своих таблиц.
 */

/** Где у какой таблицы лежит «чьё». Тот же список, что в аналитике. */
const OWN_COLUMN = {
  ActivityLog: 'userId',
  SourceListing: 'importedByUserId',
  Publication: 'createdByUserId',
} as const;

const COLUMNS: Record<keyof typeof OWN_COLUMN, readonly string[]> = {
  ActivityLog: Object.keys(Prisma.ActivityLogScalarFieldEnum),
  SourceListing: Object.keys(Prisma.SourceListingScalarFieldEnum),
  Publication: Object.keys(Prisma.PublicationScalarFieldEnum),
};

describe('колонки, по которым сужается область', () => {
  it('«чьё» у каждой таблицы — настоящая колонка', () => {
    for (const [model, column] of Object.entries(OWN_COLUMN)) {
      expect(COLUMNS[model as keyof typeof OWN_COLUMN], `${model}.${column}`).toContain(column);
    }
  });

  it('«командное» есть у каждой из них', () => {
    for (const model of Object.keys(OWN_COLUMN) as Array<keyof typeof OWN_COLUMN>) {
      expect(COLUMNS[model], model).toContain('teamId');
    }
  });

  it('у состояния обзвона колонки «чьё» нет вовсе — поэтому область там команда', () => {
    /*
     * Не придирка к именам, а причина решения: состояние обзвона привязано
     * к паре «объявление × команда», и «моего» состояния не существует.
     * Список перезвонов поэтому командный даже у того, кто видит только свои
     * объекты, — см. `listFollowUps`.
     */
    const columns = Object.keys(Prisma.ObservationStateScalarFieldEnum);

    expect(columns).toContain('teamId');
    expect(columns).not.toContain('userId');
  });
});
