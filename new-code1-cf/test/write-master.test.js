import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { verifyPassword, isHashed } from '../src/password.js';
import { getMasterDataMonitor } from '../src/read/dashboard.js';
import {
  saveMasterKegiatan, saveMasterBagian, saveMasterBiaya, saveConfig,
  saveBagianStaff, saveAdminList, saveBagianBaSettings
} from '../src/write/master.js';

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }) };
}

describe('master read mapping', () => {
  it('maps snake_case rows to client Title Case columns', async () => {
    await env.DB.prepare("INSERT INTO master_kegiatan (kategori, nilai) VALUES ('Blok','A')").run();
    const data = await getMasterDataMonitor(env.DB, await adminCtx());
    expect(data.masterKegiatan[0].Kategori).toBe('Blok');
    expect(data.masterKegiatan[0].Nilai).toBe('A');
    expect(data.config[0].Key).toBe('BUKTI_MODE');
    expect(data.config[0].Value).toBe('strict');
    expect(data.masterKegiatan[0].kategori).toBeUndefined();
  });

  it('requires an admin session', async () => {
    await expect(getMasterDataMonitor(env.DB, {})).rejects.toThrow();
  });
});

describe('master write handlers', () => {
  it('rejects writes without admin token', async () => {
    await expect(saveMasterKegiatan(env.DB, { rows: [] }, {})).rejects.toThrow();
    await expect(saveConfig(env.DB, { rows: [] }, {})).rejects.toThrow();
    await expect(saveBagianBaSettings(env.DB, { statuses: ['ACC'] }, {})).rejects.toThrow();
  });

  it('replaces master kegiatan rows and keeps only new data', async () => {
    await env.DB.prepare("INSERT INTO master_kegiatan (kategori, nilai) VALUES ('Lama','X')").run();
    const ctx = await adminCtx();
    const res = await saveMasterKegiatan(env.DB, {
      rows: [
        { Kategori: 'Blok', Nilai: 'A' },
        { kategori: 'Ujian', nilai: 'UAS' },
        { Kategori: '', Nilai: '' }
      ]
    }, ctx);
    expect(res.success).toBe(true);
    const { results } = await env.DB.prepare('SELECT kategori, nilai FROM master_kegiatan ORDER BY id').all();
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.kategori + ':' + r.nilai)).toEqual(['Blok:A', 'Ujian:UAS']);
  });

  it('replaces master bagian and master biaya', async () => {
    const ctx = await adminCtx();
    await saveMasterBagian(env.DB, {
      rows: [{ Lab: 'Lab Anatomi', 'Kegiatan Lab': 'Praktikum 1', Bagian: 'Anatomi', Email: 'a@x.id' }]
    }, ctx);
    await saveMasterBiaya(env.DB, { rows: [{ Kegiatan: 'Ujian', Biaya: 'Rp 300.000' }] }, ctx);
    const bagian = await env.DB.prepare('SELECT * FROM master_bagian').all();
    const biaya = await env.DB.prepare('SELECT * FROM master_biaya').all();
    expect(bagian.results).toHaveLength(1);
    expect(bagian.results[0].kegiatan_lab).toBe('Praktikum 1');
    expect(biaya.results[0].biaya).toBe('Rp 300.000');
  });

  it('dedupes config by key with last value winning', async () => {
    const ctx = await adminCtx();
    await saveConfig(env.DB, {
      rows: [
        { Key: 'BUKTI_MODE', Value: 'strict' },
        { Key: 'bukti_mode', Value: 'lenggang' },
        { Key: 'TEMA', Value: 'indigo' },
        { Key: '', Value: 'abaikan' }
      ]
    }, ctx);
    const { results } = await env.DB.prepare('SELECT key, value FROM config ORDER BY key').all();
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.key.toLowerCase() === 'bukti_mode').value).toBe('lenggang');
    expect(results.find((r) => r.key === 'TEMA').value).toBe('indigo');
  });

  it('replaces bagian staff and admin lists, skipping empty passwords', async () => {
    const ctx = await adminCtx();
    await saveBagianStaff(env.DB, {
      rows: [{ Email: 'a@x.id', Kategori: '*', Nama: 'Umum', Pass: 'rahasia' }, { Email: '', Pass: '' }]
    }, ctx);
    await saveAdminList(env.DB, {
      rows: [{ Password: 'p1', Nama: 'Admin 1' }, { Password: '', Nama: 'Kosong' }]
    }, ctx);
    const staff = await env.DB.prepare('SELECT * FROM bagian_staff').all();
    const admins = await env.DB.prepare('SELECT * FROM admin').all();
    expect(staff.results).toHaveLength(1);
    expect(staff.results[0].pass).toMatch(/^pbkdf2\$/);
    expect(await verifyPassword('rahasia', staff.results[0].pass)).toBe(true);
    expect(admins.results).toHaveLength(1);
    expect(admins.results[0].password).toMatch(/^pbkdf2\$/);
    expect(await verifyPassword('p1', admins.results[0].password)).toBe(true);
  });

  it('does not re-hash an already hashed password', async () => {
    const ctx = await adminCtx();
    await saveAdminList(env.DB, { rows: [{ Password: 'p1', Nama: 'Admin 1' }] }, ctx);
    const first = (await env.DB.prepare('SELECT password FROM admin').first()).password;
    expect(isHashed(first)).toBe(true);
    await saveAdminList(env.DB, { rows: [{ Password: first, Nama: 'Admin 1' }] }, ctx);
    const second = (await env.DB.prepare('SELECT password FROM admin').first()).password;
    expect(second).toBe(first);
  });

  it('validates and persists bagian BA settings', async () => {
    const ctx = await adminCtx();
    const bad = await saveBagianBaSettings(env.DB, { statuses: ['ACC', 'Ngawur'], finalOnly: true }, ctx);
    expect(bad.success).toBe(false);
    const empty = await saveBagianBaSettings(env.DB, { statuses: [], finalOnly: true }, ctx);
    expect(empty.success).toBe(false);
    const ok = await saveBagianBaSettings(env.DB, { statuses: ['Diterima', 'ACC', 'ACC'], finalOnly: false }, ctx);
    expect(ok.success).toBe(true);
    const row = await env.DB.prepare("SELECT value FROM config WHERE key = 'BAGIAN_BA_STATUSES'").first();
    expect(row.value).toBe('Diterima,ACC');
    const finalRow = await env.DB.prepare("SELECT value FROM config WHERE key = 'BAGIAN_BA_FINAL_ONLY'").first();
    expect(finalRow.value).toBe('false');
  });
});
