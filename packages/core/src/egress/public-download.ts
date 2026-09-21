import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 3;

const BLOCKED_IPV4: ReadonlyArray<readonly [string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

export interface PublicDownload {
  bytes: Uint8Array;
  contentType: string | null;
}

export interface ResolvedHttpsTarget {
  url: URL;
  address: string;
}

type DownloadStep =
  | { kind: 'ok'; value: PublicDownload }
  | { kind: 'redirect'; location: string }
  | { kind: 'failed' };

export interface PublicDownloadDeps {
  resolve?: (rawUrl: string) => Promise<ResolvedHttpsTarget | null>;
  request?: (target: ResolvedHttpsTarget, maxBytes: number) => Promise<DownloadStep>;
}

function ipv4Number(value: string): number | null {
  if (isIP(value) !== 4) return null;

  const parts = value.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => part < 0 || part > 255)) return null;

  const [a = 0, b = 0, c = 0, d = 0] = parts;
  return (((a << 24) >>> 0) + (b << 16) + (c << 8) + d) >>> 0;
}

function inCidr(address: number, base: string, prefix: number): boolean {
  const baseNumber = ipv4Number(base);
  if (baseNumber === null) return false;

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (address & mask) === (baseNumber & mask);
}

/**
 * Only globally routable IPv4 is eligible for server-side downloads.
 *
 * The downloader deliberately does not fall back to IPv6 yet. A narrow,
 * explicit egress surface is safer than accepting address families that are
 * not classified and tested here.
 */
export function isPublicIpv4(address: string): boolean {
  const number = ipv4Number(address);
  if (number === null) return false;
  return !BLOCKED_IPV4.some(([base, prefix]) => inCidr(number, base, prefix));
}

function parseHttpsUrl(rawUrl: string): URL | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') return null;
  if (url.username !== '' || url.password !== '') return null;
  if (url.port !== '' && url.port !== '443') return null;
  if (url.hostname.includes(':')) return null;

  return url;
}

/**
 * Resolve once, validate the resolved address, and return the exact IP that
 * the HTTPS request must connect to. This avoids validating one DNS answer
 * and then letting the HTTP client perform a second, potentially different,
 * lookup.
 */
export async function resolvePublicHttpsTarget(
  rawUrl: string,
): Promise<ResolvedHttpsTarget | null> {
  const url = parseHttpsUrl(rawUrl);
  if (url === null) return null;

  if (isIP(url.hostname) === 4) {
    return isPublicIpv4(url.hostname) ? { url, address: url.hostname } : null;
  }

  try {
    const answers = await lookup(url.hostname, { all: true, family: 4, verbatim: true });
    const address = answers.map((answer) => answer.address).find(isPublicIpv4);
    return address === undefined ? null : { url, address };
  } catch {
    return null;
  }
}

async function requestPinnedHttps(
  target: ResolvedHttpsTarget,
  maxBytes: number,
): Promise<DownloadStep> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: DownloadStep): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const req = request(
      {
        protocol: 'https:',
        hostname: target.address,
        port: 443,
        method: 'GET',
        path: `${target.url.pathname}${target.url.search}`,
        servername: isIP(target.url.hostname) === 0 ? target.url.hostname : undefined,
        headers: {
          host: target.url.host,
          accept: 'image/jpeg,image/png,image/webp,*/*;q=0.1',
          'user-agent': 'KleekTo/0.1',
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        if ([301, 302, 303, 307, 308].includes(status)) {
          const location = response.headers.location;
          response.resume();
          finish(location === undefined ? { kind: 'failed' } : { kind: 'redirect', location });
          return;
        }

        if (status < 200 || status >= 300) {
          response.resume();
          finish({ kind: 'failed' });
          return;
        }

        const declared = Number.parseInt(response.headers['content-length'] ?? '', 10);
        if (Number.isFinite(declared) && declared > maxBytes) {
          response.destroy();
          finish({ kind: 'failed' });
          return;
        }

        const chunks: Buffer[] = [];
        let size = 0;

        response.on('data', (chunk: Buffer | string) => {
          if (settled) return;
          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += bytes.byteLength;

          if (size > maxBytes) {
            response.destroy();
            finish({ kind: 'failed' });
            return;
          }

          chunks.push(bytes);
        });

        response.on('end', () => {
          finish({
            kind: 'ok',
            value: {
              bytes: new Uint8Array(Buffer.concat(chunks)),
              contentType: response.headers['content-type'] ?? null,
            },
          });
        });
        response.on('error', () => finish({ kind: 'failed' }));
      },
    );

    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error('timeout')));
    req.on('error', () => finish({ kind: 'failed' }));
    req.end();
  });
}

/**
 * Download a public HTTPS resource through a pinned, validated IPv4 address.
 * Every redirect is resolved and validated again before the next request.
 */
export async function downloadPublicHttps(
  rawUrl: string,
  maxBytes: number,
  deps: PublicDownloadDeps = {},
): Promise<PublicDownload | null> {
  const resolveTarget = deps.resolve ?? resolvePublicHttpsTarget;
  const requestTarget = deps.request ?? requestPinnedHttps;

  let current = rawUrl;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const target = await resolveTarget(current);
    if (target === null) return null;

    const step = await requestTarget(target, maxBytes);
    if (step.kind === 'ok') return step.value;
    if (step.kind === 'failed' || redirects === MAX_REDIRECTS) return null;

    try {
      current = new URL(step.location, target.url).toString();
    } catch {
      return null;
    }
  }

  return null;
}
