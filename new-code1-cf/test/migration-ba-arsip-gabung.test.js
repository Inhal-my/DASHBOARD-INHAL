import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import migrationSql from '../migrations/2026-11-17-ba-arsip-gabung.sql?raw';

const statements = String(migrationSql)
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.replace(/--[^\n]*/g, '').trim());

async function simulatePreMigration() {
  await env.DB.prepare('DROP TABLE IF EXISTS berita_acara').run();
  await env.DB.prepare(
    'CREATE TABLE berita_acara (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, bagian TEXT, blok TEXT, ' +
      'nama_kegiatan TEXT, tanggal_pelaksanaan TEXT, jam TEXT, dosen TEXT, jumlah_peserta TEXT, ' +
      'file_name TEXT, file_url TEXT, catatan TEXT, sumber TEXT, kegiatan_key TEXT, label TEXT DEFAULT \'\', ' +
      'jadwal_id TEXT DEFAULT \'\')'
  ).run();
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

async function columnInfo(table, name) {
  const rows = await env.DB.prepare('PRAGMA table_info(' + table + ')').all();
  return (rows.results || []).find((r) => r.name === name) || null;
}

describe('migrasi arsip dan gabung BA', () => {
  it('menambah kolom arsip, pembaruan, dan revisi', async () => {
    await simulatePreMigration();
    await runMigration();
    for (const name of ['archived_at', 'archived_by', 'archive_reason', 'merged_into', 'updated_at', 'revision']) {
      expect(await columnInfo('berita_acara', name)).toBeTruthy();
    }
  });

  it('mengisi default tanpa menimpa arsip yang sudah ada saat dijalankan ulang', async () => {
    await simulatePreMigration();
    await runMigration();
    await env.DB.prepare(
      "INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,sumber,kegiatan_key) " +
      "VALUES ('2026-10-01T08:00:00','BA-PEL-2026-0001','SGD','A','SGD 1','2026-10-01','Bagian','sgd|a|sgd 1')"
    ).run();
    await runMigration();
    const initial = await env.DB.prepare("SELECT revision, archived_at FROM berita_acara WHERE ba_id='BA-PEL-2026-0001'").first();
    expect(Number(initial.revision)).toBe(0);
    expect(String(initial.archived_at || '')).toBe('');

    await env.DB.prepare(
      "UPDATE berita_acara SET archived_at='2026-11-17T10:00:00', archived_by='Admin', archive_reason='gabung' WHERE ba_id='BA-PEL-2026-0001'"
    ).run();
    await runMigration();
    const after = await env.DB.prepare("SELECT archived_at, archived_by FROM berita_acara WHERE ba_id='BA-PEL-2026-0001'").first();
    expect(after.archived_at).toBe('2026-11-17T10:00:00');
    expect(after.archived_by).toBe('Admin');
  });
});
