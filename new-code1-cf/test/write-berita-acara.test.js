import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import {
  saveBeritaAcaraAdmin, deleteBeritaAcaraAdmin, saveBeritaAcaraBagian, deleteBeritaAcaraBagian,
  updateBeritaAcaraBagian, updateBeritaAcaraAdmin
} from '../src/write/beritaAcara.js';

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), env: {} };
}
async function bagianCtx(kategoris) {
  return { token: await createSession(env.DB, { role: 'bagian', nama: 'Bagian', kategoris: kategoris || ['SGD'] }), env: {} };
}

async function seedPengajuan({ status = 'Diterima' } = {}) {
  await env.DB.prepare(
    "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','SGD',?1)"
  ).bind(status).run();
  await env.DB.prepare(
    "INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','SGD','SGD 1','','2026-09-20','')"
  ).run();
}

const adminPayload = {
  bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20T09:00',
  jenis: 'SGD', pilihan: 'SGD 1', detail: '', catatan: ''
};

describe('berita acara admin', () => {
  it('requires admin', async () => {
    await expect(saveBeritaAcaraAdmin(env.DB, {}, {})).rejects.toThrow();
    await expect(deleteBeritaAcaraAdmin(env.DB, 'BA-2026-0001', {})).rejects.toThrow();
  });

  it('resolves peserta from detail and stores the BA', async () => {
    await seedPengajuan();
    const ctx = await adminCtx();
    const res = await saveBeritaAcaraAdmin(env.DB, adminPayload, ctx);
    expect(res.success).toBe(true);
    expect(res.baId).toMatch(/^BA-PEN-\d{4}-0001$/);

    const ba = await env.DB.prepare('SELECT * FROM berita_acara_admin WHERE ba_id = ?1').bind(res.baId).first();
    expect(ba.sumber).toBe('Admin');
    expect(Number(ba.jumlah_peserta)).toBe(1);
    const pes = await env.DB.prepare('SELECT * FROM berita_acara_admin_peserta WHERE ba_id = ?1').bind(res.baId).all();
    expect(pes.results).toHaveLength(1);
    expect(pes.results[0].npm).toBe('2201010001');
  });

  it('rejects uploads without any peserta', async () => {
    const ctx = await adminCtx();
    const res = await saveBeritaAcaraAdmin(env.DB, { bagian: 'SGD', blok: 'A', namaKegiatan: 'X', tanggalPelaksanaan: '2026-09-20', jenis: '', pilihan: '', detail: '' }, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('tidak ada peserta');
  });

  it('menolak BA Pendukung kedua untuk kegiatan yang sama', async () => {
    await seedPengajuan();
    const ctx = await adminCtx();
    const first = await saveBeritaAcaraAdmin(env.DB, { ...adminPayload, jam: '10:15' }, ctx);
    expect(first.success).toBe(true);
    const second = await saveBeritaAcaraAdmin(env.DB, { ...adminPayload, jam: '11:00' }, ctx);
    expect(second.success).toBe(false);
    expect(second.message).toContain('sudah ada');
  });

  it('memperbarui BA Pendukung', async () => {
    await seedPengajuan();
    const ctx = await adminCtx();
    const res = await saveBeritaAcaraAdmin(env.DB, { ...adminPayload, jam: '10:15' }, ctx);
    const up = await updateBeritaAcaraAdmin(env.DB, res.baId, { tanggal: '2026-09-21', jam: '08:00', catatan: 'ok' }, ctx);
    expect(up.success).toBe(true);
    const ba = await env.DB.prepare('SELECT tanggal_pelaksanaan, jam, catatan FROM berita_acara_admin WHERE ba_id = ?1').bind(res.baId).first();
    expect(ba.jam).toBe('08:00');
    expect(ba.tanggal_pelaksanaan).toBe('2026-09-21');
    expect(ba.catatan).toBe('ok');
  });

  it('deletes the BA and its peserta', async () => {
    await seedPengajuan();
    const ctx = await adminCtx();
    const res = await saveBeritaAcaraAdmin(env.DB, adminPayload, ctx);
    const del = await deleteBeritaAcaraAdmin(env.DB, res.baId, ctx);
    expect(del.success).toBe(true);
    const ba = await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara_admin').first();
    const pes = await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara_admin_peserta').first();
    expect(Number(ba.n)).toBe(0);
    expect(Number(pes.n)).toBe(0);
  });
});

describe('berita acara bagian', () => {
  const payload = {
    bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20', catatan: '',
    peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'Diterima' }]
  };

  it('stores a BA with Sumber Bagian and blocks duplicates', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx(['SGD']);
    const res = await saveBeritaAcaraBagian(env.DB, payload, 'SGD', ctx);
    expect(res.success).toBe(true);
    const ba = await env.DB.prepare('SELECT * FROM berita_acara WHERE ba_id = ?1').bind(res.baId).first();
    expect(res.baId).toMatch(/^BA-PEL-\d{4}-0001$/);
    expect(ba.sumber).toBe('Bagian');

    const dup = await saveBeritaAcaraBagian(env.DB, payload, 'SGD', ctx);
    expect(dup.success).toBe(false);
    expect(dup.message).toContain('sudah ada berita acara');
  });

  it('menyimpan jam, dosen, dan kegiatan_key serta menyinkron ke pengajuan', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx(['SGD']);
    const res = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20',
      jam: '09:00', dosen: 'dr. Andi', catatan: '',
      peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'Diterima' }]
    }, 'SGD', ctx);
    expect(res.success).toBe(true);
    const ba = await env.DB.prepare('SELECT jam, dosen, kegiatan_key FROM berita_acara WHERE ba_id = ?1').bind(res.baId).first();
    expect(ba.jam).toBe('09:00');
    expect(ba.dosen).toBe('dr. Andi');
    expect(ba.kegiatan_key).toBe('sgd|a|sgd 1');
    const p = await env.DB.prepare('SELECT dosen, tanggal_pelaksanaan FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(p.dosen).toBe('dr. Andi');
    expect(p.tanggal_pelaksanaan).toBe('2026-09-20T09:00');
  });

  it('rejects peserta whose current status is not allowed', async () => {
    await seedPengajuan({ status: 'Menunggu' });
    const ctx = await bagianCtx(['SGD']);
    const res = await saveBeritaAcaraBagian(env.DB, payload, 'SGD', ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('belum berstatus');
  });

  it('denies a session without access to the kategori', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx(['KKD']);
    await expect(saveBeritaAcaraBagian(env.DB, payload, 'SGD', ctx)).rejects.toThrow();
  });

  it('deletes a BA and its peserta', async () => {
    await seedPengajuan();
    const bagian = await bagianCtx(['SGD']);
    const res = await saveBeritaAcaraBagian(env.DB, payload, 'SGD', bagian);
    const admin = await adminCtx();
    const del = await deleteBeritaAcaraBagian(env.DB, res.baId, admin);
    expect(del.success).toBe(true);
    const ba = await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara').first();
    const pes = await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara_peserta').first();
    expect(Number(ba.n)).toBe(0);
    expect(Number(pes.n)).toBe(0);
  });

  it('menghapus BA mengosongkan dosen dan tanggal pelaksanaan peserta', async () => {
    await seedPengajuan();
    const bagian = await bagianCtx(['SGD']);
    const res = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20',
      jam: '09:00', dosen: 'dr. Andi', catatan: '',
      peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'Diterima' }]
    }, 'SGD', bagian);
    const admin = await adminCtx();
    await deleteBeritaAcaraBagian(env.DB, res.baId, admin);
    const p = await env.DB.prepare('SELECT dosen, tanggal_pelaksanaan FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(p.dosen).toBe('');
    expect(p.tanggal_pelaksanaan).toBe('');
  });

  it('memperbarui jam dan dosen serta menyinkron ulang pengajuan', async () => {
    await seedPengajuan();
    const ctx = await adminCtx();
    const res = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20',
      catatan: '', peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'Diterima' }]
    }, 'SGD', await bagianCtx(['SGD']));
    const up = await updateBeritaAcaraBagian(env.DB, res.baId, { tanggal: '2026-09-20', jam: '13:30', dosen: 'dr. Budi', catatan: 'revisi' }, ctx);
    expect(up.success).toBe(true);
    const ba = await env.DB.prepare('SELECT jam, dosen, catatan FROM berita_acara WHERE ba_id = ?1').bind(res.baId).first();
    expect(ba.jam).toBe('13:30');
    expect(ba.dosen).toBe('dr. Budi');
    expect(ba.catatan).toBe('revisi');
    const p = await env.DB.prepare('SELECT dosen, tanggal_pelaksanaan FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(p.dosen).toBe('dr. Budi');
    expect(p.tanggal_pelaksanaan).toBe('2026-09-20T13:30');
  });

  it('requires admin to delete and reports missing BA', async () => {
    await seedPengajuan();
    await expect(deleteBeritaAcaraBagian(env.DB, 'BA-2026-0001', {})).rejects.toThrow();
    const admin = await adminCtx();
    const missing = await deleteBeritaAcaraBagian(env.DB, 'BA-9999-9999', admin);
    expect(missing.success).toBe(false);
    expect(missing.message).toContain('tidak ditemukan');
  });
});
