import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', 'coverage', '.git', 'docs']);

function sourceFiles(extensions: string[]): string[] {
  const found: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name));
      } else if (extensions.includes(extname(entry.name))) {
        found.push(join(dir, entry.name));
      }
    }
  };

  walk(ROOT);
  return found;
}

const rel = (path: string): string => relative(ROOT, path).split(sep).join('/');

describe('дизайн-инварианты (ADR-0008)', () => {
  // У мхедрули нет заглавных букв. Приём, который в английском читается как
  // акцент, в грузинском не делает ничего и рассогласовывает языки на одном
  // экране. Правило 18 в CLAUDE.md, DESIGN.md §32.1.
  it('в стилях и разметке нет uppercase', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(['.css', '.tsx', '.html'])) {
      // Комментарии снимаются: файл, объясняющий, почему uppercase запрещён,
      // сам правило не нарушает. Без этого задокументировать правило рядом
      // с кодом было бы невозможно — что и случилось на фазе 6.
      const content = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//gu, '')
        .replace(/<!--[\s\S]*?-->/gu, '');

      // CSS-свойство и служебный класс Tailwind — два способа получить
      // одно и то же, и запрещены оба.
      if (/text-transform\s*:\s*uppercase/u.test(content)) {
        offenders.push(`${rel(file)}: text-transform: uppercase`);
      }
      if (/class(?:Name)?="[^"]*(?:^|[\s"])uppercase(?:[\s"]|$)[^"]*"/u.test(content)) {
        offenders.push(`${rel(file)}: класс uppercase`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('шрифтовой стек покрывает грузинский', () => {
    const css = readFileSync(join(ROOT, 'apps/web/app/globals.css'), 'utf8');
    expect(css).toMatch(/Georgian/u);
  });
});

describe('окружение (правило 8)', () => {
  // .env.example обязан быть актуальным. Переменная, о которой знает только
  // код, обнаруживается на чужой машине при развёртывании — то есть в худший
  // из возможных моментов.
  it('каждая переменная окружения из кода описана в .env.example', () => {
    const example = readFileSync(join(ROOT, '.env.example'), 'utf8');

    // Системные переменные задаёт операционная система или CI, а не проект.
    // Их место в .env.example создало бы ложное впечатление, что их надо
    // заполнять при развёртывании.
    // NODE_ENV в этом списке потому, что его выставляет инструмент
    // (next, vitest), а не человек при развёртывании.
    const SYSTEM = new Set(['PATH', 'CI', 'HOME', 'TMPDIR', 'TEMP', 'NODE_ENV']);

    const used = new Set<string>();
    for (const file of sourceFiles(['.ts', '.tsx', '.mjs'])) {
      const content = readFileSync(file, 'utf8');
      for (const match of content.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/gu)) {
        const name = match[1];
        if (name !== undefined && !SYSTEM.has(name)) used.add(name);
      }
    }

    const undocumented = [...used].filter((name) => !example.includes(name)).sort();
    expect(undocumented).toEqual([]);
  });

  it('в .env.example нет настоящих секретов', () => {
    const example = readFileSync(join(ROOT, '.env.example'), 'utf8');
    const secret = /AUTH_JWT_SECRET="([^"]*)"/u.exec(example)?.[1] ?? '';

    // Значение обязано выглядеть как образец для замены, иначе
    // кто-нибудь развернёт продукт с секретом из репозитория.
    expect(secret).toMatch(/замени|replace|change/iu);
  });
});
