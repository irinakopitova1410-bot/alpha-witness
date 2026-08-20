import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 8_000;

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return true;
  const [a, b, c] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99))) || (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0 && c === 113) || a >= 224;
}
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized.startsWith('::ffff:')) return isPrivateIPv4(normalized.slice(7));
  return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb') || normalized.startsWith('ff');
}
export function isBlockedAddress(ip: string): boolean { return net.isIP(ip) === 4 ? isPrivateIPv4(ip) : net.isIP(ip) === 6 ? isPrivateIPv6(ip) : true; }
export async function assertPublicHostname(hostname: string): Promise<void> {
  const lower = hostname.toLowerCase().replace(/\.$/, '');
  if (lower === 'localhost' || lower.endsWith('.localhost') || lower.endsWith('.local') || lower.endsWith('.internal') || net.isIP(lower) && isBlockedAddress(lower)) throw new Error('BLOCKED_PRIVATE_ADDRESS');
  const records = await dns.lookup(lower, { all: true, verbatim: true });
  if (!records.length || records.some((record) => isBlockedAddress(record.address))) throw new Error('BLOCKED_PRIVATE_ADDRESS');
}
export async function assertSafeUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('UNSAFE_URL');
  await assertPublicHostname(url.hostname);
  return url;
}
export async function fetchPublicUrl(raw: string, init: { accept?: string } = {}): Promise<{ url: string; contentType: string; bytes: Uint8Array; status: number }> {
  let current = await assertSafeUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(current, { redirect: 'manual', signal: controller.signal, headers: { 'User-Agent': 'AlphaWitness/0.1 (+evidence-research)', Accept: init.accept ?? 'text/html,application/pdf;q=0.9,*/*;q=0.1' } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new Error('REDIRECT_WITHOUT_LOCATION');
        current = await assertSafeUrl(new URL(location, current).toString());
        continue;
      }
      const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const declared = Number(response.headers.get('content-length') || 0);
      if (declared > MAX_BYTES) throw new Error('SOURCE_TOO_LARGE');
      if (!response.ok) throw new Error(`SOURCE_HTTP_${response.status}`);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('EMPTY_RESPONSE');
      const chunks: Uint8Array[] = []; let total = 0;
      while (true) { const part = await reader.read(); if (part.done) break; total += part.value.byteLength; if (total > MAX_BYTES) { await reader.cancel(); throw new Error('SOURCE_TOO_LARGE'); } chunks.push(part.value); }
      const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return { url: current.toString(), contentType, bytes, status: response.status };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') throw new Error('SOURCE_TIMEOUT');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  throw new Error('TOO_MANY_REDIRECTS');
}
