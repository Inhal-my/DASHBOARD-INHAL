import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { getBagianAggregation } from '../src/read/dashboard.js';

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), env: {} };
}
async function seedPengajuan() {
  await env.DB.prepare("INSERT INTO pengajuan (id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status,link_final) VALUES ('INHAL-1','2201010001','Aisyah','Blok A','SGD','Diterima','')").run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('INHAL-1','SGD','SGD 1','Remediasi','2026-09-20','')").run();
}
async function seedBa({ baId, bagian, blok, nama, tanggal, fileUrl, npm }) {
  await env.DB.prepare("INSERT INTO berita_acara (ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jumlah_peserta,file_url,catatan,sumber) VALUES (?1,?2,?3,?4,?5,'1',?6,'','Bagian')").bind(baId, bagian, blok, nama, tanggal, fileUrl).run();
  if (npm) await env.DB.prepare("INSERT INTO berita_acara_peserta (ba_id,npm,nama_lengkap,blok) VALUES (?1,?2,'Aisyah',?3)").bind(baId, npm, blok).run();
}
async function seedBaAdmin({ baId, bagian, blok, nama, tanggal, fileUrl, npm }) {
  await env.DB.prepare("INSERT INTO berita_acara_admin (ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jumlah_peserta,file_url,catatan,sumber) VALUES (?1,?2,?3,?4,?5,'1',?6,'','Admin')").bind(baId, bagian, blok, nama, tanggal, fileUrl).run();
  if (npm) await env.DB.prepare("INSERT INTO berita_acara_admin_peserta (ba_id,npm,nama_lengkap,blok) VALUES (?1,?2,'Aisyah',?3)").bind(baId, npm, blok).run();
}

describe('getBagianAggregation audit', () => {
  it('requires an admin session', async () => {
    await expect(getBagianAggregation(env.DB, {})).rejects.toThrow();
  });

  it('matches BA to a unit via peserta NPM', async () => {
    await seedPengajuan();
    await seedBa({ baId: 'BA-1', bagian: 'SGD', blok: 'Blok A', nama: 'SGD 1 - Remediasi', tanggal: '2026-09-20', fileUrl: 'http://f/1', npm: '2201010001' });
    const data = await getBagianAggregation(env.DB, await adminCtx());
    expect(data.units).toHaveLength(1);
    expect(data.units[0].statusBa).toBe('ada');
    expect(data.units[0].pesertaDenganBa).toBe(1);
    expect(data.summary).toMatchObject({ totalKegiatan: 1, denganBa: 1, denganBaBagian: 1, denganBaAdmin: 0, belumBa: 0 });
    expect(data.summary.persenLengkap).toBe(100);
  });

  it('falls back to normalized text when BA has no peserta (em-dash vs hyphen)', async () => {
    await seedPengajuan();
    await seedBa({ baId: 'BA-2', bagian: 'SGD', blok: 'Blok A', nama: 'SGD \u2014 SGD 1 - Remediasi', tanggal: '2026-09-20', fileUrl: 'http://f/2', npm: '' });
    const data = await getBagianAggregation(env.DB, await adminCtx());
    expect(data.units[0].statusBa).toBe('ada');
  });

  it('surfaces orphan BA without affecting totalKegiatan', async () => {
    await seedPengajuan();
    await seedBa({ baId: 'BA-3', bagian: 'KKD', blok: 'Blok Z', nama: 'KKD 9', tanggal: '2026-09-21', fileUrl: 'http://f/3', npm: '9999' });
    const data = await getBagianAggregation(env.DB, await adminCtx());
    expect(data.units).toHaveLength(1);
    expect(data.summary.totalKegiatan).toBe(1);
    expect(data.summary.belumBa).toBe(1);
    expect(data.orphanBa).toHaveLength(1);
    expect(data.orphanBa[0].baId).toBe('BA-3');
  });

  it('counts Bagian and Admin sources separately for the same unit', async () => {
    await seedPengajuan();
    await seedBa({ baId: 'BA-4', bagian: 'SGD', blok: 'Blok A', nama: 'SGD 1 - Remediasi', tanggal: '2026-09-20', fileUrl: 'http://f/4', npm: '2201010001' });
    await seedBaAdmin({ baId: 'BA-5', bagian: 'SGD', blok: 'Blok A', nama: 'SGD 1 - Remediasi', tanggal: '2026-09-20', fileUrl: 'http://f/5', npm: '2201010001' });
    const data = await getBagianAggregation(env.DB, await adminCtx());
    expect(data.units[0].ba).toHaveLength(2);
    expect(data.summary).toMatchObject({ denganBa: 1, denganBaBagian: 1, denganBaAdmin: 1 });
  });
});
