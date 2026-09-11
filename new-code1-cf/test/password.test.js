import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, isHashed } from '../src/password.js';

describe('password hashing', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('rahasia');
    expect(isHashed(hash)).toBe(true);
    expect(hash).not.toContain('rahasia');
    expect(await verifyPassword('rahasia', hash)).toBe(true);
    expect(await verifyPassword('salah', hash)).toBe(false);
  });

  it('supports legacy plaintext comparison', async () => {
    expect(isHashed('rahasia')).toBe(false);
    expect(await verifyPassword('rahasia', 'rahasia')).toBe(true);
    expect(await verifyPassword('rahasia', 'lain')).toBe(false);
    expect(await verifyPassword('rahasia', '')).toBe(false);
  });

  it('produces a different salt each time', async () => {
    const a = await hashPassword('x');
    const b = await hashPassword('x');
    expect(a).not.toBe(b);
    expect(await verifyPassword('x', a)).toBe(true);
    expect(await verifyPassword('x', b)).toBe(true);
  });
});
