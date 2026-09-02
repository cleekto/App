import { MigrationBatchStatus, PropertyOrigin, type Prisma, prisma } from '@kleekto/db';

import { ACTIVITY, ENTITY } from '../activity/actions';
import { writeActivity } from '../activity/write';
import type { AuthContext } from '../auth/context';
import { analyze } from '../dedup/engine';
import { ConflictError, NotFoundError, ValidationError } from '../errors';
import { normalizeAddress } from '../normalize';
import { normalizePhone } from '../phone';
import { requirePermission } from '../rbac/guard';
import {
  applyMapping,
  parseDecimal,
  parseInteger,
  parseMoney,
  parsePropertyType,
  parseTransactionType,
  suggestMapping,
  type ColumnMapping,
  type MappedRow,
} from './mapping';
import { parseAgencyFile } from './parse';

/**
 * Миграция базы агентства из файла-таблицы (§6Г).
 *
 * Зачем это стоит в фазе 4В, а не «когда-нибудь»: ни одно агентство
 * не перейдёт в систему, оставив накопленную за годы базу в старом файле.
 * Это возражение номер один при продаже, и без ответа на него пилота не будет.
 *
 * ПРАВА: операция уровня компании, а не команды. Она вносит сотни объектов
 * разом и умеет откатываться целиком — это не то, что делает агент.
 */

const PREVIEW_ROWS = 20;

/** Почему строка не станет объектом. Формулировки — для человека. */
export const REJECTION = {
  no_phone: 'Нет телефона собственника',
  invalid_phone: 'Телефон не разобрался',
  no_identifying_data: 'Нет ни адреса, ни площади, ни комнат',
  duplicate_in_file: 'Дубль внутри файла',
  duplicate_in_base: 'Такой объект уже есть в базе команды',
} as const;

export type RejectionCode = keyof typeof REJECTION;

export interface RowIssue {
  rowNumber: number;
  code: RejectionCode;
  /** Номера строк, с которыми строка совпала. Только для дублей. */
  conflictsWith?: number[];
}

// ── Шаг 1: загрузка ──────────────────────────────────────────────────────────

export interface UploadResult {
  batchId: string;
  fileName: string;
  sheetName: string;
  columns: string[];
  totalRows: number;
  /** Предложение, а не решение: последнее слово за человеком. */
  suggestedMapping: ColumnMapping;
}

/**
 * Загрузка файла как есть, без приведения к шаблону.
 *
 * От структуры файла здесь ничего не требуется. Импортёр с фиксированным
 * набором колонок отработал бы на малой доле реальных выгрузок (§6Г.2).
 */
export async function uploadMigrationFile(
  ctx: AuthContext,
  input: {
    buffer: Buffer;
    fileName: string;
    /**
     * Команда-получатель архива. Указывается явно, а не берётся из контекста:
     * миграцию делает администратор, а он может не состоять ни в одной
     * команде. Владение объектом при этом всегда командное (Q33).
     */
    teamId: string;
    sheetName?: string | undefined;
  },
): Promise<UploadResult> {
  requirePermission(ctx, 'pipelineStatus', 'manage');

  const team = await prisma.team.findFirst({
    // Команда обязана быть из своей компании: иначе через teamId
    // можно было бы залить архив в чужую.
    where: { id: input.teamId, companyId: ctx.companyId },
    select: { id: true },
  });
  if (team === null) {
    throw new NotFoundError('Команда не найдена');
  }

  const parsed = await parseAgencyFile(input.buffer, input.fileName);

  const sheet =
    input.sheetName === undefined
      ? parsed.sheets[0]
      : parsed.sheets.find((candidate) => candidate.name === input.sheetName);

  if (sheet === undefined) {
    throw new ValidationError('Лист не найден', { fields: ['sheetName'] });
  }

  const batch = await prisma.migrationBatch.create({
    data: {
      companyId: ctx.companyId,
      teamId: team.id,
      fileName: input.fileName,
      detectedColumns: sheet.columns,
      rawRows: sheet.rows as unknown as Prisma.InputJsonValue,
      totalRows: sheet.rows.length,
      createdByUserId: ctx.userId,
      status: MigrationBatchStatus.draft,
    },
    select: { id: true },
  });

  return {
    batchId: batch.id,
    fileName: input.fileName,
    sheetName: sheet.name,
    columns: sheet.columns,
    totalRows: sheet.rows.length,
    suggestedMapping: suggestMapping(sheet.columns),
  };
}

