import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import migrationSql from '../migrations/2026-10-12-ba-pendukung-byte-size.sql?raw';

const statements = String(migrationSql).split(';').map((s) => s.trim()).filter(Boolean);

async function columnInfo(table, name) {
  const rows = await env.DB.prepare('PRAGMA table_info(' + table + ')').all();
  return (rows.results || []).find((r) => r.name === name) || null;
}

async function simulatePreMigrationBerkas() {
  await env.DB.prepare('DROP TABLE IF EXISTS berita_acara_admin_berkas').run();
  await env.DB.prepare(
    'CREATE TABLE berita_acara_admin_berkas (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, id_pengajuan TEXT, npm TEXT, ' +
      'urutan INTEGER, page_index INTEGER, file_name TEXT, file_url TEXT, ' +
      'page_count INTEGER DEFAULT 1, active INTEGER DEFAULT 1, superseded_at TEXT)'
  ).run();
}

describe('migrasi ba-pendukung-byte-size', () => {
  it('menambah kolom byte_size default 0 tanpa kehilangan data lama', async () => {
    await simulatePreMigrationBerkas();
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin_berkas (timestamp,ba_id,id_pengajuan,npm,urutan,page_index,file_name,file_url,page_count,active) VALUES ('2026-10-12T00:00:00','BA-PEN-2026-0001','INHAL-1','2201010001',1,0,'p1.jpg','https://drive/1',1,1)"
    ).run();

    for (const stmt of statements) await env.DB.prepare(stmt).run();

    const info = await columnInfo('berita_acara_admin_berkas', 'byte_size');
    expect(info).toBeTruthy();
    expect(String(info.dflt_value)).toBe('0');

    const row = await env.DB.prepare('SELECT file_url, byte_size FROM berita_acara_admin_berkas').first();
    expect(row.file_url).toBe('https://drive/1');
    expect(Number(row.byte_size)).toBe(0);
  });
});
