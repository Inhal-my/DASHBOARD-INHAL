import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { saveJadwalPelaksanaan } from '../src/write/jadwal.js';
import { saveBeritaAcaraBagian } from '../src/write/beritaAcara.js';
import { getBaRepairData } from '../src/read/baRepair.js';
import { applyBaRepair } from '../src/write/baRepair.js';
import { archiveBeritaAcara, mergeBeritaAcara, restoreBeritaAcara } from '../src/write/baArchive.js';
import { computeJadwalList } from '../src/read/jadwal.js';

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

async function setupThree() {
  await seedPengajuan('INHAL-1', '2201010001', 'Aisyah');
  await seedPengajuan('INHAL-2', '2201010002', 'Budi');
  await seedPengajuan('INHAL-3', '2201010003', 'Citra');
  const bctx = await bagianCtx();
  const j1 = await saveJadwalPelaksanaan(env.DB, {
    bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggal: '2026-09-20', jam: '09:00', dosen: 'dr. Andi', catatan: '',
    peserta: peserta('INHAL-1', '2201010001', 'Aisyah')
  }, 'SGD', bctx);
  const j2 = await saveJadwalPelaksanaan(env.DB, {
    bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggal: '2026-09-21', jam: '09:00', dosen: 'dr. Budi', catatan: '',
    peserta: peserta('INHAL-2', '2201010002', 'Budi')
  }, 'SGD', bctx);
  const j3 = await saveJadwalPelaksanaan(env.DB, {
    bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggal: '2026-09-22', jam: '09:00', dosen: 'dr. Citra', catatan: '',
    peserta: peserta('INHAL-3', '2201010003', 'Citra')
  }, 'SGD', bctx);
  const ba1 = await saveBeritaAcaraBagian(env.DB, {
    bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20', jam: '09:00', dosen: 'dr. Andi', catatan: '',
    jadwalId: j1.jadwalId, peserta: peserta('INHAL-1', '2201010001', 'Aisyah')
  }, 'SGD', bctx);
  const ba2 = await saveBeritaAcaraBagian(env.DB, {
    bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-21', jam: '09:00', dosen: 'dr. Budi', catatan: '',
    jadwalId: j2.jadwalId, peserta: peserta('INHAL-2', '2201010002', 'Budi')
  }, 'SGD', bctx);
  const ba3 = await saveBeritaAcaraBagian(env.DB, {
    bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-22', jam: '09:00', dosen: 'dr. Citra', catatan: '',
    jadwalId: j3.jadwalId, peserta: peserta('INHAL-3', '2201010003', 'Citra')
  }, 'SGD', bctx);
  return { j1: j1.jadwalId, j2: j2.jadwalId, j3: j3.jadwalId, ba1: ba1.baId, ba2: ba2.baId, ba3: ba3.baId };
}

