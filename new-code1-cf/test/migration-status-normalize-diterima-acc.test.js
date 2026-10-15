import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import migrationSql from '../migrations/2026-10-15-status-normalize-diterima-acc.sql?raw';

const statements = String(migrationSql)
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.replace(/--[^\n]*/g, '').trim());

async function applyMigration() {
  for (const stmt of statements) await env.DB.prepare(stmt).run();
}

describe('migrasi normalisasi Diterima -> ACC', () => {
  it('mengubah status pengajuan dan status_history Diterima menjadi ACC', async () => {
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-10-01T08:00:00','INHAL-1','1001','A','A','SGD','Diterima')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-10-01T08:00:00','INHAL-2','1002','B','A','SGD','ACC')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO status_history (timestamp,id_pengajuan,status,catatan,actor_email) VALUES ('2026-10-01T08:00:00','INHAL-1','Diterima','','Admin')"
    ).run();

    await applyMigration();

    const p1 = await env.DB.prepare("SELECT status FROM pengajuan WHERE id_pengajuan='INHAL-1'").first();
    const p2 = await env.DB.prepare("SELECT status FROM pengajuan WHERE id_pengajuan='INHAL-2'").first();
    const h1 = await env.DB.prepare("SELECT status FROM status_history WHERE id_pengajuan='INHAL-1'").first();
    expect(p1.status).toBe('ACC');
    expect(p2.status).toBe('ACC');
    expect(h1.status).toBe('ACC');
  });

  it('menormalkan nilai config BAGIAN_BA_STATUSES yang memuat Diterima', async () => {
    await env.DB.prepare("INSERT INTO config (key,value) VALUES ('BAGIAN_BA_STATUSES','Diterima,ACC')").run();
    await applyMigration();
    const row = await env.DB.prepare("SELECT value FROM config WHERE key='BAGIAN_BA_STATUSES'").first();
    expect(row.value).toBe('ACC');
  });

  it('idempotent saat dijalankan dua kali', async () => {
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-10-01T08:00:00','INHAL-9','1009','X','A','SGD','Diterima')"
    ).run();
    await applyMigration();
    await applyMigration();
    const row = await env.DB.prepare("SELECT status FROM pengajuan WHERE id_pengajuan='INHAL-9'").first();
    expect(row.status).toBe('ACC');
  });
});
