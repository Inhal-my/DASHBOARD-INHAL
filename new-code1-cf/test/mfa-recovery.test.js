import { describe, it, expect } from 'vitest';
import {
  generateRecoveryCodes, normalizeRecoveryCode, hashRecoveryCode, findRecoveryCode
} from '../src/mfa/recovery.js';

describe('recovery code', () => {
  it('menghasilkan kode unik dengan format yang mudah dibaca', () => {
    const codes = generateRecoveryCodes(8);
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const code of codes) expect(code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  });

  it('menormalkan huruf kecil, spasi, dan tanda hubung', () => {
    expect(normalizeRecoveryCode(' abcd-ef123 ')).toBe('ABCDEF123');
    expect(normalizeRecoveryCode('ABCD EF123')).toBe('ABCDEF123');
  });

  it('hash deterministik dan tidak menyimpan kode asli', async () => {
    const a = await hashRecoveryCode('ABCDE-12345');
    const b = await hashRecoveryCode('abcde 12345');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain('ABCDE');
  });

  it('menemukan indeks kode yang cocok dan menolak yang tidak cocok', async () => {
    const codes = generateRecoveryCodes(4);
    const hashes = await Promise.all(codes.map(hashRecoveryCode));
    expect(await findRecoveryCode(codes[2], hashes)).toBe(2);
    expect(await findRecoveryCode('ZZZZZ-ZZZZZ', hashes)).toBe(-1);
    expect(await findRecoveryCode('', hashes)).toBe(-1);
  });
});
