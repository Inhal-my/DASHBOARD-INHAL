import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import migrationSql from '../migrations/2026-10-15-ba-pendukung-berkas-reactivate.sql?raw';

const statements = String(migrationSql)
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.replace(/--[^\n]*/g, '').trim());

async function applyMigration() {
  for (const stmt of statements) await env.DB.prepare(stmt).run();
}

async function addBa(baId, needsRegen) {
  await env.DB.prepare(
    "INSERT INTO berita_acara_admin (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jam,jumlah_peserta,file_name,file_url,catatan,sumber,kegiatan_key,updated_at,needs_regen) VALUES ('2026-10-01T08:00:00',?1,'SGD','A','SGD 1','2026-10-20','','1','','','','Admin',?2,'2026-10-01T08:00:00',?3)"
  ).bind(baId, baId.toLowerCase(), needsRegen).run();
}

async function addPeserta(baId, pid, urutan, active) {
  await env.DB.prepare(
    "INSERT INTO berita_acara_admin_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok,bagian,status_pengajuan,urutan,active) VALUES ('2026-10-01T08:00:00',?1,?2,?3,?4,'A','SGD','ACC',?5,?6)"
  ).bind(baId, pid, '22010100' + urutan, 'Peserta ' + urutan, urutan, active).run();
}

async function addBerkas(baId, pid, ts, pageIndex, active) {
  await env.DB.prepare(
    "INSERT INTO berita_acara_admin_berkas (timestamp,ba_id,id_pengajuan,npm,urutan,page_index,file_name,file_url,page_count,byte_size,active,superseded_at) VALUES (?1,?2,?3,'2201010001',1,?4,?5,?6,1,100,?7,?8)"
  ).bind(ts, baId, pid, pageIndex, 'p' + pageIndex + '.jpg', 'https://drive/' + pageIndex, active, active ? null : ts).run();
}

async function berkasState(baId, pid) {
  const rows = (await env.DB.prepare('SELECT page_index, active, superseded_at FROM berita_acara_admin_berkas WHERE ba_id = ?1 AND id_pengajuan = ?2 ORDER BY page_index').bind(baId, pid).all()).results || [];
  return rows.map((r) => ({ page: Number(r.page_index), active: Number(r.active), superseded: r.superseded_at }));
}

async function needsRegen(baId) {
  const r = await env.DB.prepare('SELECT needs_regen FROM berita_acara_admin WHERE ba_id = ?1').bind(baId).first();
  return Number(r.needs_regen);
}

describe('migrasi reaktivasi berkas BA Pendukung', () => {
  it('mengaktifkan kembali seluruh halaman batch unggahan terakhir', async () => {
    await addBa('BA-1', 0);
    await addPeserta('BA-1', 'INHAL-1', 1, 1);
    await addBerkas('BA-1', 'INHAL-1', '2026-10-10T00:00:00', 0, 0);
    await addBerkas('BA-1', 'INHAL-1', '2026-10-10T00:00:00', 1, 0);

    await applyMigration();

    expect(await berkasState('BA-1', 'INHAL-1')).toEqual([
      { page: 0, active: 1, superseded: null },
      { page: 1, active: 1, superseded: null }
    ]);
    expect(await needsRegen('BA-1')).toBe(1);
  });

  it('hanya mengaktifkan batch terbaru bila ada beberapa unggahan', async () => {
    await addBa('BA-1', 0);
    await addPeserta('BA-1', 'INHAL-1', 1, 1);
    await addBerkas('BA-1', 'INHAL-1', '2026-10-05T00:00:00', 0, 0);
    await addBerkas('BA-1', 'INHAL-1', '2026-10-10T00:00:00', 0, 0);
    await addBerkas('BA-1', 'INHAL-1', '2026-10-10T00:00:00', 1, 0);

    await applyMigration();

    expect(await berkasState('BA-1', 'INHAL-1')).toEqual([
      { page: 0, active: 0, superseded: '2026-10-05T00:00:00' },
      { page: 0, active: 1, superseded: null },
      { page: 1, active: 1, superseded: null }
    ]);
  });

  it('tidak mengubah peserta yang sudah punya berkas aktif', async () => {
    await addBa('BA-1', 0);
    await addPeserta('BA-1', 'INHAL-1', 1, 1);
    await addBerkas('BA-1', 'INHAL-1', '2026-10-05T00:00:00', 0, 0);
    await addBerkas('BA-1', 'INHAL-1', '2026-10-10T00:00:00', 0, 1);

    await applyMigration();

    expect(await berkasState('BA-1', 'INHAL-1')).toEqual([
      { page: 0, active: 0, superseded: '2026-10-05T00:00:00' },
      { page: 0, active: 1, superseded: null }
    ]);
    expect(await needsRegen('BA-1')).toBe(0);
  });

  it('tidak menyentuh peserta yang sudah non-aktif', async () => {
    await addBa('BA-1', 0);
    await addPeserta('BA-1', 'INHAL-1', 1, 0);
    await addBerkas('BA-1', 'INHAL-1', '2026-10-10T00:00:00', 0, 0);

    await applyMigration();

    expect(await berkasState('BA-1', 'INHAL-1')).toEqual([
      { page: 0, active: 0, superseded: '2026-10-10T00:00:00' }
    ]);
    expect(await needsRegen('BA-1')).toBe(0);
  });

  it('idempotent saat dijalankan dua kali', async () => {
    await addBa('BA-1', 0);
    await addPeserta('BA-1', 'INHAL-1', 1, 1);
    await addBerkas('BA-1', 'INHAL-1', '2026-10-10T00:00:00', 0, 0);

    await applyMigration();
    await applyMigration();

    expect(await berkasState('BA-1', 'INHAL-1')).toEqual([
      { page: 0, active: 1, superseded: null }
    ]);
  });
});
