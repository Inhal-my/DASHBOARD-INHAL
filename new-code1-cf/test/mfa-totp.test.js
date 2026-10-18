import { describe, it, expect } from 'vitest';
import {
  base32Encode, base32Decode, generateTotpSecret, totp, verifyTotp
} from '../src/mfa/totp.js';

const enc = (s) => new TextEncoder().encode(s);
const RFC_SECRET = base32Encode(enc('12345678901234567890'));

describe('base32', () => {
  it('melakukan encode dan decode bolak-balik', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255, 42]);
    expect(Array.from(base32Decode(base32Encode(bytes)))).toEqual(Array.from(bytes));
  });

  it('menghasilkan secret acak yang valid', () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Z2-7]+$/);
    expect(base32Decode(a).length).toBe(20);
  });

  it('menolak karakter base32 yang tidak valid', () => {
    expect(() => base32Decode('ABC1')).toThrow();
  });
});

describe('TOTP RFC 6238 (SHA-1, 8 digit)', () => {
  const vectors = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130']
  ];

  it.each(vectors)('waktu %i menghasilkan %s', async (secs, expected) => {
    expect(await totp(RFC_SECRET, secs * 1000, 30, 8)).toBe(expected);
  });
});

describe('verifyTotp', () => {
  const now = 1_700_000_000_000;

  it('menerima kode pada langkah saat ini', async () => {
    const code = await totp(RFC_SECRET, now);
    const res = await verifyTotp(RFC_SECRET, code, { now });
    expect(res.ok).toBe(true);
    expect(res.step).toBe(Math.floor(now / 1000 / 30));
  });

  it('menerima kode satu langkah sebelumnya dan menolak di luar jendela', async () => {
    const prev = await totp(RFC_SECRET, now - 30_000);
    expect((await verifyTotp(RFC_SECRET, prev, { now, window: 1 })).ok).toBe(true);
    expect((await verifyTotp(RFC_SECRET, prev, { now, window: 0 })).ok).toBe(false);
  });

  it('menolak kode salah atau format bukan 6 digit', async () => {
    expect((await verifyTotp(RFC_SECRET, '000000', { now })).ok).toBe(false);
    expect((await verifyTotp(RFC_SECRET, '12345', { now })).ok).toBe(false);
    expect((await verifyTotp(RFC_SECRET, '', { now })).ok).toBe(false);
  });
});
