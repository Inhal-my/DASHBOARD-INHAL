import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { saveJadwalPelaksanaan, cancelJadwalPelaksanaan } from '../src/write/jadwal.js';
import { saveBeritaAcaraBagian, updateBeritaAcaraBagian, deleteBeritaAcaraBagian, setBaDosenSesi, setBaLegacy, renameBaDosen } from '../src/write/beritaAcara.js';

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
  for (const [id, npm, nama] of rows) await seedPeserta(id, npm, nama);
}

async function seedPeserta(id, npm, nama) {
  await env.DB.prepare(
    "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00',?1,?2,?3,'A','SGD','ACC')"
  ).bind(id, npm, nama).run();
  await env.DB.prepare(
    "INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00',?1,'SGD','SGD 1','','2026-09-20','')"
  ).bind(id).run();
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

  it('menolak pengosongan sesi BA yang sudah memiliki sesi', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx();
    const admin = await adminCtx();
    const a = await makeJadwal(ctx, '2026-09-20', '09:00', 'dr. Andi', [pesertaOf(...AISYAH)]);

    const created = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20',
      catatan: '', jadwalIds: [a], peserta: [pesertaOf(...AISYAH)]
    }, 'SGD', ctx);
    expect(created.success).toBe(true);

    const upd = await updateBeritaAcaraBagian(env.DB, created.baId, { jadwalIds: [] }, admin);
    expect(upd.success).toBe(false);
    expect(upd.message).toContain('minimal satu sesi');
    expect((await sesiRows(created.baId)).map((r) => r.jadwal_id)).toEqual([a]);
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

  it('menjadwalkan otomatis peserta belum dijadwalkan ke sesi terpilih', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx();
    const a = await makeJadwal(ctx, '2026-09-20', '09:00', 'dr. Andi', [pesertaOf(...AISYAH)]);

    const res = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20',
      catatan: '', jadwalIds: [a],
      peserta: [pesertaOf(...AISYAH), pesertaOf(...BUDI)],
      autoJadwalkanBelumDijadwalkan: true
    }, 'SGD', ctx);

    expect(res.success).toBe(true);
    expect(res.autoScheduled).toBe(1);
    const rows = await env.DB.prepare(
      "SELECT id_pengajuan FROM jadwal_peserta WHERE jadwal_id = ?1 AND id_pengajuan = 'INHAL-2'"
    ).bind(a).all();
    expect(rows.results.length).toBe(1);
    const p2 = await env.DB.prepare('SELECT dosen, tanggal_pelaksanaan FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-2').first();
    expect(p2.dosen).toBe('dr. Andi');
    expect(p2.tanggal_pelaksanaan).toBe('2026-09-20T09:00');
    const baPeserta = await env.DB.prepare('SELECT id_pengajuan FROM berita_acara_peserta WHERE ba_id = ?1').bind(res.baId).all();
    expect(baPeserta.results.map((r) => r.id_pengajuan).sort()).toEqual(['INHAL-1', 'INHAL-2']);
  });

  it('menjadwalkan peserta baru ke sesi paling awal pada BA multi-sesi', async () => {
    await seedPengajuan();
    await seedPeserta('INHAL-3', '2201010003', 'Cici');
    const ctx = await bagianCtx();
    const a = await makeJadwal(ctx, '2026-09-20', '09:00', 'dr. Andi', [pesertaOf(...AISYAH)]);
    const b = await makeJadwal(ctx, '2026-09-21', '13:00', 'dr. Budi', [pesertaOf(...BUDI)]);

    const res = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20',
      catatan: '', jadwalIds: [b, a],
      peserta: [pesertaOf(...AISYAH), pesertaOf(...BUDI), pesertaOf('INHAL-3', '2201010003', 'Cici')],
      autoJadwalkanBelumDijadwalkan: true
    }, 'SGD', ctx);

    expect(res.success).toBe(true);
    expect(res.autoScheduled).toBe(1);
    const rows = await env.DB.prepare(
      "SELECT jadwal_id FROM jadwal_peserta WHERE id_pengajuan = 'INHAL-3'"
    ).all();
    expect(rows.results.map((r) => r.jadwal_id)).toEqual([a]);
    const p3 = await env.DB.prepare('SELECT dosen, tanggal_pelaksanaan FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-3').first();
    expect(p3.dosen).toBe('dr. Andi');
    expect(p3.tanggal_pelaksanaan).toBe('2026-09-20T09:00');
  });

  it('tidak menjadwalkan otomatis tanpa flag dari klien', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx();
    const a = await makeJadwal(ctx, '2026-09-20', '09:00', 'dr. Andi', [pesertaOf(...AISYAH)]);

    const res = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20',
      catatan: '', jadwalIds: [a],
      peserta: [pesertaOf(...AISYAH), pesertaOf(...BUDI)]
    }, 'SGD', ctx);

    expect(res.success).toBe(true);
    expect(res.autoScheduled).toBe(0);
    const rows = await env.DB.prepare(
      "SELECT id FROM jadwal_peserta WHERE jadwal_id = ?1 AND id_pengajuan = 'INHAL-2'"
    ).bind(a).all();
    expect(rows.results).toEqual([]);
  });

  it('menolak auto-jadwal peserta baru tanpa sesi', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx();
    await makeJadwal(ctx, '2026-09-20', '09:00', 'dr. Andi', [pesertaOf(...AISYAH)]);

    const res = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20',
      catatan: '', jadwalIds: [],
      peserta: [pesertaOf(...BUDI)],
      autoJadwalkanBelumDijadwalkan: true
    }, 'SGD', ctx);

    expect(res.success).toBe(false);
    expect(res.message).toContain('Pilih minimal satu sesi');
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara').first();
    expect(Number(count.n)).toBe(0);
  });
});