// ── Шаг 2: сопоставление ─────────────────────────────────────────────────────

export async function setMigrationMapping(
  ctx: AuthContext,
  batchId: string,
  input: { mapping: ColumnMapping; saveAsSchemaName?: string | undefined },
): Promise<{ batchId: string; status: MigrationBatchStatus }> {
  requirePermission(ctx, 'pipelineStatus', 'manage');

  const batch = await loadBatch(ctx, batchId);

  if (batch.status === MigrationBatchStatus.applied) {
    throw new ConflictError('Импорт уже применён. Сопоставление менять нечего');
  }

  let mappingSchemaId: string | null = batch.mappingSchemaId;

  // Схема сохраняется на компанию: второй файл того же агентства ложится
  // на готовое сопоставление (L4).
  if (input.saveAsSchemaName !== undefined && input.saveAsSchemaName.trim() !== '') {
    const schema = await prisma.columnMappingSchema.upsert({
      where: {
        companyId_name: { companyId: ctx.companyId, name: input.saveAsSchemaName.trim() },
      },
      update: { mapping: input.mapping as unknown as Prisma.InputJsonValue },
      create: {
        companyId: ctx.companyId,
        name: input.saveAsSchemaName.trim(),
        mapping: input.mapping as unknown as Prisma.InputJsonValue,
        createdByUserId: ctx.userId,
      },
      select: { id: true },
    });
    mappingSchemaId = schema.id;
  }

  const updated = await prisma.migrationBatch.update({
    where: { id: batch.id },
    data: {
      mappingSchemaId,
      report: { mapping: input.mapping } as unknown as Prisma.InputJsonValue,
      status: MigrationBatchStatus.previewed,
    },
    select: { id: true, status: true },
  });

  return { batchId: updated.id, status: updated.status };
}

// ── Шаг 3: предпросмотр ──────────────────────────────────────────────────────

export interface PreviewRow {
  rowNumber: number;
  mapped: MappedRow;
  issues: RejectionCode[];
}

export interface DuplicateGroup {
  rowNumbers: number[];
  reasonHuman: string;
}

export interface MigrationPreview {
  batchId: string;
  totalRows: number;
  /** Ничего ещё не записано — и это сказано прямо. */
  written: false;
  rows: PreviewRow[];
  duplicatesInsideFile: DuplicateGroup[];
  rejections: Array<{ code: RejectionCode; reasonHuman: string; rows: number[] }>;
  acceptedRows: number;
  rejectedRows: number;
}

/**
 * Предпросмотр до записи.
 *
 * Дубли ВНУТРИ САМОГО ФАЙЛА показываются здесь (L7, L8) — это самый частый
 * дефект реальной выгрузки и тот, которого никто не ожидает.
 */
export async function previewMigration(
  ctx: AuthContext,
  batchId: string,
): Promise<MigrationPreview> {
  requirePermission(ctx, 'pipelineStatus', 'manage');

  const batch = await loadBatch(ctx, batchId);
  const { mapping, rows } = extractBatchData(batch);

  const analysis = analyzeRows(batch.detectedColumns, rows, mapping);

  return {
    batchId: batch.id,
    totalRows: rows.length,
    written: false,
    rows: analysis.evaluated.slice(0, PREVIEW_ROWS).map((row) => ({
      rowNumber: row.rowNumber,
      mapped: row.mapped,
      issues: row.issues,
    })),
    duplicatesInsideFile: analysis.duplicateGroups,
    rejections: summarizeRejections(analysis.evaluated),
    acceptedRows: analysis.evaluated.filter((row) => row.issues.length === 0).length,
    rejectedRows: analysis.evaluated.filter((row) => row.issues.length > 0).length,
  };
}

// ── Шаг 4: применение ────────────────────────────────────────────────────────

export interface ApplyResult {
  batchId: string;
  acceptedRows: number;
  rejectedRows: number;
  rejections: Array<{ code: RejectionCode; reasonHuman: string; rows: number[] }>;
}

/**
 * Запись объектов.
 *
 * Все созданные объекты получают `origin = legacy_import` и ссылку на заход
 * (L11). Объект из архива не притворяется тем, по которому был разговор
 * с собственником, и это видно в карточке.
 */
