import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { saveJadwalPelaksanaan, cancelJadwalPelaksanaan } from '../src/write/jadwal.js';
import { saveBeritaAcaraBagian, updateBeritaAcaraBagian, deleteBeritaAcaraBagian } from '../src/write/beritaAcara.js';

async function bagianCtx(kategoris = ['SGD']) {
  return { token: await createSession(env.DB, { role: 'bagian', nama: 'Bagian', kategoris }), env: {} };
}

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), env: {} };
}

async function seedPengajuan() {
  const rows = [
    ['INHAL-1', '2201010001', 'Aisyah'],
    ['INHAL-2', '2201010002', 'Budi']
  ];
  for (const [id, npm, nama] of rows) {
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00',?1,?2,?3,'A','SGD','ACC')"
    ).bind(id, npm, nama).run();
    await env.DB.prepare(
      "INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00',?1,'SGD','SGD 1','','2026-09-20','')"
    ).bind(id).run();
  }
}

function pesertaOf(id, npm, nama) {
  return { idPengajuan: id, npm: npm, namaLengkap: nama, blok: 'A', statusPengajuan: 'ACC' };
}

const AISYAH = ['INHAL-1', '2201010001', 'Aisyah'];
const BUDI = ['INHAL-2', '2201010002', 'Budi'];

async function makeJadwal(ctx, tanggal, jam, dosen, peserta) {
  const res = await saveJadwalPelaksanaan(env.DB, {
    bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggal: tanggal, jam: jam, dosen: dosen, catatan: '', peserta: peserta
  }, 'SGD', ctx);
  expect(res.success).toBe(true);
  return res.jadwalId;
}

async function sesiRows(baId) {
  const rows = await env.DB.prepare('SELECT ba_id, jadwal_id, urutan FROM berita_acara_sesi WHERE ba_id = ?1 ORDER BY urutan').bind(baId).all();
  return rows.results || [];
}