describe('Atur dosen per sesi', () => {
  async function makeBaMultiSesi() {
    await seedPengajuan();
    const ctx = await bagianCtx();
    const a = await makeJadwal(ctx, '2026-09-20', '09:00', 'dr. Andi', [pesertaOf(...AISYAH)]);
    const b = await makeJadwal(ctx, '2026-09-21', '13:00', 'dr. Budi', [pesertaOf(...BUDI)]);
    const created = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20',
      catatan: '', jadwalIds: [a, b], peserta: [pesertaOf(...AISYAH), pesertaOf(...BUDI)]
    }, 'SGD', ctx);
    expect(created.success).toBe(true);
    return { created, a, b };
  }

  it('menyimpan dosen per sesi dan menyinkronkan ba_dosen', async () => {
    const { created, a, b } = await makeBaMultiSesi();
    const admin = await adminCtx();
    const res = await setBaDosenSesi(env.DB, created.baId, {
      sessions: [
        { jadwalId: a, dosenList: ['dr. Andi', 'dr. Budi'] },
        { jadwalId: b, dosenList: [] }
      ]
    }, admin);
    expect(res.success).toBe(true);
    expect(res.dosenList).toEqual(['dr. Andi', 'dr. Budi']);

    const jdA = await env.DB.prepare('SELECT nama FROM jadwal_dosen WHERE jadwal_id = ?1 ORDER BY urutan').bind(a).all();
    expect((jdA.results || []).map((r) => r.nama)).toEqual(['dr. Andi', 'dr. Budi']);
    const jdB = await env.DB.prepare('SELECT nama FROM jadwal_dosen WHERE jadwal_id = ?1').bind(b).all();
    expect(jdB.results).toEqual([]);
    const baDosen = await env.DB.prepare('SELECT nama FROM ba_dosen WHERE ba_id = ?1 ORDER BY urutan').bind(created.baId).all();
    expect((baDosen.results || []).map((r) => r.nama)).toEqual(['dr. Andi', 'dr. Budi']);
    const ba = await env.DB.prepare('SELECT dosen FROM berita_acara WHERE ba_id = ?1').bind(created.baId).first();
    expect(ba.dosen).toBe('dr. Andi');
  });

  it('menolak sesi yang tidak tertaut dan daftar sesi yang tidak lengkap', async () => {
    const { created, a } = await makeBaMultiSesi();
    const admin = await adminCtx();
    const asing = await setBaDosenSesi(env.DB, created.baId, {
      sessions: [{ jadwalId: 'JDW-2026-9999', dosenList: ['dr. Andi'] }]
    }, admin);
    expect(asing.success).toBe(false);
    expect(asing.message).toContain('tidak tertaut');

    const kurang = await setBaDosenSesi(env.DB, created.baId, {
      sessions: [{ jadwalId: a, dosenList: ['dr. Andi'] }]
    }, admin);
    expect(kurang.success).toBe(false);
    expect(kurang.message).toContain('tidak lengkap');
  });

  it('menolak dosen di luar master', async () => {
    const { created, a, b } = await makeBaMultiSesi();
    const admin = await adminCtx();
    const res = await setBaDosenSesi(env.DB, created.baId, {
      sessions: [
        { jadwalId: a, dosenList: ['dr. Tidak Ada'] },
        { jadwalId: b, dosenList: [] }
      ]
    }, admin);
    expect(res.success).toBe(false);
    expect(res.message).toContain('master');
  });
});

