const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789';

function hex(bytes) {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

function timingSafeEqual(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

export function generateRecoveryCodes(count = 8) {
  const codes = [];
  const seen = new Set();
  while (codes.length < count) {
    const bytes = crypto.getRandomValues(new Uint8Array(10));
    let raw = '';
    for (const byte of bytes) raw += ALPHABET[byte % ALPHABET.length];
    const code = raw.slice(0, 5) + '-' + raw.slice(5);
    if (seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  return codes;
}

export function normalizeRecoveryCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function hashRecoveryCode(code) {
  const normalized = normalizeRecoveryCode(code);
  if (!normalized) throw new Error('Recovery code kosong.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return hex(new Uint8Array(digest));
}

export async function findRecoveryCode(code, hashes) {
  const normalized = normalizeRecoveryCode(code);
  if (!normalized) return -1;
  const target = await hashRecoveryCode(normalized);
  const list = Array.isArray(hashes) ? hashes : [];
  for (let i = 0; i < list.length; i++) {
    if (timingSafeEqual(target, String(list[i] || ''))) return i;
  }
  return -1;
}
