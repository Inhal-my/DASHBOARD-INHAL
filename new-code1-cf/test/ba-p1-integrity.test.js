import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { saveJadwalPelaksanaan } from '../src/write/jadwal.js';
import {
  saveBeritaAcaraBagian, deleteBeritaAcaraBagian, deleteBeritaAcaraAdmin
} from '../src/write/beritaAcara.js';

afterEach(() => { vi.unstubAllGlobals(); });

const BRIDGE = { GAS_DRIVE_URL: 'https://script.example/exec', GAS_DRIVE_TOKEN: 'tok' };

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), env: { ...BRIDGE } };
}

async function bagianCtx(kategoris = ['SGD']) {
  return { token: await createSession(env.DB, { role: 'bagian', nama: 'Bagian', kategoris }), env: {} };
}

async function seedPengajuan(id = 'INHAL-1', npm = '2201010001', nama = 'Aisyah', pilihan = 'SGD 1', blok = 'A') {
  await env.DB.prepare(
    "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00',?1,?2,?3,?4,'SGD','ACC')"
  ).bind(id, npm, nama, blok).run();
  await env.DB.prepare(
    "INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00',?1,'SGD',?2,'','2026-09-20','')"
  ).bind(id, pilihan).run();
}

function peserta(id = 'INHAL-1', npm = '2201010001', nama = 'Aisyah') {
  return [{ idPengajuan: id, npm, namaLengkap: nama, blok: 'A', statusPengajuan: 'ACC' }];
}

describe('validasi BA Pelaksanaan', () => {
  it('menolak jadwal yang tanggalnya tidak cocok dengan BA', async () => {
    await seedPengajuan();
    const section = await bagianCtx();
    const jadwal = await saveJadwalPelaksanaan(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggal: '2026-09-20',
      jam: '09:00', dosen: 'dr. Andi', catatan: '', peserta: peserta()
    }, 'SGD', section);

    const res = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-21',
      catatan: '', jadwalId: jadwal.jadwalId, peserta: peserta()
    }, 'SGD', section);

    expect(res.success).toBe(false);
    expect(res.message).toContain('tanggal');
  });

  it('menolak peserta yang tidak ada di data pengajuan', async () => {
    await seedPengajuan();
    const res = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20',
      catatan: '', peserta: peserta('INHAL-X', '9999999999', 'Tidak Ada')
    }, 'SGD', await bagianCtx());

    expect(res.success).toBe(false);
    expect(res.message).toContain('tidak ditemukan');
  });

  it('menolak peserta yang tidak terdaftar pada kegiatan BA', async () => {
    await seedPengajuan();
    const res = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 2', tanggalPelaksanaan: '2026-09-20',
      catatan: '', peserta: peserta()
    }, 'SGD', await bagianCtx());

    expect(res.success).toBe(false);
    expect(res.message).toContain('kegiatan');
  });
});

describe('hapus BA tidak meninggalkan data yatim', () => {
  it('menghapus berkas halaman dan dokumen dasar BA Pendukung', async () => {
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jumlah_peserta,file_url,base_file_url,sumber,kegiatan_key) " +
      "VALUES ('2026-10-01T08:00:00','BA-PEN-2026-0001','SGD','A','SGD 1','2026-10-20','1','https://drive.google.com/file/d/MAINFILE00000000000000AA/view','https://drive.google.com/file/d/BASEFILE00000000000000AA/view','Admin','sgd|a|sgd 1')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok,bagian,status_pengajuan,urutan,active) " +
      "VALUES ('2026-10-01T08:00:00','BA-PEN-2026-0001','INHAL-1','2201010001','Aisyah','A','SGD','ACC',1,1)"
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin_berkas (timestamp,ba_id,id_pengajuan,npm,urutan,page_index,file_name,file_url,active) " +
      "VALUES ('2026-10-01T08:00:00','BA-PEN-2026-0001','INHAL-1','2201010001',1,0,'p1.jpg','https://drive.google.com/file/d/PAGEFILE0000000000000AA/view',1)"
    ).run();

    const trashed = [];
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      const body = JSON.parse(opts.body);
      if (body.action === 'trashFile') trashed.push(body.fileId);
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }));

    const res = await deleteBeritaAcaraAdmin(env.DB, 'BA-PEN-2026-0001', await adminCtx());
    expect(res.success).toBe(true);
    const berkas = await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara_admin_berkas').first();
    expect(Number(berkas.n)).toBe(0);
    expect(trashed).toEqual(expect.arrayContaining([
      'MAINFILE00000000000000AA',
      'BASEFILE00000000000000AA',
      'PAGEFILE0000000000000AA'
    ]));
  });

  it('menghapus satu BA Pelaksanaan memulihkan data dari BA lain yang tersisa', async () => {
    await seedPengajuan();
    const section = await bagianCtx();
    const base = {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', catatan: '', peserta: peserta()
    };
    const first = await saveBeritaAcaraBagian(env.DB, {
      ...base, tanggalPelaksanaan: '2026-09-20', jam: '09:00', dosen: 'dr. Andi'
    }, 'SGD', section);
    const second = await saveBeritaAcaraBagian(env.DB, {
      ...base, tanggalPelaksanaan: '2026-09-21', jam: '10:00', dosen: 'dr. Budi'
    }, 'SGD', section);
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);

    const del = await deleteBeritaAcaraBagian(env.DB, second.baId, await adminCtx());
    expect(del.success).toBe(true);

    const p = await env.DB.prepare('SELECT dosen, tanggal_pelaksanaan FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(p.dosen).toBe('dr. Andi');
    expect(p.tanggal_pelaksanaan).toBe('2026-09-20T09:00');
  });
});