describe('Tandai legacy', () => {
  async function seedBa(baId) {
    await env.DB.prepare(
      "INSERT INTO berita_acara (timestamp, ba_id, bagian, blok, nama_kegiatan, tanggal_pelaksanaan, jam, dosen, jumlah_peserta, sumber, kegiatan_key) " +
      "VALUES ('2026-09-10T08:00:00', ?1, 'SGD', 'A', 'SGD 1', '2026-09-20', '08:00', 'dr. Budi', '1', 'Bagian', 'sgd|a|sgd 1')"
    ).bind(baId).run();
  }

  it('menandai legacy dengan alasan dan mencatat audit', async () => {
    await seedBa('BA-PEL-LEGACY');
    const admin = await adminCtx();
    const res = await setBaLegacy(env.DB, 'BA-PEL-LEGACY', { legacy: true, reason: 'BA lama tanpa jadwal resmi' }, admin);
    expect(res.success).toBe(true);
    expect(res.legacy).toBe(true);

    const row = await env.DB.prepare('SELECT legacy_sesi, legacy_reason, legacy_at, legacy_by FROM berita_acara WHERE ba_id = ?1').bind('BA-PEL-LEGACY').first();
    expect(Number(row.legacy_sesi)).toBe(1);
    expect(row.legacy_reason).toBe('BA lama tanpa jadwal resmi');
    expect(row.legacy_at).toBeTruthy();
    expect(row.legacy_by).toBe('Admin');

    const audit = await env.DB.prepare("SELECT aksi, alasan FROM audit_log WHERE target = ?1 AND aksi = 'BA_LEGACY_SET'").bind('BA-PEL-LEGACY').first();
    expect(audit.alasan).toBe('BA lama tanpa jadwal resmi');
  });

  it('menolak legacy tanpa alasan', async () => {
    await seedBa('BA-PEL-LEGACY2');
    const admin = await adminCtx();
    const res = await setBaLegacy(env.DB, 'BA-PEL-LEGACY2', { legacy: true, reason: '   ' }, admin);
    expect(res.success).toBe(false);
    expect(res.message).toContain('Alasan');
  });

  it('menolak legacy bila BA sudah punya sesi', async () => {
    await seedBa('BA-PEL-LEGACY3');
    await env.DB.prepare(
      "INSERT INTO jadwal_pelaksanaan (timestamp, jadwal_id, bagian, blok, nama_kegiatan, kegiatan_key, tanggal, jam, dosen, active) " +
      "VALUES ('2026-09-10T08:00:00','JDW-2026-0001','SGD','A','SGD 1','sgd|a|sgd 1','2026-09-20','08:00','dr. Budi',1)"
    ).run();
    await env.DB.prepare("INSERT INTO berita_acara_sesi (timestamp, ba_id, jadwal_id, urutan) VALUES ('2026-09-10T08:00:00','BA-PEL-LEGACY3','JDW-2026-0001',1)").run();
    const admin = await adminCtx();
    const res = await setBaLegacy(env.DB, 'BA-PEL-LEGACY3', { legacy: true, reason: 'coba' }, admin);
    expect(res.success).toBe(false);
    expect(res.message).toContain('sudah memiliki sesi');
  });

  it('membatalkan penanda legacy dan mengosongkan alasan', async () => {
    await seedBa('BA-PEL-LEGACY4');
    const admin = await adminCtx();
    const set = await setBaLegacy(env.DB, 'BA-PEL-LEGACY4', { legacy: true, reason: 'BA lama' }, admin);
    expect(set.success).toBe(true);
    const unset = await setBaLegacy(env.DB, 'BA-PEL-LEGACY4', { legacy: false }, admin);
    expect(unset.success).toBe(true);
    const row = await env.DB.prepare('SELECT legacy_sesi, legacy_reason FROM berita_acara WHERE ba_id = ?1').bind('BA-PEL-LEGACY4').first();
    expect(Number(row.legacy_sesi)).toBe(0);
    expect(row.legacy_reason).toBe('');
  });
});

