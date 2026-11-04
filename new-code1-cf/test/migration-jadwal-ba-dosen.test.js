import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import migrationSql from '../migrations/2026-11-04-jadwal-ba-dosen.sql?raw';

const statements = String(migrationSql)
  .replace(/--[^\n]*/g, '')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

async function simulatePreMigration() {
  await env.DB.prepare('DROP TABLE IF EXISTS ba_dosen').run();
  await env.DB.prepare('DROP TABLE IF EXISTS jadwal_dosen').run();
  await env.DB.prepare('DROP TABLE IF EXISTS berita_acara').run();
  await env.DB.prepare('DROP TABLE IF EXISTS jadwal_pelaksanaan').run();
  await env.DB.prepare(
    'CREATE TABLE jadwal_pelaksanaan (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, jadwal_id TEXT, bagian TEXT, blok TEXT, ' +
      'nama_kegiatan TEXT, kegiatan_key TEXT, tanggal TEXT, jam TEXT, dosen TEXT, catatan TEXT, active INTEGER DEFAULT 1)'
  ).run();
  await env.DB.prepare(
    'CREATE TABLE berita_acara (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, bagian TEXT, blok TEXT, ' +
      'nama_kegiatan TEXT, tanggal_pelaksanaan TEXT, jam TEXT, dosen TEXT, catatan TEXT, sumber TEXT, kegiatan_key TEXT)'
  ).run();
}

async function runMigration() {
  for (const stmt of statements) {
    try {
      await env.DB.prepare(stmt).run();
    } catch (e) {
      if (String(e && e.message).indexOf('already exists') === -1) throw e;
    }
  }
}

async function tableInfo(table) {
  const rows = await env.DB.prepare('PRAGMA table_info(' + table + ')').all();
  return rows.results || [];
}

describe('migrasi multi-dosen jadwal & BA', () => {
  it('membuat tabel jadwal_dosen dan ba_dosen', async () => {
    await simulatePreMigration();
    await runMigration();
    const jadwalCols = (await tableInfo('jadwal_dosen')).map((r) => r.name);
    const baCols = (await tableInfo('ba_dosen')).map((r) => r.name);
    expect(jadwalCols).toEqual(expect.arrayContaining(['timestamp', 'jadwal_id', 'nama', 'nama_key', 'urutan']));
    expect(baCols).toEqual(expect.arrayContaining(['timestamp', 'ba_id', 'nama', 'nama_key', 'urutan']));
  });

  it('mengisi ulang dosen lama menjadi satu baris relasi', async () => {
    await simulatePreMigration();
    await env.DB.prepare(
      "INSERT INTO jadwal_pelaksanaan (timestamp,jadwal_id,bagian,blok,nama_kegiatan,kegiatan_key,tanggal,jam,dosen,catatan,active) VALUES ('2026-10-01T08:00:00','JDW-2026-0001','SGD','A','SGD 1','sgd|a|sgd 1','2026-10-02','09:00','dr. Andi','',1)"
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jam,dosen,catatan,sumber,kegiatan_key) VALUES ('2026-10-02T09:00:00','BA-PEL-2026-0001','SGD','A','SGD 1','2026-10-02','09:00','dr. Budi','','Bagian','sgd|a|sgd 1')"
    ).run();
    await runMigration();
    const jd = await env.DB.prepare('SELECT nama, nama_key, urutan FROM jadwal_dosen WHERE jadwal_id=?1').bind('JDW-2026-0001').all();
    expect(jd.results).toHaveLength(1);
    expect(jd.results[0].nama).toBe('dr. Andi');
    expect(jd.results[0].nama_key).toBe('dr. andi');
    expect(Number(jd.results[0].urutan)).toBe(1);
    const bd = await env.DB.prepare('SELECT nama FROM ba_dosen WHERE ba_id=?1').bind('BA-PEL-2026-0001').all();
    expect(bd.results).toHaveLength(1);
    expect(bd.results[0].nama).toBe('dr. Budi');
  });

  it('idempoten saat dijalankan ulang', async () => {
    await simulatePreMigration();
    await env.DB.prepare(
      "INSERT INTO jadwal_pelaksanaan (timestamp,jadwal_id,bagian,blok,nama_kegiatan,kegiatan_key,tanggal,jam,dosen,catatan,active) VALUES ('2026-10-01T08:00:00','JDW-2026-0001','SGD','A','SGD 1','sgd|a|sgd 1','2026-10-02','09:00','dr. Andi','',1)"
    ).run();
    await runMigration();
    await runMigration();
    const rows = await env.DB.prepare('SELECT COUNT(*) AS n FROM jadwal_dosen WHERE jadwal_id=?1').bind('JDW-2026-0001').first();
    expect(Number(rows.n)).toBe(1);
  });
});
