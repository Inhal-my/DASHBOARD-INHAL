const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DEFAULT_PERIOD = 30;
const DEFAULT_DIGITS = 6;

export function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input) {
  const clean = String(input || '').toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Base32 tidak valid.');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
    value &= (1 << bits) - 1;
  }
  return new Uint8Array(out);
}

export function generateTotpSecret(byteLength = 20) {
  return base32Encode(crypto.getRandomValues(new Uint8Array(byteLength)));
}

function counterBytes(counter) {
  const bytes = new Uint8Array(8);
  let value = Math.floor(counter);
  for (let i = 7; i >= 0; i--) {
    bytes[i] = value & 255;
    value = Math.floor(value / 256);
  }
  return bytes;
}

function timingSafeEqual(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

async function hmacSha1(secret, counter) {
  const key = await crypto.subtle.importKey(
    'raw', base32Decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes(counter)));
}

export async function totp(secret, timeMs = Date.now(), period = DEFAULT_PERIOD, digits = DEFAULT_DIGITS) {
  const counter = Math.floor(timeMs / 1000 / period);
  const hash = await hmacSha1(secret, counter);
  const offset = hash[hash.length - 1] & 15;
  const binary = ((hash[offset] & 127) << 24)
    | ((hash[offset + 1] & 255) << 16)
    | ((hash[offset + 2] & 255) << 8)
    | (hash[offset + 3] & 255);
  return String(binary % (10 ** digits)).padStart(digits, '0');
}

export async function verifyTotp(secret, code, options = {}) {
  const now = options.now === undefined ? Date.now() : options.now;
  const period = options.period || DEFAULT_PERIOD;
  const digits = options.digits || DEFAULT_DIGITS;
  const window = options.window === undefined ? 1 : options.window;
  const clean = String(code || '').replace(/\s+/g, '');
  if (!new RegExp('^\\d{' + digits + '}$').test(clean)) return { ok: false };
  const step = Math.floor(now / 1000 / period);
  for (let offset = -window; offset <= window; offset++) {
    const candidateStep = step + offset;
    if (candidateStep < 0) continue;
    const candidate = await totp(secret, candidateStep * period * 1000, period, digits);
    if (timingSafeEqual(candidate, clean)) return { ok: true, step: candidateStep };
  }
  return { ok: false };
}
