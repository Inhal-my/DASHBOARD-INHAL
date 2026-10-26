import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import migrationSql from '../migrations/2026-10-27-ba-pelaksanaan-sesi.sql?raw';

const statements = String(migrationSql)
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.replace(/--[^\n]*/g, '').trim());

async function simulatePreMigration() {
  await env.DB.prepare('DROP TABLE IF EXISTS berita_acara_sesi').run();
}

async function runMigration() {
  for (const stmt of statements) {
    await env.DB.prepare(stmt).run();
  }
}

async function sesiRows() {
  const rows = await env.DB.prepare('SELECT ba_id, jadwal_id, urutan FROM berita_acara_sesi ORDER BY jadwal_id').all();
  return rows.results || [];
}

async function insertBa(baId, jadwalId) {
  await env.DB.prepare(
    'INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,sumber,kegiatan_key,jadwal_id) ' +
      "VALUES ('2026-10-01T08:00:00',?1,'SGD','A','SGD 1','2026-10-01','Bagian','sgd|a|sgd 1',?2)"
  ).bind(baId, jadwalId).run();
}

describe('migrasi BA Pelaksanaan multi-sesi', () => {
  it('membuat tabel tautan sesi', async () => {
    await simulatePreMigration();
    await runMigration();
    const rows = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='berita_acara_sesi'").all();
    expect((rows.results || []).length).toBe(1);
  });

  it('mengisi tautan dari berita_acara.jadwal_id yang lama', async () => {
    await simulatePreMigration();
    await insertBa('BA-PEL-2026-0001', 'j1');
    await insertBa('BA-PEL-2026-0002', 'j2');
    await insertBa('BA-PEL-2026-0003', '');
    await runMigration();
    expect(await sesiRows()).toEqual([
      { ba_id: 'BA-PEL-2026-0001', jadwal_id: 'j1', urutan: 1 },
      { ba_id: 'BA-PEL-2026-0002', jadwal_id: 'j2', urutan: 1 }
    ]);
  });

  it('idempotent saat dijalankan ulang', async () => {
    await simulatePreMigration();
    await insertBa('BA-PEL-2026-0001', 'j1');
    await runMigration();
    await runMigration();
    expect((await sesiRows()).length).toBe(1);
  });

  it('tetap aman saat satu jadwal muncul di dua BA lama', async () => {
    await simulatePreMigration();
    await insertBa('BA-PEL-2026-0001', 'j1');
    await insertBa('BA-PEL-2026-0002', 'j1');
    await runMigration();
    expect(await sesiRows()).toEqual([
      { ba_id: 'BA-PEL-2026-0001', jadwal_id: 'j1', urutan: 1 }
    ]);
  });

  it('menjaga satu jadwal hanya tertaut ke satu BA', async () => {
    await simulatePreMigration();
    await runMigration();
    await env.DB.prepare(
      "INSERT INTO berita_acara_sesi (timestamp,ba_id,jadwal_id,urutan) VALUES ('2026-10-01T08:00:00','BA-PEL-2026-0001','j1',1)"
    ).run();
    let message = '';
    try {
      await env.DB.prepare(
        "INSERT INTO berita_acara_sesi (timestamp,ba_id,jadwal_id,urutan) VALUES ('2026-10-01T09:00:00','BA-PEL-2026-0002','j1',1)"
      ).run();
    } catch (e) {
      message = String(e && e.message);
    }
    expect(message.toUpperCase()).toContain('UNIQUE');
  });
});
