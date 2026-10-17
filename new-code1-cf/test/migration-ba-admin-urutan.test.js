import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import migrationSql from '../migrations/2026-10-17-ba-admin-peserta-urutan.sql?raw';

const statements = String(migrationSql)
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.replace(/--[^\n]*/g, '').trim());

async function runMigration() {
  for (const stmt of statements) await env.DB.prepare(stmt).run();
}

async function seed(baId, timestamp, urutan, npm) {
  await env.DB.prepare(
    "INSERT INTO berita_acara_admin_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok,bagian,status_pengajuan,urutan,active) " +
    "VALUES (?1,?2,?3,?4,?4,'A','SGD','ACC',?5,1)"
  ).bind(timestamp, baId, 'INHAL-' + npm, npm, urutan).run();
}

async function urutanRows(baId) {
  const rows = await env.DB.prepare('SELECT npm, urutan FROM berita_acara_admin_peserta WHERE ba_id=?1 ORDER BY urutan, npm').bind(baId).all();
  return rows.results || [];
}

describe('migrasi urutan peserta BA Pendukung', () => {
  it('mengisi urutan NULL berurutan per BA', async () => {
    await seed('BA-PEN-A', '2026-10-14T08:00:00', null, '3003');
    await seed('BA-PEN-A', '2026-10-14T08:00:01', null, '3001');
    await seed('BA-PEN-B', '2026-10-14T08:00:00', null, '3002');
    await runMigration();
    expect(await urutanRows('BA-PEN-A')).toEqual([
      { npm: '3003', urutan: 1 },
      { npm: '3001', urutan: 2 }
    ]);
    expect(await urutanRows('BA-PEN-B')).toEqual([{ npm: '3002', urutan: 1 }]);
  });

  it('melanjutkan dari urutan maksimum dan aman dijalankan ulang', async () => {
    await seed('BA-PEN-C', '2026-10-14T08:00:00', 1, '3001');
    await seed('BA-PEN-C', '2026-10-14T08:00:01', 2, '3002');
    await seed('BA-PEN-C', '2026-10-14T08:00:02', null, '3003');
    await runMigration();
    await runMigration();
    expect(await urutanRows('BA-PEN-C')).toEqual([
      { npm: '3001', urutan: 1 },
      { npm: '3002', urutan: 2 },
      { npm: '3003', urutan: 3 }
    ]);
  });
});
