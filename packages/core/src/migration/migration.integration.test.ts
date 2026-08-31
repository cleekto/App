import { MigrationBatchStatus, PropertyOrigin, prisma } from '@cleekto/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthContext } from '../auth/context';
import { ForbiddenError, NotFoundError } from '../errors';
import { importListing } from '../import/use-cases';
import { seed } from '../seed/seed';
import { SKIP, type ColumnMapping } from './mapping';
import {
  applyMigration,
  previewMigration,
  rollbackMigration,
  setMigrationMapping,
  uploadMigrationFile,
} from './use-cases';

/**
 * ГЕЙТ ФАЗЫ 4В. Реальный файл агентства превращается в базу объектов
 * БЕЗ ручного приведения к шаблону (DoD §3.Ф4В).
 *
 * Без переноса старой базы не будет пилота, а значит и проверять продукт
 * будет не на ком — поэтому фаза стоит здесь, а не «когда-нибудь».
 */

let admin: AuthContext;
let agent: AuthContext;
let foreignAdmin: AuthContext;
let teamId: string;
let foreignTeamId: string;

async function contextFor(email: string): Promise<AuthContext> {
  const user = await prisma.user.findFirstOrThrow({
    where: { email },
    include: { role: true, teamMemberships: true },
  });
  return {
    userId: user.id,
    companyId: user.companyId,
    teamId: user.teamMemberships[0]?.teamId ?? null,
    role: user.role.code,
    locale: user.locale,
  };
}

const csv = (text: string): Buffer => Buffer.from(text, 'utf8');

let fileSeq = 100;

/**
 * Файл, похожий на настоящий: три языка, точка с запятой, лари и доллары.
 *
 * Телефоны у каждого вызова свои. Иначе второй заход упрётся в проверку
 * `duplicate_in_base` — и это правильное поведение продукта: массовая
 * операция не должна создавать то, что поштучный импорт заблокировал бы.
 */
function realLookingFile(): string {
  fileSeq += 1;

  // Национальный номер Грузии — девять цифр. Три строки, три разных номера,
  // и все три записаны по-разному: так их и пишут в настоящих выгрузках.
  const tail = (row: number): string => String(100_000 + fileSeq * 10 + row);

  return [
    'Адрес;ფართობი;Комн.;Цена;тел;Owner;Внутренний код',
    `Чавчавадзе 30;78;3;145 000 $;+995 555 ${tail(1).slice(0, 3)} ${tail(1).slice(3)};Гиорги;A-1`,
    `Сабуртало, ул. Вашлованская 12;64,5;2;1 450 000 ₾;0555 ${tail(2).slice(0, 3)} ${tail(2).slice(3)};Нино;A-2`,
    `Ваке, Абашидзе 7;42;1;89000 USD;555${tail(3)};Леван;A-3`,
  ].join('\n');
}

async function uploadAndMap(
  ctx: AuthContext,
  file: Buffer,
  fileName: string,
  overrideMapping?: ColumnMapping,
): Promise<string> {
  const uploaded = await uploadMigrationFile(ctx, { buffer: file, fileName, teamId });
  await setMigrationMapping(ctx, uploaded.batchId, {
    mapping: overrideMapping ?? uploaded.suggestedMapping,
  });
  return uploaded.batchId;
}

beforeAll(async () => {
  await seed();
  admin = await contextFor('admin@tbilisi-estate.test');
  agent = await contextFor('agent1@tbilisi-estate.test');
  foreignAdmin = await contextFor('admin@batumi-property.test');

  const team = await prisma.team.findFirstOrThrow({
    where: { companyId: admin.companyId, name: 'Vake' },
  });
  teamId = team.id;

  const foreignTeam = await prisma.team.findFirstOrThrow({
    where: { companyId: foreignAdmin.companyId },
  });
  foreignTeamId = foreignTeam.id;
}, 60_000);

