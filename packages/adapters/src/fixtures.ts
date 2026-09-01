import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

import { parseHTML } from 'linkedom';

/**
 * Загрузка сохранённых страниц площадок для тестов.
 *
 * Файлы лежат вне git: в них настоящие телефоны и имена собственников,
 * а репозиторий публичный (правило 10). Поэтому тесты, которым нужны
 * фикстуры, пропускаются, когда папка пуста, — и говорят об этом вслух,
 * а не делают вид, что проверили.
 */

const FIXTURE_ROOT = join(import.meta.dirname, '../../../docs/fixtures');

export interface Fixture {
  name: string;
  url: string;
  document: Document;
}

export function fixturesAvailable(site: 'ss-ge' | 'myhome-ge'): boolean {
  return listFiles(site).length > 0;
}

export function loadFixtures(site: 'ss-ge' | 'myhome-ge'): Fixture[] {
  return listFiles(site).map((file) => {
    const html = readFileSync(file, 'utf8');
    const { document } = parseHTML(html);

    // Браузер записывает исходный адрес в комментарий первой строкой.
    // Он нужен как база для относительных ссылок и как «адрес страницы»
    // в тех проверках, где важно, что адаптер не полагается на мета-теги.
    const match = /saved from url=\(\d+\)([^\s]+)/u.exec(html.slice(0, 400));

    return {
      name: basename(file),
      url: match?.[1] ?? 'https://example.invalid/',
      document: document as unknown as Document,
    };
  });
}

function listFiles(site: 'ss-ge' | 'myhome-ge'): string[] {
  const dir = join(FIXTURE_ROOT, site, 'listings');
  try {
    return readdirSync(dir)
      .filter((name) => name.endsWith('.html'))
      .map((name) => join(dir, name))
      .sort();
  } catch {
    return [];
  }
}
