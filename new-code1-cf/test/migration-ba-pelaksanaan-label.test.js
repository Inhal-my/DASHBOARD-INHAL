import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import migrationSql from '../migrations/2026-10-15-ba-pelaksanaan-label.sql?raw';

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
      'file_name TEXT, file_url TEXT, catatan TEXT, sumber TEXT, kegiatan_key TEXT)'
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

describe('migrasi label BA Pelaksanaan', () => {
  it('menambah kolom label', async () => {
    await simulatePreMigration();
    await runMigration();
    expect(await columnInfo('berita_acara', 'label')).toBeTruthy();
  });

  it('tidak menimpa label yang sudah terisi (idempotent)', async () => {
    await simulatePreMigration();
    await runMigration();
    await env.DB.prepare(
      "INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,sumber,kegiatan_key,label) VALUES ('2026-10-01T08:00:00','BA-PEL-2026-0001','SGD','A','SGD 1','2026-10-01','Bagian','sgd|a|sgd 1','Sesi 1')"
    ).run();
    await runMigration();
    const row = await env.DB.prepare("SELECT label FROM berita_acara WHERE ba_id='BA-PEL-2026-0001'").first();
    expect(row.label).toBe('Sesi 1');
  });
});
