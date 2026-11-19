import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { saveJadwalPelaksanaan } from '../src/write/jadwal.js';
import { saveBeritaAcaraBagian } from '../src/write/beritaAcara.js';
import { getBaRepairData } from '../src/read/baRepair.js';
import { applyBaRepair } from '../src/write/baRepair.js';

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), env: {} };
}

async function bagianCtx() {
  return { token: await createSession(env.DB, { role: 'bagian', nama: 'Bagian', kategoris: ['SGD'] }), env: {} };
}

async function seedPengajuan(id, npm, nama) {
  await env.DB.prepare(
    "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00',?1,?2,?3,'A','SGD','ACC')"
  ).bind(id, npm, nama).run();
  await env.DB.prepare(
    "INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00',?1,'SGD','SGD 1','','2026-09-20','')"
  ).bind(id).run();
}

function peserta(id, npm, nama) {
  return [{ idPengajuan: id, npm: npm, namaLengkap: nama, blok: 'A', statusPengajuan: 'ACC' }];
}

async function setup() {
  await seedPengajuan('INHAL-1', '2201010001', 'Aisyah');
  await seedPengajuan('INHAL-2', '2201010002', 'Budi');
  const bctx = await bagianCtx();
  const j1 = await saveJadwalPelaksanaan(env.DB, {
    bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggal: '2026-09-20', jam: '09:00', dosen: 'dr. Andi', catatan: '',
    peserta: peserta('INHAL-1', '2201010001', 'Aisyah')
  }, 'SGD', bctx);
  const j2 = await saveJadwalPelaksanaan(env.DB, {
    bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggal: '2026-09-21', jam: '09:00', dosen: 'dr. Budi', catatan: '',
    peserta: peserta('INHAL-2', '2201010002', 'Budi')
  }, 'SGD', bctx);
  const ba = await saveBeritaAcaraBagian(env.DB, {
    bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20', jam: '09:00', dosen: 'dr. Andi', catatan: '',
    jadwalId: j1.jadwalId, peserta: peserta('INHAL-1', '2201010001', 'Aisyah')
  }, 'SGD', bctx);
  return { j1: j1.jadwalId, j2: j2.jadwalId, baId: ba.baId };
}

