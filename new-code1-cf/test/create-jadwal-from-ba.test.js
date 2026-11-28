import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { createJadwalFromBa } from '../src/write/baRepair.js';

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), env: {} };
}

async function seedPengajuan(id, npm, nama, status) {
  await env.DB.prepare(
    "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00',?1,?2,?3,'A','SGD',?4)"
  ).bind(id, npm, nama, status || 'ACC').run();
}

async function seedMasterDosen(nama) {
  await env.DB.prepare("INSERT OR IGNORE INTO master_kegiatan (kategori, nilai) VALUES ('Dosen', ?1)").bind(nama).run();
}

async function seedBa(opts) {
  const o = opts || {};
  const baId = o.baId || 'BA-PEL-2026-9001';
  const tanggal = o.tanggal || '2026-09-20';
  const jam = o.jam === undefined ? '09:00' : o.jam;
  await env.DB.prepare(
    'INSERT INTO berita_acara (timestamp, ba_id, bagian, blok, nama_kegiatan, tanggal_pelaksanaan, jam, dosen, jumlah_peserta, kegiatan_key, jadwal_id, archived_at, revision) ' +
    'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)'
  ).bind('2026-09-20T08:00:00', baId, o.bagian || 'SGD', o.blok || 'A', o.namaKegiatan || 'SGD 1',
    tanggal, jam, o.dosen || 'dr. Andi', '1', o.kegiatanKey || 'sgd|a|sgd 1',
    o.jadwalId || '', o.archivedAt || '', o.revision || 0).run();
  await env.DB.prepare(
    'INSERT INTO berita_acara_peserta (timestamp, ba_id, id_pengajuan, npm, nama_lengkap, blok, bagian, status_pengajuan) ' +
    "VALUES ('2026-09-20T08:00:00', ?1, 'INHAL-1', '2201010001', 'Aisyah', 'A', 'SGD', 'ACC')"
  ).bind(baId).run();
  const dosenList = Array.isArray(o.dosenList) ? o.dosenList : [o.dosen || 'dr. Andi'];
  for (let i = 0; i < dosenList.length; i += 1) {
    await env.DB.prepare(
      'INSERT INTO ba_dosen (timestamp, ba_id, nama, nama_key, urutan) VALUES (?1, ?2, ?3, ?4, ?5)'
    ).bind('2026-09-20T08:00:00', baId, dosenList[i], dosenList[i].toLowerCase(), i + 1).run();
  }
  return baId;
}

beforeEach(async () => {
  await seedMasterDosen('dr. Andi');
  await seedMasterDosen('dr. Budi');
  await seedPengajuan('INHAL-1', '2201010001', 'Aisyah', 'ACC');
});

