import { describe, expect, it } from 'vitest';

import { sourceUrlMatchesSource } from './listing';

describe('source URL policy', () => {
  it.each([
    ['SS_GE', 'https://home.ss.ge/ka/udzravi-qoneba/123', true],
    ['MYHOME_GE', 'https://www.myhome.ge/udzravi-qoneba/123', true],
    ['MYHOME_GE', 'https://myhome.ge/udzravi-qoneba/123', true],
    ['SS_GE', 'http://home.ss.ge/ka/udzravi-qoneba/123', false],
    ['SS_GE', 'https://home.ss.ge:444/ka/udzravi-qoneba/123', false],
    ['SS_GE', 'https://user:pass@home.ss.ge/ka/udzravi-qoneba/123', false],
    ['SS_GE', 'https://home.ss.ge.evil.example/123', false],
    ['SS_GE', 'https://ss.ge.evil.example/123', false],
    ['SS_GE', 'https://127.0.0.1/123', false],
    ['MYHOME_GE', 'https://home.ss.ge/123', false],
  ] as const)('%s / %s -> %s', (source, url, expected) => {
    expect(sourceUrlMatchesSource(source, url)).toBe(expected);
  });

  it('rejects malformed URLs', () => {
    expect(sourceUrlMatchesSource('SS_GE', 'not a url')).toBe(false);
  });
});