describe('Rapikan varian dosen', () => {
  async function seedBaWithJadwal(baId, dosenBa, dosenJadwal) {
    await env.DB.prepare(
      "INSERT INTO berita_acara (timestamp, ba_id, bagian, blok, nama_kegiatan, tanggal_pelaksanaan, jam, dosen, jumlah_peserta, sumber, kegiatan_key, jadwal_id) " +
      "VALUES ('2026-09-10T08:00:00', ?1, 'SGD', 'A', 'SGD 1', '2026-09-20', '08:00', ?2, '1', 'Bagian', 'sgd|a|sgd 1', 'JDW-2026-1001')"
    ).bind(baId, dosenBa).run();
    await env.DB.prepare(
      "INSERT INTO jadwal_pelaksanaan (timestamp, jadwal_id, bagian, blok, nama_kegiatan, kegiatan_key, tanggal, jam, dosen, active) " +
      "VALUES ('2026-09-10T08:00:00','JDW-2026-1001','SGD','A','SGD 1','sgd|a|sgd 1','2026-09-20','08:00',?1,1)"
    ).bind(dosenJadwal).run();
    await env.DB.prepare("INSERT INTO berita_acara_sesi (timestamp, ba_id, jadwal_id, urutan) VALUES ('2026-09-10T08:00:00',?1,'JDW-2026-1001',1)").bind(baId).run();
    await env.DB.prepare("INSERT INTO jadwal_dosen (timestamp, jadwal_id, nama, nama_key, urutan) VALUES ('2026-09-10T08:00:00','JDW-2026-1001',?1,?2,1)").bind(dosenJadwal, dosenJadwal.toLowerCase().replace(/[^a-z0-9]/g, '')).run();
    await env.DB.prepare("INSERT INTO ba_dosen (timestamp, ba_id, nama, nama_key, urutan) VALUES ('2026-09-10T08:00:00',?1,?2,?3,1)").bind(baId, dosenBa, dosenBa.toLowerCase().replace(/[^a-z0-9]/g, '')).run();
  }

  it('menulis nama baku ke jadwal_dosen dan ba_dosen untuk BA bersesi', async () => {
    await seedBaWithJadwal('BA-PEL-RENAME', 'dr.Budi', 'dr.Budi');
    const admin = await adminCtx();
    const res = await renameBaDosen(env.DB, 'BA-PEL-RENAME', { canonical: 'dr. Budi', variants: ['dr.Budi'] }, admin);
    expect(res.success).toBe(true);
    expect(res.dosenList).toEqual(['dr. Budi']);

    const jd = await env.DB.prepare("SELECT nama FROM jadwal_dosen WHERE jadwal_id = 'JDW-2026-1001' ORDER BY urutan").all();
    expect((jd.results || []).map((r) => r.nama)).toEqual(['dr. Budi']);
    const bd = await env.DB.prepare("SELECT nama FROM ba_dosen WHERE ba_id = 'BA-PEL-RENAME' ORDER BY urutan").all();
    expect((bd.results || []).map((r) => r.nama)).toEqual(['dr. Budi']);
    const ba = await env.DB.prepare("SELECT dosen FROM berita_acara WHERE ba_id = 'BA-PEL-RENAME'").first();
    expect(ba.dosen).toBe('dr. Budi');
    const jp = await env.DB.prepare("SELECT dosen FROM jadwal_pelaksanaan WHERE jadwal_id = 'JDW-2026-1001'").first();
    expect(jp.dosen).toBe('dr. Budi');
  });
});
