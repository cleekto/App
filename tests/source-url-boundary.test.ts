import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

describe('source URL security boundary', () => {
  it('validates provider URLs at both HTTP ingestion points', () => {
    const importRoute = read('apps/web/app/api/v1/import/listing/route.ts');
    const observationRoute = read('apps/web/app/api/v1/observations/batch/route.ts');

    expect(importRoute).toContain('sourceUrlMatchesSource(value.source, value.sourceUrl)');
    expect(observationRoute).toContain('sourceUrlMatchesSource(value.source, card.url)');
  });

  it('validates the URL again inside the import domain use case', () => {
    const useCase = read('packages/core/src/import/use-cases.ts');

    expect(useCase).toContain('sourceUrlMatchesSource(input.source, input.sourceUrl)');
    expect(useCase.indexOf('sourceUrlMatchesSource(input.source, input.sourceUrl)')).toBeLessThan(
      useCase.indexOf('canonicalizeUrl(input.sourceUrl)'),
    );
  });

  it('collector handles redirects manually under the source policy', () => {
    const collector = read('packages/adapters/src/collector.ts');

    expect(collector).toContain("source !== 'SS_GE'");
    expect(collector).toContain('sourceUrlMatchesSource(source, current)');
    expect(collector).toContain("redirect: 'manual'");
  });

  it('external property photos do not use an unrestricted server fetch', () => {
    const storage = read('packages/core/src/storage/use-cases.ts');

    expect(storage).toContain('downloadPublicHttps(key, MAX_BYTES)');
    expect(storage).not.toMatch(/await\s+fetch\s*\(\s*key\s*\)/u);
  });
});
