import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import migrationSql from '../migrations/2026-10-15-ba-admin-base-file.sql?raw';

const statements = String(migrationSql)
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.replace(/--[^\n]*/g, '').trim());

async function simulatePreMigration() {
  await env.DB.prepare('DROP TABLE IF EXISTS berita_acara_admin').run();
  await env.DB.prepare(
    'CREATE TABLE berita_acara_admin (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, bagian TEXT, blok TEXT, ' +
      'nama_kegiatan TEXT, tanggal_pelaksanaan TEXT, jam TEXT, jumlah_peserta TEXT, file_name TEXT, ' +
      'file_url TEXT, catatan TEXT, sumber TEXT, kegiatan_key TEXT, updated_at TEXT, needs_regen INTEGER DEFAULT 0)'
  ).run();
}

async function columnInfo(table, name) {
  const rows = await env.DB.prepare('PRAGMA table_info(' + table + ')').all();
  return (rows.results || []).find((r) => r.name === name) || null;
}

async function runMigration() {
  for (const stmt of statements) {
    try {
      await env.DB.prepare(stmt).run();
    } catch (e) {
      if (String(e && e.message).indexOf('duplicate column name') === -1) throw e;
    }
  }
}

describe('migrasi dokumen dasar BA Pendukung', () => {
  it('menambah kolom base_file_url & base_file_name', async () => {
    await simulatePreMigration();
    await runMigration();
    expect(await columnInfo('berita_acara_admin', 'base_file_url')).toBeTruthy();
    expect(await columnInfo('berita_acara_admin', 'base_file_name')).toBeTruthy();
  });

  it('backfill base_file_url = file_url hanya untuk BA tanpa berkas aktif', async () => {
    await simulatePreMigration();
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jumlah_peserta,file_name,file_url,sumber,kegiatan_key) VALUES ('2026-10-01T08:00:00','BA-PEN-LEGACY','KKD','A','KKD 1','2026-10-01','1','old.pdf','https://drive/old','Admin','k1')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jumlah_peserta,file_name,file_url,sumber,kegiatan_key) VALUES ('2026-10-01T08:00:00','BA-PEN-EMPTY','KKD','A','KKD 2','2026-10-01','1','','', 'Admin','k2')"
    ).run();

    await runMigration();

    const legacy = await env.DB.prepare("SELECT base_file_url FROM berita_acara_admin WHERE ba_id='BA-PEN-LEGACY'").first();
    const empty = await env.DB.prepare("SELECT base_file_url FROM berita_acara_admin WHERE ba_id='BA-PEN-EMPTY'").first();
    expect(legacy.base_file_url).toBe('https://drive/old');
    expect(empty.base_file_url).toBe('');
  });

  it('tidak menimpa base_file_url yang sudah terisi (idempotent)', async () => {
    await simulatePreMigration();
    await runMigration();
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jumlah_peserta,file_name,file_url,base_file_url,sumber,kegiatan_key) VALUES ('2026-10-01T08:00:00','BA-PEN-1','KKD','A','KKD 1','2026-10-01','1','','https://drive/merged','https://drive/base','Admin','k1')"
    ).run();
    await runMigration();
    const row = await env.DB.prepare("SELECT base_file_url FROM berita_acara_admin WHERE ba_id='BA-PEN-1'").first();
    expect(row.base_file_url).toBe('https://drive/base');
  });
});