afterAll(async () => {
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────────────────────────
// Файл как есть
// ─────────────────────────────────────────────────────────────────────────────

describe('файл агентства принимается без приведения к шаблону', () => {
  it('колонки на трёх языках распознаются, импорт проходит', async () => {
    const uploaded = await uploadMigrationFile(admin, {
      buffer: csv(realLookingFile()),
      fileName: 'база агентства.csv',
      teamId,
    });

    expect(uploaded.totalRows).toBe(3);
    expect(uploaded.suggestedMapping['ფართობი']).toBe('area');
    expect(uploaded.suggestedMapping['тел']).toBe('ownerPhone');
    expect(uploaded.suggestedMapping['Owner']).toBe('ownerName');
    // Неузнанная колонка помечена пропуском, а не выброшена молча.
    expect(uploaded.suggestedMapping['Внутренний код']).toBe(SKIP);

    await setMigrationMapping(admin, uploaded.batchId, {
      mapping: uploaded.suggestedMapping,
    });

    const result = await applyMigration(admin, uploaded.batchId);
    expect(result.acceptedRows).toBe(3);
    expect(result.rejectedRows).toBe(0);
  });

  it('лари и доллары в одной колонке разбираются каждый по-своему', async () => {
    // Прямая цитата из §6Г.2 — так выглядят настоящие файлы.
    const batchId = await uploadAndMap(admin, csv(realLookingFile()), 'валюты.csv');
    await applyMigration(admin, batchId);

    const properties = await prisma.property.findMany({
      where: { migrationBatchId: batchId },
      select: { price: true, currency: true, areaTotal: true },
      orderBy: { createdAt: 'asc' },
    });

    const currencies = properties.map((property) => property.currency?.trim());
    expect(currencies).toContain('USD');
    expect(currencies).toContain('GEL');

    // Дробная площадь «64,5» с запятой как разделителем.
    const areas = properties.map((property) => Number(property.areaTotal));
    expect(areas).toContain(64.5);
  });

  it('телефоны в разных форматах приводятся к одному виду', async () => {
    const batchId = await uploadAndMap(admin, csv(realLookingFile()), 'телефоны.csv');
    await applyMigration(admin, batchId);

    const phones = await prisma.ownerContactPhone.findMany({
      where: {
        ownerContact: { properties: { some: { migrationBatchId: batchId } } },
      },
      select: { phoneNormalized: true, phoneOriginal: true },
    });

    expect(phones).toHaveLength(3);
    // Нормализация переиспользует логику импорта, а не дублирует её (L6).
    for (const phone of phones) {
      expect(phone.phoneNormalized).toMatch(/^\+995\d{9}$/u);
      expect(phone.phoneOriginal).not.toBe(phone.phoneNormalized);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Предпросмотр до записи
// ─────────────────────────────────────────────────────────────────────────────

describe('предпросмотр показывает всё до записи', () => {
  it('до предпросмотра в базе ничего не появляется', async () => {
    const before = await prisma.property.count({ where: { companyId: admin.companyId } });

    const batchId = await uploadAndMap(admin, csv(realLookingFile()), 'предпросмотр.csv');
    const preview = await previewMigration(admin, batchId);

    expect(preview.written).toBe(false);
    expect(await prisma.property.count({ where: { companyId: admin.companyId } })).toBe(before);
    expect(preview.acceptedRows).toBe(3);
  });

  it('дубли внутри файла показаны до записи и объектов не создают', async () => {
    // Самый частый дефект реальной выгрузки: одна квартира внесена дважды
    // разными сотрудниками за разные годы.
    const withDuplicates = [
      'Адрес;Площадь;Комнаты;Цена;Телефон',
      'Чавчавадзе 30;78;3;145000 $;+995 555 11 11 11',
      'Чавчавадзе 30;78;3;150000 $;555111111',
      'Абашидзе 7;42;1;89000 $;+995 555 22 22 22',
    ].join('\n');

    const batchId = await uploadAndMap(admin, csv(withDuplicates), 'дубли.csv');
    const preview = await previewMigration(admin, batchId);

    expect(preview.duplicatesInsideFile).toHaveLength(1);
    expect(preview.duplicatesInsideFile[0]?.rowNumbers).toEqual([2, 3]);
    expect(preview.acceptedRows).toBe(2);

    const result = await applyMigration(admin, batchId);
    expect(result.acceptedRows).toBe(2);
    expect(result.rejections.some((item) => item.code === 'duplicate_in_file')).toBe(true);
  });

  it('две квартиры одного собственника дублями не считаются', async () => {
    // Тот же телефон, но разные площадь и комнатность — это норма,
    // а не дубль. Различаем так же, как уровень 3 дедупликации.
    const sameOwner = [
      'Адрес;Площадь;Комнаты;Цена;Телефон',
      'Чавчавадзе 30;78;3;145000 $;+995 555 33 33 33',
      'Абашидзе 7;42;1;89000 $;+995 555 33 33 33',
    ].join('\n');

    const batchId = await uploadAndMap(admin, csv(sameOwner), 'один собственник.csv');
    const preview = await previewMigration(admin, batchId);

    expect(preview.duplicatesInsideFile).toHaveLength(0);
    expect(preview.acceptedRows).toBe(2);
  });

  it('отклонения объяснены человеческим языком, а не кодом', async () => {
    const messy = [
      'Адрес;Площадь;Телефон',
      'Чавчавадзе 30;78;+995 555 44 44 44',
      'Абашидзе 7;42;',
      'Ваке 1;55;не телефон',
      ';;+995 555 55 55 55',
    ].join('\n');

    const batchId = await uploadAndMap(admin, csv(messy), 'мусор.csv');
    const preview = await previewMigration(admin, batchId);

    const codes = preview.rejections.map((item) => item.code);
    expect(codes).toContain('no_phone');
    expect(codes).toContain('invalid_phone');
    expect(codes).toContain('no_identifying_data');

    for (const rejection of preview.rejections) {
      expect(rejection.reasonHuman.length).toBeGreaterThan(5);
      expect(rejection.rows.length).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Происхождение и отмена
// ─────────────────────────────────────────────────────────────────────────────

describe('перенесённые объекты помечены и отделимы', () => {
  it('все объекты получают origin = legacy_import', async () => {
    const batchId = await uploadAndMap(admin, csv(realLookingFile()), 'происхождение.csv');
    await applyMigration(admin, batchId);

    const properties = await prisma.property.findMany({
      where: { migrationBatchId: batchId },
      select: { origin: true, migrationBatchId: true },
    });

    expect(properties).toHaveLength(3);
    for (const property of properties) {
      // Объект из архива не притворяется тем, по которому был разговор
      // с собственником (L13, правило R14).
      expect(property.origin).toBe(PropertyOrigin.legacy_import);
      expect(property.migrationBatchId).toBe(batchId);
    }
  });

  it('архив отделим от рабочей базы одним фильтром', async () => {
    // Файл агентства приносит объекты сомнительной свежести: старые цены,
    // снятые квартиры, устаревшие телефоны (риск R-34). База выглядит полной,
    // а работать по ней нельзя — поэтому фильтр обязателен.
    const batchId = await uploadAndMap(admin, csv(realLookingFile()), 'архив.csv');
    await applyMigration(admin, batchId);

    // Рабочий объект — обычным путём, через согласие собственника.
    await importListing(agent, {
      source: 'SS_GE',
      sourceUrl: 'https://ss.ge/ru/listing/archive-check',
      externalId: 'ss-archive-check',
      propertyType: 'APARTMENT',
      transactionType: 'SALE',
      area: 100,
      rooms: 4,
      owner: { name: 'Собственник', phone: '+995 555 90 90 90' },
      parserVersion: 'ss.ge@1.0.0',
      outcome: 'consent',
    });

    const archive = await prisma.property.count({
      where: { companyId: admin.companyId, origin: PropertyOrigin.legacy_import },
    });
    const working = await prisma.property.count({
      where: { companyId: admin.companyId, origin: PropertyOrigin.consent },
    });

    expect(archive).toBeGreaterThan(0);
    expect(working).toBeGreaterThan(0);
    // Один фильтр разделяет их полностью — база не выглядит однородной.
    expect(archive + working).toBe(
      await prisma.property.count({ where: { companyId: admin.companyId } }),
    );
  });
});

describe('отмена импорта целиком', () => {
  it('база возвращается в состояние до импорта', async () => {
    const before = await prisma.property.count({ where: { companyId: admin.companyId } });
    const contactsBefore = await prisma.ownerContact.count({
      where: { companyId: admin.companyId },
    });

    const batchId = await uploadAndMap(admin, csv(realLookingFile()), 'откат.csv');
    const applied = await applyMigration(admin, batchId);
    expect(applied.acceptedRows).toBe(3);

    expect(await prisma.property.count({ where: { companyId: admin.companyId } })).toBe(before + 3);

    const rolled = await rollbackMigration(admin, batchId);
    expect(rolled.removedProperties).toBe(3);

    // Ни объектов, ни осиротевших контактов с телефонами (Q26).
    expect(await prisma.property.count({ where: { companyId: admin.companyId } })).toBe(before);
    expect(await prisma.ownerContact.count({ where: { companyId: admin.companyId } })).toBe(
      contactsBefore,
    );

    const batch = await prisma.migrationBatch.findUniqueOrThrow({ where: { id: batchId } });
    expect(batch.status).toBe(MigrationBatchStatus.rolled_back);
  });

  it('повторная отмена — конфликт, а не тихое ничего', async () => {
    const batchId = await uploadAndMap(admin, csv(realLookingFile()), 'двойной откат.csv');
    await applyMigration(admin, batchId);
    await rollbackMigration(admin, batchId);

    await expect(rollbackMigration(admin, batchId)).rejects.toThrow();
  });

  it('отмена не трогает объекты, пришедшие не из этого файла', async () => {
    const firstBatch = await uploadAndMap(admin, csv(realLookingFile()), 'первый.csv');
    await applyMigration(admin, firstBatch);

    const other = ['Адрес;Площадь;Телефон', 'Другая улица 5;90;+995 555 77 77 77'].join('\n');
    const secondBatch = await uploadAndMap(admin, csv(other), 'второй.csv');
    await applyMigration(admin, secondBatch);

    await rollbackMigration(admin, firstBatch);

    const survived = await prisma.property.count({ where: { migrationBatchId: secondBatch } });
    expect(survived).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Права и изоляция
// ─────────────────────────────────────────────────────────────────────────────

describe('права и границы компании', () => {
  it('агент не может загрузить файл миграции', async () => {
    // Операция вносит сотни объектов разом и умеет откатываться целиком —
    // это не то, что делает агент.
    await expect(
      uploadMigrationFile(agent, {
        buffer: csv(realLookingFile()),
        fileName: 'самоволка.csv',
        teamId,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('нельзя залить архив в команду другой компании', async () => {
    await expect(
      uploadMigrationFile(admin, {
        buffer: csv(realLookingFile()),
        fileName: 'чужая команда.csv',
        teamId: foreignTeamId,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('чужой заход миграции недоступен', async () => {
    const foreignBatch = await uploadMigrationFile(foreignAdmin, {
      buffer: csv(realLookingFile()),
      fileName: 'батуми.csv',
      teamId: foreignTeamId,
    });

    await expect(previewMigration(admin, foreignBatch.batchId)).rejects.toThrow(NotFoundError);
    await expect(applyMigration(admin, foreignBatch.batchId)).rejects.toThrow(NotFoundError);
    await expect(rollbackMigration(admin, foreignBatch.batchId)).rejects.toThrow(NotFoundError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Схема сопоставления
// ─────────────────────────────────────────────────────────────────────────────

describe('сохранённое сопоставление', () => {
  it('схема сохраняется на компанию и переиспользуется', async () => {
    // Второй файл того же агентства должен ложиться на готовое сопоставление:
    // заставлять сопоставлять заново каждый раз — верный способ, чтобы
    // агентство бросило миграцию на середине.
    const uploaded = await uploadMigrationFile(admin, {
      buffer: csv(realLookingFile()),
      fileName: 'схема.csv',
      teamId,
    });

    await setMigrationMapping(admin, uploaded.batchId, {
      mapping: uploaded.suggestedMapping,
      saveAsSchemaName: 'Выгрузка из 1С',
    });

    const schema = await prisma.columnMappingSchema.findFirstOrThrow({
      where: { companyId: admin.companyId, name: 'Выгрузка из 1С' },
    });

    expect(schema.mapping).toMatchObject({ тел: 'ownerPhone' });
  });

  it('схема другой компании не видна', async () => {
    const schemas = await prisma.columnMappingSchema.findMany({
      where: { companyId: foreignAdmin.companyId },
    });
    const names = schemas.map((schema) => schema.name);
    expect(names).not.toContain('Выгрузка из 1С');
  });
});
