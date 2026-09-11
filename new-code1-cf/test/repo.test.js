import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { getMasterOptions, getBuktiMode, getStudentNameByNpm, getBagianMap, findDuplicatePengajuan } from '../src/repo.js';

describe('repo reads', () => {
  it('returns master options by kategori (case-insensitive)', async () => {
    expect(await getMasterOptions(env.DB, 'Ujian')).toEqual(['UAS', 'UTS']);
    expect(await getMasterOptions(env.DB, 'ujian')).toEqual(['UAS', 'UTS']);
  });
  it('returns bukti mode', async () => {
    expect(await getBuktiMode(env.DB)).toBe('strict');
  });
  it('reads bukti mode case-insensitively', async () => {
    await env.DB.prepare("UPDATE config SET value = 'Lenggang' WHERE key = 'BUKTI_MODE'").run();
    expect(await getBuktiMode(env.DB)).toBe('lenggang');
  });
  it('returns student name by npm', async () => {
    expect(await getStudentNameByNpm(env.DB, '2201010001')).toBe('Aisyah Putri');
    expect(await getStudentNameByNpm(env.DB, '000')).toBe('');
  });
  it('returns bagian map', async () => {
    const map = await getBagianMap(env.DB);
    expect(map.get('lab anatomi|praktikum 1')).toBe('Anatomi');
  });
  it('detects no duplicate initially', async () => {
    expect(await findDuplicatePengajuan(env.DB, '1||ujian||uas||2026-09-20')).toBe(false);
  });
});
