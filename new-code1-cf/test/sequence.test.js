import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { nextIdNumber } from '../src/sequence.js';

describe('nextIdNumber', () => {
  it('starts at seed + 1 and increments atomically', async () => {
    expect(await nextIdNumber(env.DB, 'ba:BA-PEL-2026-', 3)).toBe(4);
    expect(await nextIdNumber(env.DB, 'ba:BA-PEL-2026-', 3)).toBe(5);
    expect(await nextIdNumber(env.DB, 'ba:BA-PEL-2026-', 3)).toBe(6);
  });

  it('self-heals when the stored counter falls behind the seed', async () => {
    expect(await nextIdNumber(env.DB, 'x', 0)).toBe(1);
    expect(await nextIdNumber(env.DB, 'x', 10)).toBe(11);
    expect(await nextIdNumber(env.DB, 'x', 10)).toBe(12);
  });

  it('keeps separate counters per scope', async () => {
    expect(await nextIdNumber(env.DB, 'a', 0)).toBe(1);
    expect(await nextIdNumber(env.DB, 'b', 0)).toBe(1);
    expect(await nextIdNumber(env.DB, 'a', 0)).toBe(2);
  });

  it('rejects an empty scope', async () => {
    await expect(nextIdNumber(env.DB, '  ', 0)).rejects.toThrow();
  });
});