describe('arsip dan gabung BA Pelaksanaan', () => {
  it('mengarsipkan BA tanpa menghapus peserta dan menyembunyikannya dari pembacaan aktif', async () => {
    const data = await setupThree();
    const ctx = await adminCtx();
    const res = await archiveBeritaAcara(env.DB, {
      baId: data.ba2,
      reason: 'BA ganda untuk sesi yang sama',
      expectedRevision: 0,
      hardcopyAck: true
    }, ctx);
    expect(res.success).toBe(true);

    const before = await getBaRepairData(env.DB, { key: 'sgd|a|sgd 1' }, ctx);
    expect(before.workspace.ba.map((b) => b.baId)).toEqual([data.ba1, data.ba3]);
    const after = await getBaRepairData(env.DB, { key: 'sgd|a|sgd 1', includeArchived: true }, ctx);
    const arsip = after.workspace.ba.find((b) => b.baId === data.ba2);
    expect(arsip.archived).toBe(true);
    expect(arsip.peserta).toHaveLength(1);
    expect(arsip.archiveReason).toContain('ganda');

    const rows = await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara_peserta WHERE ba_id=?1').bind(data.ba2).first();
    expect(Number(rows.n)).toBe(1);
    const jadwal = await computeJadwalList(env.DB, '', '');
    expect(jadwal.find((j) => j.JadwalID === data.j2).punyaBa).toBe(false);
  });

  it('menolak arsip tanpa alasan, konfirmasi hardcopy, atau revisi yang cocok', async () => {
    const data = await setupThree();
    const ctx = await adminCtx();
    expect((await archiveBeritaAcara(env.DB, { baId: data.ba2, reason: 'pendek', hardcopyAck: true }, ctx)).success).toBe(false);
    expect((await archiveBeritaAcara(env.DB, { baId: data.ba2, reason: 'alasan cukup panjang', hardcopyAck: false }, ctx)).success).toBe(false);
    expect((await archiveBeritaAcara(env.DB, { baId: data.ba2, reason: 'alasan cukup panjang', hardcopyAck: true, expectedRevision: 9 }, ctx)).success).toBe(false);
  });

  it('menggabungkan peserta ke BA tujuan lalu menandai sumber sebagai arsip', async () => {
    const data = await setupThree();
    const ctx = await adminCtx();
    const res = await mergeBeritaAcara(env.DB, {
      sourceBaId: data.ba2,
      targetBaId: data.ba1,
      reason: 'Satukan BA sesi yang sama',
      expectedSourceRevision: 0,
      expectedTargetRevision: 0,
      hardcopyAck: true
    }, ctx);
    expect(res.success).toBe(true);
    expect(res.moved).toBe(1);

    const target = await env.DB.prepare('SELECT jumlah_peserta, revision FROM berita_acara WHERE ba_id=?1').bind(data.ba1).first();
    expect(String(target.jumlah_peserta)).toBe('2');
    expect(Number(target.revision)).toBe(1);
    const source = await env.DB.prepare('SELECT archived_at, merged_into FROM berita_acara WHERE ba_id=?1').bind(data.ba2).first();
    expect(String(source.archived_at)).not.toBe('');
    expect(source.merged_into).toBe(data.ba1);
    const peserta = await env.DB.prepare('SELECT id_pengajuan FROM berita_acara_peserta WHERE ba_id=?1 ORDER BY id').bind(data.ba1).all();
    expect(peserta.results.map((r) => r.id_pengajuan)).toEqual(['INHAL-1', 'INHAL-2']);
  });

  it('menolak gabung lintas kegiatan dan tujuan yang diarsipkan', async () => {
    await seedPengajuan('INHAL-1', '2201010001', 'Aisyah');
    await seedPengajuan('INHAL-2', '2201010002', 'Budi');
    await env.DB.prepare("UPDATE detail_kegiatan SET pilihan = 'SGD 2' WHERE id_pengajuan = 'INHAL-2'").run();
    const bctx = await bagianCtx();
    const j1 = await saveJadwalPelaksanaan(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggal: '2026-09-20', jam: '09:00', dosen: 'dr. Andi', catatan: '',
      peserta: peserta('INHAL-1', '2201010001', 'Aisyah')
    }, 'SGD', bctx);
    const j2 = await saveJadwalPelaksanaan(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 2', tanggal: '2026-09-21', jam: '09:00', dosen: 'dr. Budi', catatan: '',
      peserta: peserta('INHAL-2', '2201010002', 'Budi')
    }, 'SGD', bctx);
    const ba1 = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20', jam: '09:00', dosen: 'dr. Andi', catatan: '',
      jadwalId: j1.jadwalId, peserta: peserta('INHAL-1', '2201010001', 'Aisyah')
    }, 'SGD', bctx);
    const ba2 = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 2', tanggalPelaksanaan: '2026-09-21', jam: '09:00', dosen: 'dr. Budi', catatan: '',
      jadwalId: j2.jadwalId, peserta: peserta('INHAL-2', '2201010002', 'Budi')
    }, 'SGD', bctx);
    const ctx = await adminCtx();
    const res = await mergeBeritaAcara(env.DB, {
      sourceBaId: ba2.baId,
      targetBaId: ba1.baId,
      reason: 'Coba gabung lintas kegiatan',
      hardcopyAck: true
    }, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('kegiatan yang sama');
  });

  it('memulihkan BA arsip dan menolak pulih bila peserta masih bentrok', async () => {
    const data = await setupThree();
    const ctx = await adminCtx();
    await archiveBeritaAcara(env.DB, {
      baId: data.ba2,
      reason: 'Arsip sementara untuk uji',
      hardcopyAck: true
    }, ctx);
    const restore = await restoreBeritaAcara(env.DB, { baId: data.ba2, expectedRevision: 1 }, ctx);
    expect(restore.success).toBe(true);
    const after = await getBaRepairData(env.DB, { key: 'sgd|a|sgd 1' }, ctx);
    expect(after.workspace.ba.map((b) => b.baId)).toEqual([data.ba1, data.ba2, data.ba3]);

    await mergeBeritaAcara(env.DB, {
      sourceBaId: data.ba2,
      targetBaId: data.ba1,
      reason: 'Gabung untuk uji konflik',
      expectedSourceRevision: 2,
      expectedTargetRevision: 0,
      hardcopyAck: true
    }, ctx);
    const failed = await restoreBeritaAcara(env.DB, { baId: data.ba2, expectedRevision: 3 }, ctx);
    expect(failed.success).toBe(false);
    expect(failed.message).toContain('bentrok');
  });

  it('mengeluarkan peserta dari BA tanpa menghapus jadwal atau data pengajuan', async () => {
    const data = await setupThree();
    const ctx = await adminCtx();
    await archiveBeritaAcara(env.DB, {
      baId: data.ba3,
      reason: 'Arsip sesi ketiga sebelum uji pindah peserta',
      hardcopyAck: true
    }, ctx);
    const add = await applyBaRepair(env.DB, {
      baId: data.ba1,
      addPesertaIds: ['INHAL-3'],
      targetJadwalId: data.j1,
      jadwalIds: [data.j1],
      moveFromJadwal: true,
      expectedRevision: 0
    }, ctx);
    expect(add.success).toBe(true);
    expect(add.added).toBe(1);

    const remove = await applyBaRepair(env.DB, {
      baId: data.ba1,
      removePesertaIds: ['INHAL-3'],
      expectedRevision: 1
    }, ctx);
    expect(remove.success).toBe(true);
    expect(remove.removed).toBe(1);

    const baPeserta = await env.DB.prepare('SELECT id_pengajuan FROM berita_acara_peserta WHERE ba_id=?1').bind(data.ba1).all();
    expect(baPeserta.results.map((r) => r.id_pengajuan)).toEqual(['INHAL-1']);
    const jadwal = await env.DB.prepare('SELECT id_pengajuan FROM jadwal_peserta WHERE jadwal_id=?1').bind(data.j1).all();
    expect(jadwal.results.map((r) => r.id_pengajuan).sort()).toEqual(['INHAL-1', 'INHAL-3']);
    const pengajuan = await env.DB.prepare('SELECT dosen, tanggal_pelaksanaan FROM pengajuan WHERE id_pengajuan=?1').bind('INHAL-3').first();
    expect(pengajuan.dosen).toBe('dr. Andi');
    expect(pengajuan.tanggal_pelaksanaan).toBe('2026-09-20T09:00');
    const jumlah = await env.DB.prepare('SELECT jumlah_peserta FROM berita_acara WHERE ba_id=?1').bind(data.ba1).first();
    expect(String(jumlah.jumlah_peserta)).toBe('1');
  });

  it('menolak perbaikan pada BA arsip', async () => {
    const data = await setupThree();
    const ctx = await adminCtx();
    await archiveBeritaAcara(env.DB, {
      baId: data.ba2,
      reason: 'BA duplikat untuk uji kunci',
      hardcopyAck: true
    }, ctx);
    const res = await applyBaRepair(env.DB, {
      baId: data.ba2,
      removePesertaIds: ['INHAL-2'],
      expectedRevision: 1
    }, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('arsip');
  });
});
