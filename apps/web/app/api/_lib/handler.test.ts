import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { parseBody, parseFormData } from './handler';

describe('bounded API request bodies', () => {
  it('parses JSON below the configured limit', async () => {
    const request = new Request('https://kleekto.test/api', {
      method: 'POST',
      body: JSON.stringify({ value: 'ok' }),
      headers: { 'content-type': 'application/json' },
    });

    await expect(
      parseBody(request, z.object({ value: z.string() }), { maxBytes: 128 }),
    ).resolves.toEqual({ value: 'ok' });
  });

  it('rejects a declared body larger than the limit', async () => {
    const request = new Request('https://kleekto.test/api', {
      method: 'POST',
      body: '{}',
      headers: {
        'content-type': 'application/json',
        'content-length': '999',
      },
    });

    await expect(
      parseBody(request, z.object({}), { maxBytes: 32 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects actual streamed bytes even without Content-Length', async () => {
    const request = new Request('https://kleekto.test/api', {
      method: 'POST',
      body: JSON.stringify({ value: 'x'.repeat(100) }),
      headers: { 'content-type': 'application/json' },
    });

    expect(request.headers.get('content-length')).toBeNull();

    await expect(
      parseBody(request, z.object({ value: z.string() }), { maxBytes: 32 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('allows an empty body only when the route opts in', async () => {
    const request = new Request('https://kleekto.test/api', { method: 'POST' });
    const schema = z.object({ refreshToken: z.string().optional() }).strict();

    await expect(parseBody(request, schema, { allowEmpty: true })).resolves.toEqual({});
  });

  it('parses multipart only after the bounded read succeeds', async () => {
    const form = new FormData();
    form.set('teamId', 'team-1');
    form.set('file', new File(['hello'], 'data.csv', { type: 'text/csv' }));

    const request = new Request('https://kleekto.test/api', {
      method: 'POST',
      body: form,
    });

    const parsed = await parseFormData(request, 1024);

    expect(parsed.get('teamId')).toBe('team-1');
    const file = parsed.get('file');
    expect(file).toBeInstanceOf(File);
    expect((file as File).size).toBe(5);
  });

  it('rejects multipart before accepting an oversized request', async () => {
    const form = new FormData();
    form.set('file', new File(['x'.repeat(256)], 'large.csv', { type: 'text/csv' }));

    const request = new Request('https://kleekto.test/api', {
      method: 'POST',
      body: form,
    });

    await expect(parseFormData(request, 64)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
