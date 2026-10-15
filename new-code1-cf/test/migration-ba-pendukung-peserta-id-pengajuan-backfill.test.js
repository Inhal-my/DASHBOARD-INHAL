import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import migrationSql from '../migrations/2026-10-15-ba-pendukung-peserta-id-pengajuan-backfill.sql?raw';

const statements = String(migrationSql)
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.replace(/--[^\n]*/g, '').trim());

async function applyMigration() {
  for (const stmt of statements) await env.DB.prepare(stmt).run();
}

async function addPengajuan(id, npm, jenis, blok) {
  await env.DB.prepare(
    "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-10-01T08:00:00',?1,?2,?3,?4,?5,'ACC')"
  ).bind(id, npm, 'Nama ' + npm, blok || 'A', jenis).run();
}

async function addDetail(id, jenis, pilihan, detail) {
  await env.DB.prepare(
    "INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-10-01T08:00:00',?1,?2,?3,?4,'2026-10-20','')"
  ).bind(id, jenis, pilihan, detail).run();
}

async function addPeserta(baId, idPengajuan, npm, bagian) {
  await env.DB.prepare(
    "INSERT INTO berita_acara_admin_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok,bagian,status_pengajuan,urutan,active) VALUES ('2026-10-01T08:00:00',?1,?2,?3,?4,'A',?5,'ACC',1,1)"
  ).bind(baId, idPengajuan, npm, 'Nama ' + npm, bagian).run();
}

async function peserta(idPengajuan) {
  return await env.DB.prepare('SELECT id_pengajuan FROM berita_acara_admin_peserta WHERE id_pengajuan = ?1').bind(idPengajuan).first();
}

async function pesertaByNpm(npm) {
  return await env.DB.prepare('SELECT id_pengajuan FROM berita_acara_admin_peserta WHERE npm = ?1').bind(npm).first();
}

describe('migrasi backfill id_pengajuan peserta BA Pendukung', () => {
  it('mengisi dari pengajuan tunggal walau bagian tidak cocok', async () => {
    await addPengajuan('INHAL-1', '1001', 'KKD');
    await addPeserta('BA-1', '', '1001', 'KKD');

    await applyMigration();

    expect((await pesertaByNpm('1001')).id_pengajuan).toBe('INHAL-1');
  });

  it('memilih pengajuan yang cocok saat ada beberapa pengajuan', async () => {
    await addPengajuan('INHAL-A', '2002', 'Praktikum');
    await addPengajuan('INHAL-B', '2002', 'SGD');
    await addDetail('INHAL-A', 'Praktikum', 'Mikrobiologi', 'Praktikum');
    await addPeserta('BA-1', '', '2002', 'Mikrobiologi');
    await addPeserta('BA-2', '', '2002', 'SGD');

    await applyMigration();

    const rows = (await env.DB.prepare('SELECT ba_id, id_pengajuan FROM berita_acara_admin_peserta WHERE npm = ?1 ORDER BY ba_id').bind('2002').all()).results || [];
    expect(rows.map((r) => [r.ba_id, r.id_pengajuan])).toEqual([
      ['BA-1', 'INHAL-A'],
      ['BA-2', 'INHAL-B']
    ]);
  });

  it('tidak mengisi bila kandidat ambigu (lebih dari satu cocok)', async () => {
    await addPengajuan('INHAL-A', '3003', 'SGD');
    await addPengajuan('INHAL-B', '3003', 'SGD');
    await addPeserta('BA-1', '', '3003', 'SGD');

    await applyMigration();

    expect((await pesertaByNpm('3003')).id_pengajuan).toBe('');
  });

  it('tidak menimpa id_pengajuan yang sudah terisi', async () => {
    await addPengajuan('INHAL-A', '4004', 'KKD');
    await addPengajuan('INHAL-B', '4004', 'KKD');
    await addPeserta('BA-1', 'INHAL-B', '4004', 'KKD');

    await applyMigration();

    expect((await peserta('INHAL-B')).id_pengajuan).toBe('INHAL-B');
  });

  it('idempotent saat dijalankan dua kali', async () => {
    await addPengajuan('INHAL-A', '5005', 'SGD');
    await addPeserta('BA-1', '', '5005', 'SGD');

    await applyMigration();
    await applyMigration();

    expect((await pesertaByNpm('5005')).id_pengajuan).toBe('INHAL-A');
  });
});
