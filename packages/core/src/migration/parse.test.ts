import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { ValidationError } from '../errors';
import { parseAgencyFile } from './parse';

/**
 * Файл агентства читается КАК ЕСТЬ. От структуры не требуется ничего:
 * решение, что чем является, принимает человек на экране сопоставления.
 */

const buffer = (text: string, withBom = false): Buffer =>
  Buffer.from((withBom ? '﻿' : '') + text, 'utf8');

describe('csv', () => {
  it('разделитель с точкой с запятой определяется сам', async () => {
    // Excel в русской и грузинской локали сохраняет CSV именно так.
    // Библиотека, ожидающая запятую, прочитает файл как одну колонку —
    // и агентство решит, что импорт не работает.
    const csv = 'Адрес;Цена;Телефон\nЧавчавадзе 30;145000;+995555123456';
    const { sheets } = await parseAgencyFile(buffer(csv), 'base.csv');

    expect(sheets[0]?.columns).toEqual(['Адрес', 'Цена', 'Телефон']);
    expect(sheets[0]?.rows[0]).toEqual(['Чавчавадзе 30', '145000', '+995555123456']);
  });

  it('обычная запятая тоже работает', async () => {
    const csv = 'Address,Price\nVake 30,145000';
    const { sheets } = await parseAgencyFile(buffer(csv), 'base.csv');
    expect(sheets[0]?.rows[0]).toEqual(['Vake 30', '145000']);
  });

  it('табуляция как разделитель', async () => {
    const csv = 'Адрес\tЦена\nВаке 30\t145000';
    const { sheets } = await parseAgencyFile(buffer(csv), 'base.csv');
    expect(sheets[0]?.columns).toEqual(['Адрес', 'Цена']);
  });

  it('запятая внутри кавычек не считается разделителем', async () => {
    // «Ваке, 12» — обычный адрес, а не две колонки.
    const csv = 'Адрес;Цена\n"Ваке, 12";145000';
    const { sheets } = await parseAgencyFile(buffer(csv), 'base.csv');

    expect(sheets[0]?.rows[0]).toEqual(['Ваке, 12', '145000']);
  });

  it('BOM от Excel не попадает в первый заголовок', async () => {
    const csv = 'Адрес;Цена\nВаке 30;145000';
    const { sheets } = await parseAgencyFile(buffer(csv, true), 'base.csv');

    expect(sheets[0]?.columns[0]).toBe('Адрес');
  });

  it('перевод строки внутри ячейки не разрывает строку', async () => {
    const csv = 'Адрес;Примечание\nВаке 30;"Ремонт свежий\nмебель остаётся"';
    const { sheets } = await parseAgencyFile(buffer(csv), 'base.csv');

    expect(sheets[0]?.rows).toHaveLength(1);
    expect(sheets[0]?.rows[0]?.[1]).toContain('мебель остаётся');
  });

  it('пустые строки в конце файла отбрасываются', async () => {
    const csv = 'Адрес;Цена\nВаке 30;145000\n;\n\n';
    const { sheets } = await parseAgencyFile(buffer(csv), 'base.csv');

    expect(sheets[0]?.rows).toHaveLength(1);
  });

  it('пустой файл отклоняется понятной ошибкой', async () => {
    await expect(parseAgencyFile(buffer('   '), 'base.csv')).rejects.toThrow(ValidationError);
  });
});

describe('xlsx', () => {
  async function makeWorkbook(build: (workbook: ExcelJS.Workbook) => void): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    build(workbook);
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  it('читается вместе с заголовками', async () => {
    const file = await makeWorkbook((workbook) => {
      const sheet = workbook.addWorksheet('Объекты');
      sheet.addRow(['Адрес', 'Цена', 'ფართობი']);
      sheet.addRow(['Чавчавадзе 30', 145000, 78]);
    });

    const { sheets } = await parseAgencyFile(file, 'base.xlsx');

    expect(sheets[0]?.name).toBe('Объекты');
    expect(sheets[0]?.columns).toEqual(['Адрес', 'Цена', 'ფართობი']);
    expect(sheets[0]?.rows[0]).toEqual(['Чавчавадзе 30', '145000', '78']);
  });

  it('несколько листов возвращаются все', async () => {
    // Выбор листа — решение человека, а не догадка импортёра.
    const file = await makeWorkbook((workbook) => {
      const first = workbook.addWorksheet('Продажа');
      first.addRow(['Адрес']);
      first.addRow(['Ваке 1']);
      const second = workbook.addWorksheet('Аренда');
      second.addRow(['Адрес']);
      second.addRow(['Сабуртало 2']);
    });

    const { sheets } = await parseAgencyFile(file, 'base.xlsx');

    expect(sheets.map((sheet) => sheet.name)).toEqual(['Продажа', 'Аренда']);
  });

  it('дата в ячейке становится читаемой строкой, а не объектом', async () => {
    const file = await makeWorkbook((workbook) => {
      const sheet = workbook.addWorksheet('Лист1');
      sheet.addRow(['Дата']);
      sheet.addRow([new Date('2024-03-15T00:00:00Z')]);
    });

    const { sheets } = await parseAgencyFile(file, 'base.xlsx');

    expect(sheets[0]?.rows[0]?.[0]).toBe('2024-03-15');
    expect(sheets[0]?.rows[0]?.[0]).not.toContain('object');
  });

  it('формула отдаёт вычисленное значение, а не свой текст', async () => {
    const file = await makeWorkbook((workbook) => {
      const sheet = workbook.addWorksheet('Лист1');
      sheet.addRow(['Цена']);
      sheet.addRow([{ formula: 'A1*2', result: 290000 }]);
    });

    const { sheets } = await parseAgencyFile(file, 'base.xlsx');

    expect(sheets[0]?.rows[0]?.[0]).toBe('290000');
  });

  it('повреждённый файл отклоняется понятной ошибкой', async () => {
    // Текст исключения библиотеки описывает внутренности формата
    // и агенту ничего не объясняет.
    await expect(parseAgencyFile(Buffer.from('это не xlsx'), 'base.xlsx')).rejects.toThrow(
      ValidationError,
    );
  });
});

describe('неподдерживаемый формат', () => {
  it('отклоняется до чтения содержимого', async () => {
    await expect(parseAgencyFile(Buffer.from('x'), 'base.pdf')).rejects.toThrow(ValidationError);
  });
});