export async function applyMigration(ctx: AuthContext, batchId: string): Promise<ApplyResult> {
  requirePermission(ctx, 'pipelineStatus', 'manage');

  const batch = await loadBatch(ctx, batchId);

  if (batch.status === MigrationBatchStatus.applied) {
    throw new ConflictError('Импорт уже применён');
  }

  const { mapping, rows } = extractBatchData(batch);
  const analysis = analyzeRows(batch.detectedColumns, rows, mapping);

  // Администратор действует В КОМАНДУ-получатель. Область дедупликации —
  // её команда, а не отсутствующая команда администратора.
  const target: AuthContext = { ...ctx, teamId: batch.teamId };

  const status = await prisma.pipelineStatus.findFirst({
    where: { companyId: ctx.companyId, code: 'IN_BASE' },
    select: { id: true },
  });
  if (status === null) {
    throw new NotFoundError('В компании нет статуса «В базе»');
  }

  const rejections = [...analysis.evaluated.filter((row) => row.issues.length > 0)];
  let accepted = 0;

  // Построчно, а не одной транзакцией: файл агентства бывает на тысячи строк,
  // и длинная транзакция упёрлась бы в таймаут. Откат при этом остаётся
  // возможен всегда — он опирается на migrationBatchId, а не на транзакцию.
  for (const row of analysis.evaluated) {
    if (row.issues.length > 0) continue;

    // Прогон через ту же дедупликацию, что и обычный импорт: массовая
    // операция не должна создавать то, что поштучный импорт заблокировал бы.
    const dedup = await analyze(target, {
      source: 'SS_GE',
      externalId: null,
      canonicalUrl: `migration://${batch.id}/${row.rowNumber}`,
      facts: {
        phones: row.phoneNormalized === null ? [] : [row.phoneNormalized],
        addressNormalized: normalizeAddress(row.mapped.address),
        area: row.area,
        rooms: row.rooms,
        floor: row.floor,
        totalFloors: row.totalFloors,
        price: row.price,
        currency: row.currency,
        propertyType: row.propertyType,
        photos: [],
        district: row.mapped.district ?? null,
      },
    });

    if (dedup.teamMatches.some((match) => match.verdict === 'STRONG')) {
      row.issues.push('duplicate_in_base');
      rejections.push(row);
      continue;
    }

    await createLegacyProperty(target, batch.id, status.id, row);
    accepted += 1;
  }

  const report = summarizeRejections(rejections);

  await prisma.$transaction(async (tx) => {
    await tx.migrationBatch.update({
      where: { id: batch.id },
      data: {
        status: MigrationBatchStatus.applied,
        acceptedRows: accepted,
        rejectedRows: rejections.length,
        appliedAt: new Date(),
        // ПЕРСОНАЛЬНЫХ ДАННЫХ В ОТЧЁТЕ НЕТ (правило 10): строка описывается
        // номером и кодом причины, а не содержимым.
        report: { rejections: report } as unknown as Prisma.InputJsonValue,
      },
    });

    await writeActivity(tx, ctx, {
      entityType: ENTITY.MIGRATION_BATCH,
      entityId: batch.id,
      action: ACTIVITY.MIGRATION_APPLIED,
      after: { accepted, rejected: rejections.length, fileName: batch.fileName },
    });
  });

  return {
    batchId: batch.id,
    acceptedRows: accepted,
    rejectedRows: rejections.length,
    rejections: report,
  };
}

// ── Шаг 5: отмена ────────────────────────────────────────────────────────────

/**
 * Отмена импорта ЦЕЛИКОМ одной операцией (L9).
 *
 * Без неё агентство, заметившее ошибку сопоставления на четырёхсотой строке,
 * не имеет пути назад — и первая миграция становится последним, что оно нам
 * доверит.
 */
