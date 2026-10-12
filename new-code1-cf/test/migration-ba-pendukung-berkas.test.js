import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import migrationSql from '../migrations/2026-10-12-ba-pendukung-berkas.sql?raw';

const statements = String(migrationSql)
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

async function columnNames(table) {
  const rows = await env.DB.prepare('PRAGMA table_info(' + table + ')').all();
  return (rows.results || []).map((r) => r.name);
}

async function columnInfo(table, name) {
  const rows = await env.DB.prepare('PRAGMA table_info(' + table + ')').all();
  return (rows.results || []).find((r) => r.name === name) || null;
}

async function simulatePreMigrationSchema() {
  await env.DB.prepare('DROP TABLE IF EXISTS berita_acara_admin_peserta').run();
  await env.DB.prepare('DROP TABLE IF EXISTS berita_acara_admin').run();
  await env.DB.prepare('DROP TABLE IF EXISTS berita_acara_admin_berkas').run();
  await env.DB.prepare(
    'CREATE TABLE berita_acara_admin (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, bagian TEXT, blok TEXT, ' +
      'nama_kegiatan TEXT, tanggal_pelaksanaan TEXT, jam TEXT, jumlah_peserta TEXT, file_name TEXT, ' +
      'file_url TEXT, catatan TEXT, sumber TEXT, kegiatan_key TEXT)'
  ).run();
  await env.DB.prepare(
    'CREATE TABLE berita_acara_admin_peserta (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, id_pengajuan TEXT, npm TEXT, ' +
      'nama_lengkap TEXT, blok TEXT, bagian TEXT, status_pengajuan TEXT)'
  ).run();
}

describe('migrasi ba-pendukung-berkas', () => {
  it('menambah kolom/tabel baru tanpa kehilangan data lama', async () => {
    await simulatePreMigrationSchema();

    await env.DB.prepare(
      "INSERT INTO berita_acara_admin (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jam,jumlah_peserta,file_name,file_url,catatan,sumber,kegiatan_key) " +
        "VALUES ('2026-09-11T08:00:00','BA-2026-0001','SGD','A','SGD 1','2026-09-20','','1','','','','Admin','sgd|a|sgd 1')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok,bagian,status_pengajuan) " +
        "VALUES ('2026-09-11T08:00:00','BA-2026-0001','INHAL-1','2201010001','Aisyah','A','SGD','Diterima')"
    ).run();

    for (const stmt of statements) await env.DB.prepare(stmt).run();

    const adminCols = await columnNames('berita_acara_admin');
    expect(adminCols).toContain('updated_at');
    expect(adminCols).toContain('needs_regen');

    const pesertaCols = await columnNames('berita_acara_admin_peserta');
    expect(pesertaCols).toContain('urutan');
    expect(pesertaCols).toContain('active');

    const berkasCols = await columnNames('berita_acara_admin_berkas');
    expect(berkasCols).toContain('ba_id');
    expect(berkasCols).toContain('page_index');
    expect(berkasCols).toContain('superseded_at');

    const admin = await env.DB.prepare('SELECT * FROM berita_acara_admin').first();
    expect(admin.ba_id).toBe('BA-2026-0001');
    expect(admin.nama_kegiatan).toBe('SGD 1');
    expect(Number(admin.needs_regen)).toBe(0);

    const peserta = await env.DB.prepare('SELECT * FROM berita_acara_admin_peserta').first();
    expect(peserta.npm).toBe('2201010001');
    expect(peserta.nama_lengkap).toBe('Aisyah');
    expect(Number(peserta.active)).toBe(1);

    await env.DB.prepare(
      "INSERT INTO berita_acara_admin_berkas (timestamp,ba_id,id_pengajuan,npm,urutan,page_index,file_name,file_url,active) " +
        "VALUES ('2026-10-12T08:00:00','BA-2026-0001','INHAL-1','2201010001',1,0,'p1.jpg','https://drive/1',1)"
    ).run();
    const berkas = await env.DB.prepare('SELECT * FROM berita_acara_admin_berkas').first();
    expect(berkas.file_url).toBe('https://drive/1');
    expect(Number(berkas.active)).toBe(1);
  });

  it('default kolom baru terdefinisi pada pragma', async () => {
    await simulatePreMigrationSchema();
    for (const stmt of statements) await env.DB.prepare(stmt).run();

    const needsRegen = await columnInfo('berita_acara_admin', 'needs_regen');
    expect(String(needsRegen.dflt_value)).toBe('0');

    const active = await columnInfo('berita_acara_admin_peserta', 'active');
    expect(String(active.dflt_value)).toBe('1');
  });
});