describe('BA Pelaksanaan multi-sesi', () => {
  it('menyimpan beberapa sesi jadwal dalam satu BA', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx();
    const a = await makeJadwal(ctx, '2026-09-20', '09:00', 'dr. Andi', [pesertaOf(...AISYAH)]);
    const b = await makeJadwal(ctx, '2026-09-21', '13:00', 'dr. Budi', [pesertaOf(...BUDI)]);

    const res = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20',
      jam: '09:00', dosen: 'dr. Andi', catatan: '', jadwalIds: [b, a],
      peserta: [pesertaOf(...AISYAH), pesertaOf(...BUDI)]
    }, 'SGD', ctx);

    expect(res.success).toBe(true);
    expect(res.jumlahSesi).toBe(2);
    const ba = await env.DB.prepare('SELECT jadwal_id, jumlah_peserta FROM berita_acara WHERE ba_id = ?1').bind(res.baId).first();
    expect(ba.jadwal_id).toBe(a);
    expect(Number(ba.jumlah_peserta)).toBe(2);
    expect(await sesiRows(res.baId)).toEqual([
      { ba_id: res.baId, jadwal_id: a, urutan: 1 },
      { ba_id: res.baId, jadwal_id: b, urutan: 2 }
    ]);
  });

  it('menyinkronkan pengajuan sesuai sesi masing-masing peserta', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx();
    const a = await makeJadwal(ctx, '2026-09-20', '09:00', 'dr. Andi', [pesertaOf(...AISYAH)]);
    const b = await makeJadwal(ctx, '2026-09-21', '13:00', 'dr. Budi', [pesertaOf(...BUDI)]);

    const res = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20',
      catatan: '', jadwalIds: [a, b],
      peserta: [pesertaOf(...AISYAH), pesertaOf(...BUDI)]
    }, 'SGD', ctx);
    expect(res.success).toBe(true);

    const p1 = await env.DB.prepare('SELECT dosen, tanggal_pelaksanaan FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    const p2 = await env.DB.prepare('SELECT dosen, tanggal_pelaksanaan FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-2').first();
    expect(p1.dosen).toBe('dr. Andi');
    expect(p1.tanggal_pelaksanaan).toBe('2026-09-20T09:00');
    expect(p2.dosen).toBe('dr. Budi');
    expect(p2.tanggal_pelaksanaan).toBe('2026-09-21T13:00');
  });

  it('menolak tanggal BA yang bukan tanggal sesi paling awal', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx();
    const a = await makeJadwal(ctx, '2026-09-20', '09:00', 'dr. Andi', [pesertaOf(...AISYAH)]);
    const b = await makeJadwal(ctx, '2026-09-21', '13:00', 'dr. Budi', [pesertaOf(...BUDI)]);

    const res = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-21',
      catatan: '', jadwalIds: [a, b], peserta: [pesertaOf(...AISYAH), pesertaOf(...BUDI)]
    }, 'SGD', ctx);

    expect(res.success).toBe(false);
    expect(res.message).toContain('sesi paling awal');
  });

  it('menolak jadwal yang sudah dipakai BA lain', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx();
    const a = await makeJadwal(ctx, '2026-09-20', '09:00', 'dr. Andi', [pesertaOf(...AISYAH)]);
    const b = await makeJadwal(ctx, '2026-09-21', '13:00', 'dr. Budi', [pesertaOf(...BUDI)]);

    const first = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20',
      catatan: '', jadwalIds: [a, b], peserta: [pesertaOf(...AISYAH)]
    }, 'SGD', ctx);
    expect(first.success).toBe(true);

    const dup = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-21',
      catatan: '', jadwalIds: [b], peserta: [pesertaOf(...BUDI)]
    }, 'SGD', ctx);

    expect(dup.success).toBe(false);
    expect(dup.message).toContain('sudah ada');
  });

  it('menolak jadwal dari kegiatan lain', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx();
    const a = await makeJadwal(ctx, '2026-09-20', '09:00', 'dr. Andi', [pesertaOf(...AISYAH)]);
    const lain = await saveJadwalPelaksanaan(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 2', tanggal: '2026-09-21', jam: '13:00',
      dosen: 'dr. Budi', catatan: '', peserta: [pesertaOf(...BUDI)]
    }, 'SGD', ctx);
    expect(lain.success).toBe(true);

    const res = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20',
      catatan: '', jadwalIds: [a, lain.jadwalId], peserta: [pesertaOf(...AISYAH), pesertaOf(...BUDI)]
    }, 'SGD', ctx);

    expect(res.success).toBe(false);
    expect(res.message).toContain('tidak sesuai');
  });

  it('memperbarui dan menghapus sesi BA', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx();
    const admin = await adminCtx();
    const a = await makeJadwal(ctx, '2026-09-20', '09:00', 'dr. Andi', [pesertaOf(...AISYAH)]);
    const b = await makeJadwal(ctx, '2026-09-21', '13:00', 'dr. Budi', [pesertaOf(...BUDI)]);

    const created = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20',
      catatan: '', jadwalIds: [a], peserta: [pesertaOf(...AISYAH)]
    }, 'SGD', ctx);
    expect(created.success).toBe(true);
    expect((await sesiRows(created.baId)).map((r) => r.jadwal_id)).toEqual([a]);

    const upd = await updateBeritaAcaraBagian(env.DB, created.baId, { jadwalIds: [a, b] }, admin);
    expect(upd.success).toBe(true);
    expect((await sesiRows(created.baId)).map((r) => r.jadwal_id)).toEqual([a, b]);

    const del = await deleteBeritaAcaraBagian(env.DB, created.baId, admin);
    expect(del.success).toBe(true);
    expect(await sesiRows(created.baId)).toEqual([]);
  });

  it('mengunci jadwal yang tertaut sebagai sesi non-pertama', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx();
    const a = await makeJadwal(ctx, '2026-09-20', '09:00', 'dr. Andi', [pesertaOf(...AISYAH)]);
    const b = await makeJadwal(ctx, '2026-09-21', '13:00', 'dr. Budi', [pesertaOf(...BUDI)]);

    const res = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20',
      catatan: '', jadwalIds: [a, b], peserta: [pesertaOf(...AISYAH)]
    }, 'SGD', ctx);
    expect(res.success).toBe(true);

    const cancel = await cancelJadwalPelaksanaan(env.DB, b, 'SGD', ctx);
    expect(cancel.success).toBe(false);
    expect(cancel.message).toContain('terkunci');
  });
});