describe('ba repair', () => {
  it('menampilkan BA, jadwal, dan kandidat peserta dari jadwal lain', async () => {
    const data = await setup();
    const ctx = await adminCtx();
    const res = await getBaRepairData(env.DB, { key: 'sgd|a|sgd 1' }, ctx);
    expect(res.ok).toBe(true);
    expect(res.workspace.ba).toHaveLength(1);
    expect(res.workspace.jadwal).toHaveLength(2);
    expect(res.workspace.ba[0].baId).toBe(data.baId);
    expect(res.workspace.ba[0].jadwalIds).toContain(data.j1);
    expect(res.workspace.ba[0].dosenList).toEqual(['dr. Andi']);
    const budi = res.workspace.kandidat.find((x) => x.idPengajuan === 'INHAL-2');
    expect(budi).toBeTruthy();
    expect(budi.sourceJadwal.map((j) => j.jadwalId)).toEqual([data.j2]);
  });

  it('menambahkan peserta dari jadwal lain dan memindahkannya ke jadwal tujuan', async () => {
    const data = await setup();
    const ctx = await adminCtx();
    const res = await applyBaRepair(env.DB, {
      baId: data.baId,
      addPesertaIds: ['INHAL-2'],
      targetJadwalId: data.j1,
      jadwalIds: [data.j1],
      moveFromJadwal: true
    }, ctx);
    expect(res.success).toBe(true);
    expect(res.added).toBe(1);
    const baPeserta = await env.DB.prepare('SELECT id_pengajuan FROM berita_acara_peserta WHERE ba_id=?1 ORDER BY id').bind(data.baId).all();
    expect(baPeserta.results.map((r) => r.id_pengajuan)).toEqual(['INHAL-1', 'INHAL-2']);
    const j2Peserta = await env.DB.prepare('SELECT id_pengajuan FROM jadwal_peserta WHERE jadwal_id=?1').bind(data.j2).all();
    expect(j2Peserta.results).toHaveLength(0);
    const j1Peserta = await env.DB.prepare('SELECT id_pengajuan FROM jadwal_peserta WHERE jadwal_id=?1 ORDER BY id').bind(data.j1).all();
    expect(j1Peserta.results.map((r) => r.id_pengajuan)).toEqual(['INHAL-1', 'INHAL-2']);
    const p = await env.DB.prepare('SELECT dosen, tanggal_pelaksanaan FROM pengajuan WHERE id_pengajuan=?1').bind('INHAL-2').first();
    expect(p.dosen).toBe('dr. Andi');
    expect(p.tanggal_pelaksanaan).toBe('2026-09-20T09:00');
    const jumlah = await env.DB.prepare('SELECT jumlah_peserta FROM berita_acara WHERE ba_id=?1').bind(data.baId).first();
    expect(String(jumlah.jumlah_peserta)).toBe('2');
  });

  it('tidak menggandakan peserta yang sudah ada di BA', async () => {
    const data = await setup();
    const ctx = await adminCtx();
    const payload = {
      baId: data.baId,
      addPesertaIds: ['INHAL-2'],
      targetJadwalId: data.j1,
      jadwalIds: [data.j1],
      moveFromJadwal: true
    };
    const first = await applyBaRepair(env.DB, payload, ctx);
    expect(first.added).toBe(1);
    const second = await applyBaRepair(env.DB, payload, ctx);
    expect(second.success).toBe(true);
    expect(second.added).toBe(0);
    const rows = await env.DB.prepare('SELECT id_pengajuan FROM berita_acara_peserta WHERE ba_id=?1 ORDER BY id').bind(data.baId).all();
    expect(rows.results.map((r) => r.id_pengajuan)).toEqual(['INHAL-1', 'INHAL-2']);
  });

  it('menolak peserta yang sudah tercatat di BA lain', async () => {
    const data = await setup();
    const bctx = await bagianCtx();
    const ba2 = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-21', jam: '09:00', dosen: 'dr. Budi', catatan: '',
      jadwalId: data.j2, peserta: peserta('INHAL-2', '2201010002', 'Budi')
    }, 'SGD', bctx);
    expect(ba2.success).toBe(true);
    const ctx = await adminCtx();
    const res = await applyBaRepair(env.DB, {
      baId: data.baId,
      addPesertaIds: ['INHAL-2'],
      targetJadwalId: data.j1,
      jadwalIds: [data.j1],
      moveFromJadwal: true
    }, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('sudah tercatat');
  });

  it('menolak akun bagian', async () => {
    const data = await setup();
    const ctx = await bagianCtx();
    await expect(applyBaRepair(env.DB, {
      baId: data.baId,
      addPesertaIds: ['INHAL-2'],
      targetJadwalId: data.j1,
      jadwalIds: [data.j1]
    }, ctx)).rejects.toThrow();
  });

  it('memberi urutan lanjutan saat menautkan sesi baru ke BA yang sudah punya sesi', async () => {
    const data = await setup();
    const ctx = await adminCtx();
    const res = await applyBaRepair(env.DB, {
      baId: data.baId,
      jadwalIds: [data.j2]
    }, ctx);
    expect(res.success).toBe(true);
    const rows = await env.DB.prepare(
      'SELECT jadwal_id, urutan FROM berita_acara_sesi WHERE ba_id = ?1 ORDER BY urutan'
    ).bind(data.baId).all();
    expect(rows.results).toEqual([
      { jadwal_id: data.j1, urutan: 1 },
      { jadwal_id: data.j2, urutan: 2 }
    ]);
  });
});
