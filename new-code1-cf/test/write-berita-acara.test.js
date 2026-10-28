import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import {
  saveBeritaAcaraAdmin, deleteBeritaAcaraAdmin, saveBeritaAcaraBagian, deleteBeritaAcaraBagian,
  updateBeritaAcaraBagian, updateBeritaAcaraAdmin, lengkapiBeritaAcaraBagian
} from '../src/write/beritaAcara.js';

afterEach(() => { vi.unstubAllGlobals(); });

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), env: {} };
}
async function bagianCtx(kategoris) {
  return { token: await createSession(env.DB, { role: 'bagian', nama: 'Bagian', kategoris: kategoris || ['SGD'] }), env: {} };
}

async function seedPengajuan({ status = 'ACC' } = {}) {
  await env.DB.prepare(
    "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','SGD',?1)"
  ).bind(status).run();
  await env.DB.prepare(
    "INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','SGD','SGD 1','','2026-09-20','')"
  ).run();
}

async function seedPengajuanTambahan(rows) {
  for (const r of rows) {
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00',?1,?2,?3,'A','SGD',?4)"
    ).bind(r.id, r.npm, r.nama, r.status || 'ACC').run();
    await env.DB.prepare(
      "INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00',?1,'SGD',?2,'','2026-09-20','')"
    ).bind(r.id, r.kegiatan || 'SGD 1').run();
  }
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
    const audit = await env.DB.prepare("SELECT aksi FROM audit_log WHERE target = ?1 AND aksi = 'BA_CREATE'").bind(res.baId).first();
    expect(audit.aksi).toBe('BA_CREATE');
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

  it('tidak menyimpan BA Pendukung ganda saat dua unggahan bersamaan', async () => {
    await seedPengajuan();
    const ctx = await adminCtx();
    await Promise.all([
      saveBeritaAcaraAdmin(env.DB, { ...adminPayload, jam: '10:15' }, ctx),
      saveBeritaAcaraAdmin(env.DB, { ...adminPayload, jam: '11:00' }, ctx)
    ]);
    const ba = await env.DB.prepare("SELECT ba_id FROM berita_acara_admin WHERE nama_kegiatan = 'SGD 1'").all();
    expect(ba.results).toHaveLength(1);
    const pes = await env.DB.prepare('SELECT ba_id FROM berita_acara_admin_peserta').all();
    expect(pes.results).toHaveLength(1);
    expect(pes.results[0].ba_id).toBe(ba.results[0].ba_id);
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
    peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'ACC' }]
  };

  it('stores a BA with Sumber Bagian (duplikat kegiatan kini diizinkan)', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx(['SGD']);
    const res = await saveBeritaAcaraBagian(env.DB, payload, 'SGD', ctx);
    expect(res.success).toBe(true);
    const ba = await env.DB.prepare('SELECT * FROM berita_acara WHERE ba_id = ?1').bind(res.baId).first();
    expect(res.baId).toMatch(/^BA-PEL-\d{4}-0001$/);
    expect(ba.sumber).toBe('Bagian');

    const second = await saveBeritaAcaraBagian(env.DB, payload, 'SGD', ctx);
    expect(second.success).toBe(true);
    expect(second.baId).not.toBe(res.baId);
  });

  it('menyimpan BA Pelaksanaan kedua untuk kegiatan sama dengan tanggal berbeda', async () => {
    await seedPengajuan({ status: 'ACC' });
    const ctx = await bagianCtx(['SGD']);
    const first = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20', catatan: '',
      peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'ACC' }]
    }, 'SGD', ctx);
    const second = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-21', label: 'Sesi 2', catatan: '',
      peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'ACC' }]
    }, 'SGD', ctx);
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    const rows = await env.DB.prepare("SELECT ba_id, tanggal_pelaksanaan, label FROM berita_acara ORDER BY ba_id").all();
    expect(rows.results).toHaveLength(2);
    expect(rows.results[1].tanggal_pelaksanaan).toBe('2026-09-21');
    expect(rows.results[1].label).toBe('Sesi 2');
    const pes = await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara_peserta').first();
    expect(Number(pes.n)).toBe(2);
  });

  it('menyimpan BA Pelaksanaan kedua walau tanggal sama (dibedakan label)', async () => {
    await seedPengajuan({ status: 'ACC' });
    const ctx = await bagianCtx(['SGD']);
    const base = {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', catatan: '',
      peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'ACC' }]
    };
    await saveBeritaAcaraBagian(env.DB, { ...base, tanggalPelaksanaan: '2026-09-20', label: 'Sesi 1' }, 'SGD', ctx);
    const second = await saveBeritaAcaraBagian(env.DB, { ...base, tanggalPelaksanaan: '2026-09-20', label: 'Sesi 2' }, 'SGD', ctx);
    expect(second.success).toBe(true);
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara').first();
    expect(Number(n.n)).toBe(2);
  });

  it('mengunggah dan menyimpan file BA ke Drive', async () => {
    await seedPengajuan();
    const ctx = {
      token: await createSession(env.DB, { role: 'bagian', nama: 'Bagian', kategoris: ['SGD'] }),
      env: { GAS_DRIVE_URL: 'https://script.example/exec', GAS_DRIVE_TOKEN: 'tok' }
    };
    const f = vi.fn(async () => new Response(
      JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/AAAABBBBCCCCDDDDEEEEFFFFGGGG12345/view', fileId: 'x' }),
      { status: 200 }
    ));
    vi.stubGlobal('fetch', f);

    const res = await saveBeritaAcaraBagian(env.DB, {
      ...payload,
      file: { data: btoa('%PDF-1.4 berkas berita acara'), mimeType: 'application/pdf', name: 'ba.pdf' }
    }, 'SGD', ctx);
    expect(res.success).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);

    const ba = await env.DB.prepare('SELECT file_url, file_name FROM berita_acara WHERE ba_id = ?1').bind(res.baId).first();
    expect(ba.file_url).toContain('AAAABBBBCCCCDDDDEEEEFFFFGGGG12345');
    expect(ba.file_name).toBe('ba.pdf');
  });

  it('menerima berkas BA walau browser tidak mengirim mimeType', async () => {
    await seedPengajuan();
    const ctx = {
      token: await createSession(env.DB, { role: 'bagian', nama: 'Bagian', kategoris: ['SGD'] }),
      env: { GAS_DRIVE_URL: 'https://script.example/exec', GAS_DRIVE_TOKEN: 'tok' }
    };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/AAAABBBBCCCCDDDDEEEEFFFFGGGG12345/view' }),
      { status: 200 }
    )));
    const res = await saveBeritaAcaraBagian(env.DB, {
      ...payload,
      file: { data: btoa('%PDF-1.4 berkas berita acara'), mimeType: '', name: 'ba.pdf' }
    }, 'SGD', ctx);
    expect(res.success).toBe(true);
  });

  it('issues consecutive BA ids', async () => {
    await seedPengajuan();
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-2','2201010002','Budi','A','SGD','ACC')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-2','SGD','SGD 2','','2026-09-20','')"
    ).run();
    const ctx = await bagianCtx(['SGD']);
    const first = await saveBeritaAcaraBagian(env.DB, payload, 'SGD', ctx);
    const second = await saveBeritaAcaraBagian(env.DB, {
      ...payload,
      namaKegiatan: 'SGD 2',
      peserta: [{ idPengajuan: 'INHAL-2', npm: '2201010002', namaLengkap: 'Budi', blok: 'A', statusPengajuan: 'ACC' }]
    }, 'SGD', ctx);
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    const nums = [first.baId, second.baId].map((id) => parseInt(id.slice(-4), 10)).sort((a, b) => a - b);
    expect(nums).toEqual([1, 2]);
    expect(first.baId).not.toBe(second.baId);
  });

  it('menyimpan jam, dosen, dan kegiatan_key serta menyinkron ke pengajuan', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx(['SGD']);
    const res = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20',
      jam: '09:00', dosen: 'dr. Andi', catatan: '',
      peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'ACC' }]
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
      peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'ACC' }]
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
      catatan: '', peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'ACC' }]
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

  it('mengganti peserta BA Pelaksanaan lewat pesertaIds tanpa mengubah file', async () => {
    await seedPengajuan();
    await seedPengajuanTambahan([
      { id: 'INHAL-2', npm: '2201010002', nama: 'Budi' },
      { id: 'INHAL-3', npm: '2201010003', nama: 'Citra' },
      { id: 'INHAL-4', npm: '2201010004', nama: 'Dewi' }
    ]);
    const bagian = await bagianCtx(['SGD']);
    const res = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20',
      jam: '09:00', dosen: 'dr. Andi', catatan: '',
      peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'ACC' }]
    }, 'SGD', bagian);
    await env.DB.prepare('UPDATE berita_acara SET file_url = ?1 WHERE ba_id = ?2')
      .bind('https://drive.google.com/file/d/AAAABBBBCCCCDDDDEEEEFFFFGGGG12345/view', res.baId).run();

    const admin = await adminCtx();
    const up = await updateBeritaAcaraBagian(env.DB, res.baId, {
      pesertaIds: ['INHAL-1', 'INHAL-2', 'INHAL-3', 'INHAL-4']
    }, admin);
    expect(up.success).toBe(true);
    expect(up.jumlahPeserta).toBe(4);

    const ba = await env.DB.prepare('SELECT jumlah_peserta, file_url, dosen, jam FROM berita_acara WHERE ba_id = ?1').bind(res.baId).first();
    expect(Number(ba.jumlah_peserta)).toBe(4);
    expect(ba.file_url).toContain('AAAABBBBCCCCDDDDEEEEFFFFGGGG12345');
    expect(ba.dosen).toBe('dr. Andi');
    expect(ba.jam).toBe('09:00');

    const rows = await env.DB.prepare('SELECT id_pengajuan FROM berita_acara_peserta WHERE ba_id = ?1 ORDER BY id_pengajuan').bind(res.baId).all();
    expect(rows.results.map((r) => r.id_pengajuan)).toEqual(['INHAL-1', 'INHAL-2', 'INHAL-3', 'INHAL-4']);
    const p2 = await env.DB.prepare('SELECT dosen, tanggal_pelaksanaan FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-2').first();
    expect(p2.dosen).toBe('dr. Andi');
    expect(p2.tanggal_pelaksanaan).toBe('2026-09-20T09:00');
  });

  it('menolak peserta BA Pelaksanaan dari kegiatan lain atau daftar kosong', async () => {
    await seedPengajuan();
    await seedPengajuanTambahan([{ id: 'INHAL-9', npm: '2201010009', nama: 'Lain', kegiatan: 'SGD 2' }]);
    const bagian = await bagianCtx(['SGD']);
    const res = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20',
      catatan: '', peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'ACC' }]
    }, 'SGD', bagian);
    const admin = await adminCtx();

    const beda = await updateBeritaAcaraBagian(env.DB, res.baId, { pesertaIds: ['INHAL-1', 'INHAL-9'] }, admin);
    expect(beda.success).toBe(false);
    expect(beda.message).toContain('tidak sesuai');

    const kosong = await updateBeritaAcaraBagian(env.DB, res.baId, { pesertaIds: [] }, admin);
    expect(kosong.success).toBe(false);
    expect(kosong.message).toContain('minimal satu peserta');

    const rows = await env.DB.prepare('SELECT id_pengajuan FROM berita_acara_peserta WHERE ba_id = ?1').bind(res.baId).all();
    expect(rows.results.map((r) => r.id_pengajuan)).toEqual(['INHAL-1']);
  });

  it('mengeluarkan peserta BA dan memulihkan dosen/tanggal pengajuan', async () => {
    await seedPengajuan();
    await seedPengajuanTambahan([{ id: 'INHAL-2', npm: '2201010002', nama: 'Budi' }]);
    const bagian = await bagianCtx(['SGD']);
    const res = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20',
      jam: '09:00', dosen: 'dr. Andi', catatan: '',
      peserta: [
        { idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'ACC' },
        { idPengajuan: 'INHAL-2', npm: '2201010002', namaLengkap: 'Budi', blok: 'A', statusPengajuan: 'ACC' }
      ]
    }, 'SGD', bagian);
    const admin = await adminCtx();
    const up = await updateBeritaAcaraBagian(env.DB, res.baId, { pesertaIds: ['INHAL-1'] }, admin);
    expect(up.success).toBe(true);
    expect(up.jumlahPeserta).toBe(1);

    const p2 = await env.DB.prepare('SELECT dosen, tanggal_pelaksanaan FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-2').first();
    expect(p2.dosen).toBe('');
    expect(p2.tanggal_pelaksanaan).toBe('');
  });

  it('menyimpan catatan BA dari form lengkapi dan mempertahankannya bila tidak dikirim', async () => {
    await seedPengajuan();
    await seedPengajuanTambahan([{ id: 'INHAL-2', npm: '2201010002', nama: 'Budi' }]);
    const bagian = await bagianCtx(['SGD']);
    const res = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20', catatan: '',
      peserta: [
        { idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'ACC' },
        { idPengajuan: 'INHAL-2', npm: '2201010002', namaLengkap: 'Budi', blok: 'A', statusPengajuan: 'ACC' }
      ]
    }, 'SGD', bagian);

    const lengkapi = await lengkapiBeritaAcaraBagian(env.DB, res.baId, {
      dosen: 'dr. Andi', jam: '09:00', tanggal: '2026-09-20',
      catatan: 'Ruang lab 2, dua peserta hadir.'
    }, 'SGD', bagian);
    expect(lengkapi.success).toBe(true);

    const ba = await env.DB.prepare('SELECT catatan, jumlah_peserta FROM berita_acara WHERE ba_id = ?1').bind(res.baId).first();
    expect(ba.catatan).toBe('Ruang lab 2, dua peserta hadir.');
    expect(Number(ba.jumlah_peserta)).toBe(2);

    // Simpan perubahan berikutnya tanpa field catatan tidak boleh menghapus catatan lama.
    const kedua = await lengkapiBeritaAcaraBagian(env.DB, res.baId, { jam: '10:00' }, 'SGD', bagian);
    expect(kedua.success).toBe(true);
    const after = await env.DB.prepare('SELECT catatan, jam FROM berita_acara WHERE ba_id = ?1').bind(res.baId).first();
    expect(after.jam).toBe('10:00');
    expect(after.catatan).toBe('Ruang lab 2, dua peserta hadir.');
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
