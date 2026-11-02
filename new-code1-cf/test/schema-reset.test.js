import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import schemaSql from '../schema.sql?raw';

const statements = String(schemaSql)
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.replace(/--[^\n]*/g, '').trim());

async function applySchema() {
  for (const stmt of statements) {
    await env.DB.prepare(stmt).run();
  }
}

describe('schema.sql dapat dijalankan ulang (reset)', () => {
  it('tidak gagal saat skema sudah ada', async () => {
    await expect(applySchema()).resolves.toBeUndefined();
  });

  it('mengosongkan admin_mfa dan berita_acara_sesi, bukan menyisakan baris lama', async () => {
    await env.DB.prepare("INSERT INTO admin (password, nama) VALUES ('x','Admin Lama')").run();
    await env.DB.prepare("INSERT INTO admin_mfa (admin_id, secret) VALUES (1,'SECRET-LAMA')").run();
    await env.DB.prepare("INSERT INTO berita_acara (ba_id, bagian) VALUES ('BA-PEL-1','Anatomi')").run();
    await env.DB.prepare("INSERT INTO berita_acara_sesi (ba_id, jadwal_id) VALUES ('BA-PEL-1','JAD-1')").run();

    await applySchema();

    const mfa = await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_mfa').first();
    const sesi = await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara_sesi').first();
    const admin = await env.DB.prepare('SELECT COUNT(*) AS n FROM admin').first();
    const ba = await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara').first();
    expect(mfa.n).toBe(0);
    expect(sesi.n).toBe(0);
    expect(admin.n).toBe(0);
    expect(ba.n).toBe(0);
  });

  it('tetap memuat seed demo setelah reset', async () => {
    await applySchema();
    const mhs = await env.DB.prepare('SELECT COUNT(*) AS n FROM mahasiswa').first();
    expect(mhs.n).toBe(3);
  });
});