describe('create jadwal from BA', () => {
  it('membuat jadwal, dosen, peserta, dan menautkan sesi tanpa menghapus data', async () => {
    const baId = await seedBa({});
    const ctx = await adminCtx();
    const res = await createJadwalFromBa(env.DB, {
      baId,
      tanggal: '2026-09-20',
      jam: '09:30',
      dosenList: ['dr. Andi'],
      expectedRevision: 0
    }, ctx);

    expect(res.success).toBe(true);
    expect(res.jadwalId).toMatch(/^JDW-\d{4}-\d{4}$/);

    const jadwal = await env.DB.prepare('SELECT * FROM jadwal_pelaksanaan WHERE jadwal_id = ?1').bind(res.jadwalId).first();
    expect(jadwal.bagian).toBe('SGD');
    expect(jadwal.tanggal).toBe('2026-09-20');
    expect(jadwal.jam).toBe('09:30');
    expect(jadwal.active).toBe(1);
    expect(jadwal.created_by).toBe('Admin');

    const dosen = await env.DB.prepare('SELECT nama FROM jadwal_dosen WHERE jadwal_id = ?1 ORDER BY urutan').bind(res.jadwalId).all();
    expect(dosen.results.map((r) => r.nama)).toEqual(['dr. Andi']);

    const peserta = await env.DB.prepare('SELECT id_pengajuan FROM jadwal_peserta WHERE jadwal_id = ?1').bind(res.jadwalId).all();
    expect(peserta.results.map((r) => r.id_pengajuan)).toEqual(['INHAL-1']);

    const sesi = await env.DB.prepare('SELECT jadwal_id, urutan FROM berita_acara_sesi WHERE ba_id = ?1').bind(baId).all();
    expect(sesi.results).toEqual([{ jadwal_id: res.jadwalId, urutan: 1 }]);

    const ba = await env.DB.prepare('SELECT jam, tanggal_pelaksanaan, jadwal_id, revision FROM berita_acara WHERE ba_id = ?1').bind(baId).first();
    expect(ba.jam).toBe('09:30');
    expect(ba.tanggal_pelaksanaan).toBe('2026-09-20');
    expect(ba.jadwal_id).toBe(res.jadwalId);
    expect(ba.revision).toBe(1);

    const baDosen = await env.DB.prepare('SELECT COUNT(*) AS n FROM ba_dosen WHERE ba_id = ?1').bind(baId).first();
    expect(baDosen.n).toBe(1);
    const baPeserta = await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara_peserta WHERE ba_id = ?1').bind(baId).first();
    expect(baPeserta.n).toBe(1);

    const audit = await env.DB.prepare("SELECT aksi, detail FROM audit_log WHERE target = ?1 AND aksi = 'BA_UPDATE'").bind(baId).first();
    expect(audit).toBeTruthy();
    expect(audit.detail).toContain('createJadwalFromBa');
  });

  it('membatalkan penanda legacy saat jadwal dibuat dan ditautkan', async () => {
    const baId = await seedBa({});
    await env.DB.prepare(
      "UPDATE berita_acara SET legacy_sesi = 1, legacy_reason = 'BA lama', legacy_at = '2026-09-01T00:00:00', legacy_by = 'Admin' WHERE ba_id = ?1"
    ).bind(baId).run();
    const ctx = await adminCtx();
    const res = await createJadwalFromBa(env.DB, {
      baId,
      tanggal: '2026-09-20',
      jam: '09:30',
      dosenList: ['dr. Andi']
    }, ctx);
    expect(res.success).toBe(true);
    const ba = await env.DB.prepare('SELECT legacy_sesi, legacy_reason, legacy_at, legacy_by FROM berita_acara WHERE ba_id = ?1').bind(baId).first();
    expect(Number(ba.legacy_sesi)).toBe(0);
    expect(ba.legacy_reason).toBe('');
    expect(ba.legacy_at).toBe('');
    expect(ba.legacy_by).toBe('');
  });

  it('mewajibkan jam pelaksanaan', async () => {
    const baId = await seedBa({ jam: '' });
    const ctx = await adminCtx();
    const res = await createJadwalFromBa(env.DB, { baId, tanggal: '2026-09-20', jam: '', dosenList: ['dr. Andi'] }, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('Jam');
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM jadwal_pelaksanaan').first();
    expect(n.n).toBe(0);
  });

  it('menolak BA yang sudah memiliki sesi jadwal', async () => {
    const baId = await seedBa({});
    await env.DB.prepare("INSERT INTO berita_acara_sesi (timestamp, ba_id, jadwal_id, urutan) VALUES ('2026-09-20T08:00:00', ?1, 'JDW-2026-0001', 1)").bind(baId).run();
    const ctx = await adminCtx();
    const res = await createJadwalFromBa(env.DB, { baId, jam: '09:30', dosenList: ['dr. Andi'] }, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('sudah memiliki sesi');
  });

  it('menolak BA yang diarsipkan', async () => {
    const baId = await seedBa({ archivedAt: '2026-09-21T00:00:00' });
    const ctx = await adminCtx();
    const res = await createJadwalFromBa(env.DB, { baId, jam: '09:30', dosenList: ['dr. Andi'] }, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('arsip');
  });

  it('menolak dosen yang tidak ada di master', async () => {
    const baId = await seedBa({});
    const ctx = await adminCtx();
    const res = await createJadwalFromBa(env.DB, { baId, jam: '09:30', dosenList: ['dr. Tidak Ada'] }, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('master');
  });

  it('mendukung lebih dari satu dosen', async () => {
    const baId = await seedBa({ dosenList: ['dr. Andi', 'dr. Budi'] });
    const ctx = await adminCtx();
    const res = await createJadwalFromBa(env.DB, { baId, jam: '09:30', dosenList: ['dr. Andi', 'dr. Budi'] }, ctx);
    expect(res.success).toBe(true);
    const dosen = await env.DB.prepare('SELECT nama FROM jadwal_dosen WHERE jadwal_id = ?1 ORDER BY urutan').bind(res.jadwalId).all();
    expect(dosen.results.map((r) => r.nama)).toEqual(['dr. Andi', 'dr. Budi']);
  });

  it('menolak peserta dengan status yang tidak diizinkan', async () => {
    await env.DB.prepare("UPDATE pengajuan SET status = 'Proses' WHERE id_pengajuan = 'INHAL-1'").run();
    const baId = await seedBa({});
    const ctx = await adminCtx();
    const res = await createJadwalFromBa(env.DB, { baId, jam: '09:30', dosenList: ['dr. Andi'] }, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('status');
  });

  it('menolak duplikat jadwal aktif dengan peserta yang sama', async () => {
    const baId = await seedBa({});
    await env.DB.prepare(
      "INSERT INTO jadwal_pelaksanaan (timestamp, jadwal_id, bagian, blok, nama_kegiatan, kegiatan_key, tanggal, jam, dosen, active) VALUES ('2026-09-20T08:00:00', 'JDW-2026-8001', 'SGD', 'A', 'SGD 1', 'sgd|a|sgd 1', '2026-09-20', '09:30', 'dr. Andi', 1)"
    ).run();
    await env.DB.prepare(
      "INSERT INTO jadwal_peserta (timestamp, jadwal_id, id_pengajuan, npm, nama_lengkap, blok, status_pengajuan) VALUES ('2026-09-20T08:00:00', 'JDW-2026-8001', 'INHAL-1', '2201010001', 'Aisyah', 'A', 'ACC')"
    ).run();
    const ctx = await adminCtx();
    const res = await createJadwalFromBa(env.DB, { baId, jam: '09:30', dosenList: ['dr. Andi'] }, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('sudah ada');
  });

  it('menolak bila revisi BA sudah berubah', async () => {
    const baId = await seedBa({ revision: 3 });
    const ctx = await adminCtx();
    const res = await createJadwalFromBa(env.DB, { baId, jam: '09:30', dosenList: ['dr. Andi'], expectedRevision: 2 }, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('sudah berubah');
  });
});