export async function rollbackMigration(
  ctx: AuthContext,
  batchId: string,
): Promise<{ batchId: string; removedProperties: number }> {
  requirePermission(ctx, 'pipelineStatus', 'manage');

  const batch = await loadBatch(ctx, batchId);

  if (batch.status === MigrationBatchStatus.rolled_back) {
    throw new ConflictError('Импорт уже отменён');
  }

  const properties = await prisma.property.findMany({
    where: { companyId: ctx.companyId, migrationBatchId: batch.id },
    select: { id: true, ownerContactId: true },
  });

  const removed = await prisma.$transaction(async (tx) => {
    await tx.property.deleteMany({
      where: { companyId: ctx.companyId, migrationBatchId: batch.id },
    });

    // Контакты, ради которых объектов больше нет, удаляются следом:
    // иначе в базе останутся телефоны, ни к чему не привязанные (Q26).
    const contactIds = properties
      .map((property) => property.ownerContactId)
      .filter((id): id is string => id !== null);

    if (contactIds.length > 0) {
      const stillUsed = await tx.property.findMany({
        where: { ownerContactId: { in: contactIds } },
        select: { ownerContactId: true },
      });
      const used = new Set(stillUsed.map((row) => row.ownerContactId));
      const orphaned = contactIds.filter((id) => !used.has(id));

      if (orphaned.length > 0) {
        await tx.ownerContact.deleteMany({
          where: { id: { in: orphaned }, companyId: ctx.companyId },
        });
      }
    }

    await tx.migrationBatch.update({
      where: { id: batch.id },
      data: { status: MigrationBatchStatus.rolled_back, rolledBackAt: new Date() },
    });

    await writeActivity(tx, ctx, {
      entityType: ENTITY.MIGRATION_BATCH,
      entityId: batch.id,
      action: ACTIVITY.MIGRATION_ROLLED_BACK,
      before: { properties: properties.length },
    });

    return properties.length;
  });

  return { batchId: batch.id, removedProperties: removed };
}

// ── Внутреннее ───────────────────────────────────────────────────────────────

interface EvaluatedRow {
  rowNumber: number;
  mapped: MappedRow;
  issues: RejectionCode[];
  phoneOriginal: string | null;
  phoneNormalized: string | null;
  price: number | null;
  currency: string | null;
  area: number | null;
  rooms: number | null;
  floor: number | null;
  totalFloors: number | null;
  propertyType: string | null;
  transactionType: string | null;
}

interface RowAnalysis {
  evaluated: EvaluatedRow[];
  duplicateGroups: DuplicateGroup[];
}

function analyzeRows(
  columns: readonly string[],
  rows: readonly string[][],
  mapping: ColumnMapping,
): RowAnalysis {
  const evaluated: EvaluatedRow[] = rows.map((row, index) => {
    const mapped = applyMapping(columns, row, mapping);

    const money = parseMoney(mapped.price ?? '', mapped.currency ?? null);

    let phoneOriginal: string | null = null;
    let phoneNormalized: string | null = null;
    const issues: RejectionCode[] = [];

    if (mapped.ownerPhone === undefined || mapped.ownerPhone.trim() === '') {
      // Объект без телефона ломает дедупликацию уровней 2–3 и бесполезен
      // агенту, который собирается звонить.
      issues.push('no_phone');
    } else {
      try {
        const normalized = normalizePhone(mapped.ownerPhone);
        phoneOriginal = normalized.original;
        phoneNormalized = normalized.normalized;
      } catch {
        issues.push('invalid_phone');
      }
    }

    const area = mapped.area === undefined ? null : parseDecimal(mapped.area);
    const rooms = mapped.rooms === undefined ? null : parseInteger(mapped.rooms);

    if (
      (mapped.address === undefined || mapped.address.trim() === '') &&
      area === null &&
      rooms === null
    ) {
      issues.push('no_identifying_data');
    }

    return {
      // Нумерация с двойки: первая строка файла — заголовки, и агентство
      // считает строки так же, как их показывает Excel.
      rowNumber: index + 2,
      mapped,
      issues,
      phoneOriginal,
      phoneNormalized,
      price: money.amount,
      currency: money.currency,
      area,
      rooms,
      floor: mapped.floor === undefined ? null : parseInteger(mapped.floor),
      totalFloors: mapped.totalFloors === undefined ? null : parseInteger(mapped.totalFloors),
      propertyType:
        mapped.propertyType === undefined ? null : parsePropertyType(mapped.propertyType),
      transactionType:
        mapped.transactionType === undefined ? null : parseTransactionType(mapped.transactionType),
    };
  });

  return { evaluated, duplicateGroups: markDuplicatesInsideFile(evaluated) };
}

/**
 * Дубли внутри самого файла.
 *
 * Самый частый дефект реальной выгрузки и тот, которого никто не ожидает:
 * одна квартира внесена дважды разными сотрудниками за разные годы.
 * Первая строка группы становится объектом, остальные — нет.
 */
