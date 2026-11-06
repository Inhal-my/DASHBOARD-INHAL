import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import migrationSql from '../migrations/2026-11-06-ba-admin-berkas-scope.sql?raw';

const statements = String(migrationSql)
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.replace(/--[^\n]*/g, '').trim());

async function simulatePreMigration() {
  await env.DB.prepare('DROP TABLE IF EXISTS berita_acara_admin_berkas').run();
  await env.DB.prepare(
    'CREATE TABLE berita_acara_admin_berkas (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, id_pengajuan TEXT, npm TEXT, ' +
      'urutan INTEGER, page_index INTEGER, file_name TEXT, file_url TEXT, page_count INTEGER DEFAULT 1, ' +
      'byte_size INTEGER DEFAULT 0, active INTEGER DEFAULT 1, superseded_at TEXT)'
  ).run();
  await env.DB.prepare(
    "INSERT INTO berita_acara_admin_berkas (timestamp, ba_id, id_pengajuan, npm, urutan, page_index, file_name, file_url, page_count, byte_size, active) " +
      "VALUES ('t', 'BA-1', 'P-1', '001', 1, 0, 'a.pdf', 'https://x/a.pdf', 1, 10, 1)"
  ).run();
  await env.DB.prepare(
    "INSERT INTO berita_acara_admin_berkas (timestamp, ba_id, id_pengajuan, npm, urutan, page_index, file_name, file_url, page_count, byte_size, active) " +
      "VALUES ('t', 'BA-1', 'P-2', '002', 2, 0, 'b.pdf', 'https://x/b.pdf', 1, 10, 1)"
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

describe('migrasi scope berkas BA Pendukung', () => {
  it('menambah kolom scope default peserta dan mem-backfill data lama', async () => {
    await simulatePreMigration();
    await runMigration();

    const col = await columnInfo('berita_acara_admin_berkas', 'scope');
    expect(col).toBeTruthy();
    expect(String(col.dflt_value || '')).toContain('peserta');

    const rows = (await env.DB.prepare('SELECT scope FROM berita_acara_admin_berkas ORDER BY id').all()).results || [];
    expect(rows.length).toBe(2);
    for (const r of rows) expect(r.scope).toBe('peserta');
  });

  it('membuat index (ba_id, scope, active)', async () => {
    await simulatePreMigration();
    await runMigration();

    const idx = (await env.DB.prepare("PRAGMA index_list('berita_acara_admin_berkas')").all()).results || [];
    const names = idx.map((r) => r.name);
    expect(names).toContain('idx_ba_admin_berkas_ba_scope_active');

    const cols = (await env.DB.prepare("PRAGMA index_info('idx_ba_admin_berkas_ba_scope_active')").all()).results || [];
    const colNames = cols.map((r) => r.name);
    expect(colNames.slice(0, 3)).toEqual(['ba_id', 'scope', 'active']);
  });

  it('aman dijalankan dua kali', async () => {
    await simulatePreMigration();
    await runMigration();
    await runMigration();
    const rows = (await env.DB.prepare("SELECT COUNT(*) AS n FROM berita_acara_admin_berkas WHERE scope = 'peserta'").all()).results || [];
    expect(rows[0].n).toBe(2);
  });
});
