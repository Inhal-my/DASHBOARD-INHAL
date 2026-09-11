// PBKDF2 iteration count. Kept low so hashing fits within the Cloudflare Workers
// CPU budget (the free/paid per-request CPU limits are tight). Raise this on a
// plan with more CPU headroom; the stored format carries the count so old hashes
// keep verifying.
const ITERATIONS = 1000;
const KEY_BITS = 256;
const PREFIX = 'pbkdf2';

function toB64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromB64(value) {
  const bin = atob(String(value || ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
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

export function isHashed(value) {
  return /^pbkdf2\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/.test(String(value || ''));
}

async function derive(plain, salt, iterations) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(String(plain || '')), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' }, key, KEY_BITS
  );
  return new Uint8Array(bits);
}

export async function hashPassword(plain) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(plain, salt, ITERATIONS);
  return PREFIX + '$' + ITERATIONS + '$' + toB64(salt) + '$' + toB64(hash);
}

export async function verifyPassword(plain, stored) {
  const s = String(stored || '').trim();
  if (!s) return false;
  if (!isHashed(s)) return s === String(plain || '').trim();
  const parts = s.split('$');
  const iterations = parseInt(parts[1], 10) || ITERATIONS;
  const hash = await derive(plain, fromB64(parts[2]), iterations);
  return timingSafeEqual(toB64(hash), parts[3]);
}
