import { describe, expect, it, vi } from 'vitest';

import {
  downloadPublicHttps,
  isPublicIpv4,
  type ResolvedHttpsTarget,
} from './public-download';

function target(rawUrl: string, address = '93.184.216.34'): ResolvedHttpsTarget {
  return { url: new URL(rawUrl), address };
}

describe('public HTTPS egress', () => {
  it.each([
    '0.0.0.1',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '198.18.0.1',
    '224.0.0.1',
    '255.255.255.255',
  ])('rejects non-public IPv4 %s', (address) => {
    expect(isPublicIpv4(address)).toBe(false);
  });

  it.each(['1.1.1.1', '8.8.8.8', '93.184.216.34'])('accepts public IPv4 %s', (address) => {
    expect(isPublicIpv4(address)).toBe(true);
  });

  it('revalidates a redirect instead of following it automatically', async () => {
    const resolve = vi
      .fn()
      .mockResolvedValueOnce(target('https://images.example/photo.jpg'))
      .mockResolvedValueOnce(null);
    const request = vi.fn().mockResolvedValue({
      kind: 'redirect',
      location: 'https://169.254.169.254/latest/meta-data/',
    });

    const result = await downloadPublicHttps('https://images.example/photo.jpg', 1024, {
      resolve,
      request,
    });

    expect(result).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it('returns bytes after a validated redirect', async () => {
    const resolve = vi
      .fn()
      .mockResolvedValueOnce(target('https://images.example/a'))
      .mockResolvedValueOnce(target('https://cdn.example/b'));
    const request = vi
      .fn()
      .mockResolvedValueOnce({ kind: 'redirect', location: 'https://cdn.example/b' })
      .mockResolvedValueOnce({
        kind: 'ok',
        value: { bytes: new Uint8Array([1, 2, 3]), contentType: 'image/jpeg' },
      });

    const result = await downloadPublicHttps('https://images.example/a', 1024, {
      resolve,
      request,
    });

    expect(result).toEqual({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: 'image/jpeg',
    });
    expect(request).toHaveBeenCalledTimes(2);
  });
});
