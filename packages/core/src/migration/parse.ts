import ExcelJS from 'exceljs';

import { ValidationError } from '../errors';

/**
 * Чтение файла агентства КАК ЕСТЬ (§6Г.2).
 *
 * Реальные выгрузки выглядят так: заголовки на трёх языках вперемешку,
 * объединённые ячейки, несколько листов, лари и доллары в одной колонке,
 * телефоны в пяти форматах, половина важного — в свободном тексте примечаний.
 *
 * Импортёр с фиксированным набором колонок отработает на малой доле файлов,
 * поэтому здесь ничего не требуется от структуры: читаем всё, а решение,
 * что чем является, принимает человек на экране сопоставления.
 */

export interface ParsedSheet {
  name: string;
  /** Заголовки как в файле, включая пустые и повторяющиеся. */
  columns: string[];
  /** Строки данных: массив значений в порядке колонок. */
  rows: string[][];
}

export interface ParsedFile {
  sheets: ParsedSheet[];
}

const MAX_ROWS = 50_000;

export async function parseAgencyFile(buffer: Buffer, fileName: string): Promise<ParsedFile> {
  const lower = fileName.toLowerCase();

  if (lower.endsWith('.csv')) {
    return { sheets: [parseCsv(buffer, fileName)] };
  }

  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) {
    return parseXlsx(buffer);
  }

  throw new ValidationError('Поддерживаются файлы .xlsx и .csv', { fields: ['file'] });
}

// ── xlsx ─────────────────────────────────────────────────────────────────────

async function parseXlsx(buffer: Buffer): Promise<ParsedFile> {
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    // Текст исключения библиотеки описывает внутренности формата и агенту
    // ничего не объясняет.
    throw new ValidationError('Файл не читается как xlsx. Возможно, он повреждён', {
      fields: ['file'],
    });
  }

  const sheets: ParsedSheet[] = [];

  for (const worksheet of workbook.worksheets) {
    const rows: string[][] = [];
    let columns: string[] = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rows.length >= MAX_ROWS) return;

      const values: string[] = [];
      // row.values — массив с единицы: нулевой элемент всегда пуст.
      const raw = row.values as unknown[];
      for (let i = 1; i < raw.length; i += 1) {
        values.push(cellToString(raw[i]));
      }

      if (rowNumber === 1) {
        columns = values;
        return;
      }

      // Пустые строки в конце листа — обычное дело для выгрузок.
      if (values.every((value) => value === '')) return;
      rows.push(values);
    });

    if (columns.length === 0 && rows.length === 0) continue;

    sheets.push({ name: worksheet.name, columns, rows });
  }

  if (sheets.length === 0) {
    throw new ValidationError('В файле не нашлось ни одного листа с данными', {
      fields: ['file'],
    });
  }

  return { sheets };
}

/**
 * Значение ячейки в строку.
 *
 * Даты, формулы и гиперссылки в выгрузках встречаются постоянно, и брать
 * у них `toString()` наугад значит получить `[object Object]` в базе.
 */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    // Формула: берём вычисленный результат, а не текст формулы.
    if ('result' in record) return cellToString(record['result']);
    // Гиперссылка и форматированный текст.
    if ('text' in record) return cellToString(record['text']);
    if ('richText' in record && Array.isArray(record['richText'])) {
      return (record['richText'] as Array<{ text?: string }>)
        .map((part) => part.text ?? '')
        .join('')
        .trim();
    }
    if ('hyperlink' in record) return cellToString(record['hyperlink']);
  }

  return '';
}

// ── csv ──────────────────────────────────────────────────────────────────────

/**
 * CSV разбирается вручную, а не библиотекой, ради одной вещи — определения
 * разделителя.
 *
 * Excel в русской и грузинской локали сохраняет CSV с точкой с запятой,
 * а не с запятой. Библиотека, ожидающая запятую, прочитает такой файл
 * как одну колонку — и агентство решит, что импорт не работает.
 */
function parseCsv(buffer: Buffer, fileName: string): ParsedSheet {
  let text = buffer.toString('utf8');

  // BOM, который добавляет Excel при сохранении в UTF-8.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  if (text.trim() === '') {
    throw new ValidationError('Файл пуст', { fields: ['file'] });
  }

  const delimiter = detectDelimiter(text);
  const records = splitCsv(text, delimiter);

  const header = records.shift() ?? [];
  const rows = records.filter((row) => row.some((cell) => cell !== ''));

  return { name: fileName, columns: header, rows: rows.slice(0, MAX_ROWS) };
}

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/u).slice(0, 5).join('\n');
  const candidates = [';', ',', '\t'];

  let best = ',';
  let bestCount = 0;

  for (const candidate of candidates) {
    // Считаем только разделители вне кавычек: адрес «Ваке, 12» не должен
    // делать запятую победителем.
    const count = countOutsideQuotes(sample, candidate);
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }

  return best;
}

function countOutsideQuotes(text: string, delimiter: string): number {
  let inQuotes = false;
  let count = 0;

  for (const char of text) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === delimiter && !inQuotes) count += 1;
  }

  return count;
}

/** Разбор с учётом кавычек и переводов строк внутри ячейки. */
function splitCsv(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] as string;

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field.trim());
      field = '';
    } else if (char === '\n') {
      row.push(field.trim());
      records.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field.trim());
    records.push(row);
  }

  return records;
}
