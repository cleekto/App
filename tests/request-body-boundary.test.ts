import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const API_ROOT = join(import.meta.dirname, '..', 'apps', 'web', 'app', 'api');

function routes(dir: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...routes(path));
    } else if (entry.name === 'route.ts') {
      found.push(path);
    }
  }

  return found;
}

function executableSource(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '');
}

describe('API request-body boundary', () => {
  it('routes never bypass the bounded body helpers', () => {
    const offenders: string[] = [];

    for (const path of routes(API_ROOT)) {
      const code = executableSource(readFileSync(path, 'utf8'));

      if (/\brequest\.(?:json|formData)\s*\(/u.test(code)) {
        offenders.push(path.slice(API_ROOT.length + 1).replaceAll('\\', '/'));
      }
    }

    expect(offenders).toEqual([]);
  });

  it('multipart migration uses the bounded form-data reader', () => {
    const path = join(API_ROOT, 'v1', 'migrations', 'route.ts');
    const source = readFileSync(path, 'utf8');

    expect(source).toContain('parseFormData(request, MAX_MULTIPART_BYTES)');
    expect(source).toContain('MAX_FILE_BYTES + 1024 * 1024');
  });
});