function markDuplicatesInsideFile(rows: EvaluatedRow[]): DuplicateGroup[] {
  const byPhone = new Map<string, EvaluatedRow[]>();

  for (const row of rows) {
    if (row.phoneNormalized === null) continue;
    const key = row.phoneNormalized;
    const group = byPhone.get(key);
    if (group === undefined) byPhone.set(key, [row]);
    else group.push(row);
  }

  const groups: DuplicateGroup[] = [];

  for (const group of byPhone.values()) {
    if (group.length < 2) continue;

    // Один собственник с двумя разными квартирами — не дубль. Различаем
    // по площади и комнатам, как уровень 3 дедупликации.
    const clusters = clusterBySimilarity(group);

    for (const cluster of clusters) {
      if (cluster.length < 2) continue;

      for (const row of cluster.slice(1)) row.issues.push('duplicate_in_file');

      groups.push({
        rowNumbers: cluster.map((row) => row.rowNumber),
        reasonHuman: 'Тот же телефон и те же параметры объекта',
      });
    }
  }

  return groups;
}

function clusterBySimilarity(rows: EvaluatedRow[]): EvaluatedRow[][] {
  const clusters: EvaluatedRow[][] = [];

  for (const row of rows) {
    const existing = clusters.find((cluster) => {
      const head = cluster[0] as EvaluatedRow;
      const sameArea =
        head.area === null || row.area === null || Math.abs(head.area - row.area) <= 1;
      const sameRooms = head.rooms === null || row.rooms === null || head.rooms === row.rooms;
      return sameArea && sameRooms;
    });

    if (existing === undefined) clusters.push([row]);
    else existing.push(row);
  }

  return clusters;
}

function summarizeRejections(
  rows: readonly EvaluatedRow[],
): Array<{ code: RejectionCode; reasonHuman: string; rows: number[] }> {
  const byCode = new Map<RejectionCode, number[]>();

  for (const row of rows) {
    for (const code of row.issues) {
      const list = byCode.get(code);
      if (list === undefined) byCode.set(code, [row.rowNumber]);
      else list.push(row.rowNumber);
    }
  }

  return [...byCode.entries()].map(([code, numbers]) => ({
    code,
    reasonHuman: REJECTION[code],
    rows: numbers,
  }));
}

async function createLegacyProperty(
  ctx: AuthContext,
  batchId: string,
  pipelineStatusId: string,
  row: EvaluatedRow,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const contact = await tx.ownerContact.create({
      data: {
        companyId: ctx.companyId,
        fullName: row.mapped.ownerName ?? null,
        phones: {
          create: {
            companyId: ctx.companyId,
            phoneOriginal: row.phoneOriginal as string,
            phoneNormalized: row.phoneNormalized as string,
            isPrimary: true,
          },
        },
      },
      select: { id: true },
    });

    await tx.property.create({
      data: {
        companyId: ctx.companyId,
        teamId: ctx.teamId as string,
        createdByUserId: ctx.userId,
        pipelineStatusId,
        // Объект из архива не притворяется тем, по которому был разговор
        // с собственником (L13, правило R14).
        origin: PropertyOrigin.legacy_import,
        migrationBatchId: batchId,
        ownerContactId: contact.id,
        transactionType: (row.transactionType ?? 'SALE') as 'SALE' | 'RENT',
        propertyType: (row.propertyType ?? 'APARTMENT') as
          'APARTMENT' | 'HOUSE' | 'LAND' | 'COMMERCIAL',
        rooms: row.rooms,
        areaTotal: row.area,
        floor: row.floor,
        totalFloors: row.totalFloors,
        district: row.mapped.district ?? null,
        addressRaw: row.mapped.address ?? null,
        addressNormalized: normalizeAddress(row.mapped.address),
        price: row.price,
        currency: row.currency,
        descriptionSource: row.mapped.description ?? null,
        photos: [],
      },
    });
  });
}

async function loadBatch(ctx: AuthContext, batchId: string) {
  const batch = await prisma.migrationBatch.findFirst({
    // companyId из контекста (правило 5).
    where: { id: batchId, companyId: ctx.companyId },
  });

  if (batch === null) throw new NotFoundError();
  return batch;
}

function extractBatchData(batch: {
  rawRows: Prisma.JsonValue;
  report: Prisma.JsonValue;
  detectedColumns: string[];
}): { mapping: ColumnMapping; rows: string[][] } {
  const rows = Array.isArray(batch.rawRows) ? (batch.rawRows as unknown as string[][]) : [];

  const report = batch.report as { mapping?: ColumnMapping } | null;
  const mapping = report?.mapping ?? suggestMapping(batch.detectedColumns);

  return { mapping, rows };
}
