import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import migrationSql from '../migrations/2026-10-16-jadwal-pelaksanaan.sql?raw';

const statements = String(migrationSql)
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.replace(/--[^\n]*/g, '').trim());

async function simulatePreMigration() {
  await env.DB.prepare('DROP TABLE IF EXISTS jadwal_peserta').run();
  await env.DB.prepare('DROP TABLE IF EXISTS jadwal_pelaksanaan').run();
  await env.DB.prepare('DROP TABLE IF EXISTS berita_acara').run();
  await env.DB.prepare(
    'CREATE TABLE berita_acara (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, bagian TEXT, blok TEXT, ' +
      'nama_kegiatan TEXT, tanggal_pelaksanaan TEXT, jam TEXT, dosen TEXT, jumlah_peserta TEXT, ' +
      'file_name TEXT, file_url TEXT, catatan TEXT, sumber TEXT, kegiatan_key TEXT, label TEXT DEFAULT \'\')'
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

describe('migrasi jadwal pelaksanaan', () => {
  it('membuat tabel jadwal dan menambah kolom jadwal_id', async () => {
    await simulatePreMigration();
    await runMigration();
    await env.DB.prepare("INSERT INTO jadwal_pelaksanaan (timestamp,jadwal_id,bagian,blok,nama_kegiatan,kegiatan_key,tanggal,jam,dosen,active) VALUES ('2026-10-01T08:00:00','JDW-2026-0001','SGD','A','SGD 1','sgd|a|sgd 1','2026-10-02','09:00','dr. Andi',1)").run();
    await env.DB.prepare("INSERT INTO jadwal_peserta (timestamp,jadwal_id,id_pengajuan,npm) VALUES ('2026-10-01T08:00:00','JDW-2026-0001','INHAL-1','2201010001')").run();
    const j = await env.DB.prepare("SELECT jadwal_id FROM jadwal_pelaksanaan WHERE jadwal_id='JDW-2026-0001'").first();
    expect(j.jadwal_id).toBe('JDW-2026-0001');
    expect(await columnInfo('berita_acara', 'jadwal_id')).toBeTruthy();
  });

  it('idempotent (dapat dijalankan dua kali)', async () => {
    await simulatePreMigration();
    await runMigration();
    await runMigration();
    expect(await columnInfo('berita_acara', 'jadwal_id')).toBeTruthy();
  });
});
