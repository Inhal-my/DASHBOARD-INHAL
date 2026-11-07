import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import migrationSql from '../migrations/2026-11-07-activity-log-indexes.sql?raw';

const statements = String(migrationSql)
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.replace(/--[^\n]*/g, '').trim());

async function indexNames() {
  const rows = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%_timestamp' ORDER BY name"
  ).all();
  return (rows.results || []).map((r) => r.name);
}

describe('migrasi index Riwayat Log', () => {
  it('aman dijalankan berulang (IF NOT EXISTS)', async () => {
    for (const stmt of statements) await env.DB.prepare(stmt).run();
    for (const stmt of statements) await env.DB.prepare(stmt).run();
    expect(await indexNames()).toEqual([
      'idx_audit_log_timestamp',
      'idx_history_timestamp',
      'idx_log_upload_timestamp'
    ]);
  });
});
