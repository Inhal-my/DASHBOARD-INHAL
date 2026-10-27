import { describe, it, expect, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { saveJadwalPelaksanaan } from '../src/write/jadwal.js';
import {
  saveBeritaAcaraBagian, lengkapiBeritaAcaraBagian, deleteDraftBeritaAcaraBagian
} from '../src/write/beritaAcara.js';

async function bagianCtx(kategoris = ['SGD']) {
  return { token: await createSession(env.DB, { role: 'bagian', nama: 'Bagian', kategoris }), env: {} };
}
async function seedPengajuan() {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','SGD','ACC')").run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','SGD','SGD 1','','2026-09-20','')").run();
}
const peserta = [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'ACC' }];

describe('BA merujuk jadwal', () => {
  it('menyimpan jadwal_id pada BA', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx();
    const j = await saveJadwalPelaksanaan(env.DB, { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggal: '2026-09-20', jam: '09:00', dosen: 'dr. Andi', catatan: '', peserta }, 'SGD', ctx);
    const res = await saveBeritaAcaraBagian(env.DB, { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20', jam: '09:00', dosen: 'dr. Andi', catatan: '', jadwalId: j.jadwalId, peserta }, 'SGD', ctx);
    expect(res.success).toBe(true);
    const ba = await env.DB.prepare('SELECT jadwal_id FROM berita_acara WHERE ba_id=?1').bind(res.baId).first();
    expect(ba.jadwal_id).toBe(j.jadwalId);
  });

  it('menolak BA kedua untuk jadwal yang sama', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx();
    const j = await saveJadwalPelaksanaan(env.DB, { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggal: '2026-09-20', jam: '09:00', dosen: 'dr. Andi', catatan: '', peserta }, 'SGD', ctx);
    await saveBeritaAcaraBagian(env.DB, { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20', jadwalId: j.jadwalId, catatan: '', peserta }, 'SGD', ctx);
    const dup = await saveBeritaAcaraBagian(env.DB, { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20', jadwalId: j.jadwalId, catatan: '', peserta }, 'SGD', ctx);
    expect(dup.success).toBe(false);
    expect(dup.message).toContain('sudah ada');
  });

  it('menolak jadwal yang dibatalkan', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx();
    const j = await saveJadwalPelaksanaan(env.DB, { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggal: '2026-09-20', jam: '09:00', dosen: 'dr. Andi', catatan: '', peserta }, 'SGD', ctx);
    await env.DB.prepare('UPDATE jadwal_pelaksanaan SET active=0').run();
    const res = await saveBeritaAcaraBagian(env.DB, { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20', jadwalId: j.jadwalId, catatan: '', peserta }, 'SGD', ctx);
    expect(res.success).toBe(false);
  });

  it('lengkapi mengisi dosen/jam dan menyinkron pengajuan', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx();
    const draft = await saveBeritaAcaraBagian(env.DB, { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20', catatan: '', peserta }, 'SGD', ctx);
    const filled = await lengkapiBeritaAcaraBagian(env.DB, draft.baId, { jam: '13:30', dosen: 'dr. Budi' }, 'SGD', ctx);
    expect(filled.success).toBe(true);
    const ba = await env.DB.prepare('SELECT jam, dosen, tanggal_pelaksanaan FROM berita_acara WHERE ba_id=?1').bind(draft.baId).first();
    expect(ba.jam).toBe('13:30');
    expect(ba.dosen).toBe('dr. Budi');
    const p = await env.DB.prepare('SELECT dosen, tanggal_pelaksanaan FROM pengajuan WHERE id_pengajuan=?1').bind('INHAL-1').first();
    expect(p.dosen).toBe('dr. Budi');
    expect(p.tanggal_pelaksanaan).toBe('2026-09-20T13:30');
  });
});

describe('koreksi peserta dan berkas BA oleh Bagian', () => {
  async function seedDuaKegiatan() {
    await seedPengajuan();
    await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-2','2201010002','Budi','A','SGD','ACC')").run();
    await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-2','SGD','SGD 1','','2026-09-20','')").run();
    await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-3','2201010003','Citra','A','SGD','ACC')").run();
    await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-3','SGD','SGD 2','','2026-09-21','')").run();
  }
  const pesertaDua = [
    { idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'ACC' },
    { idPengajuan: 'INHAL-2', npm: '2201010002', namaLengkap: 'Budi', blok: 'A', statusPengajuan: 'ACC' }
  ];
  async function draftBa(ctx) {
    return saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20', catatan: '', peserta
    }, 'SGD', ctx);
  }

  it('mengganti peserta BA lewat lengkapi', async () => {
    await seedDuaKegiatan();
    const ctx = await bagianCtx();
    const draft = await draftBa(ctx);

    const res = await lengkapiBeritaAcaraBagian(env.DB, draft.baId, {
      dosen: 'dr. Andi', jam: '09:00', tanggal: '2026-09-20', peserta: pesertaDua
    }, 'SGD', ctx);
    expect(res.success).toBe(true);
    expect(res.jumlahPeserta).toBe(2);

    const rows = await env.DB.prepare('SELECT id_pengajuan FROM berita_acara_peserta WHERE ba_id=?1').bind(draft.baId).all();
    expect(rows.results.map((r) => r.id_pengajuan).sort()).toEqual(['INHAL-1', 'INHAL-2']);
    const ba = await env.DB.prepare('SELECT jumlah_peserta, dosen, jam FROM berita_acara WHERE ba_id=?1').bind(draft.baId).first();
    expect(Number(ba.jumlah_peserta)).toBe(2);
    expect(ba.dosen).toBe('dr. Andi');
    expect(ba.jam).toBe('09:00');
  });

  it('menerima payload pesertaIds dan melengkapi identitas dari pengajuan', async () => {
    await seedDuaKegiatan();
    const ctx = await bagianCtx();
    const draft = await draftBa(ctx);

    const res = await lengkapiBeritaAcaraBagian(env.DB, draft.baId, { pesertaIds: ['INHAL-1', 'INHAL-2'] }, 'SGD', ctx);
    expect(res.success).toBe(true);
    const rows = await env.DB.prepare('SELECT id_pengajuan, npm, nama_lengkap, status_pengajuan FROM berita_acara_peserta WHERE ba_id=?1').bind(draft.baId).all();
    const budi = rows.results.find((r) => r.id_pengajuan === 'INHAL-2');
    expect(budi.npm).toBe('2201010002');
    expect(budi.nama_lengkap).toBe('Budi');
    expect(budi.status_pengajuan).toBe('ACC');
  });

  it('mengembalikan pengajuan peserta yang dibuang', async () => {
    await seedDuaKegiatan();
    const ctx = await bagianCtx();
    const draft = await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-09-20', catatan: '', peserta: pesertaDua
    }, 'SGD', ctx);
    await env.DB.prepare("UPDATE pengajuan SET dosen='dr. Andi', tanggal_pelaksanaan='2026-09-20T09:00'").run();

    const res = await lengkapiBeritaAcaraBagian(env.DB, draft.baId, { pesertaIds: ['INHAL-1'] }, 'SGD', ctx);
    expect(res.success).toBe(true);
    const budi = await env.DB.prepare('SELECT dosen, tanggal_pelaksanaan FROM pengajuan WHERE id_pengajuan=?1').bind('INHAL-2').first();
    expect(budi.dosen).toBe('');
    expect(budi.tanggal_pelaksanaan).toBe('');
    const rows = await env.DB.prepare('SELECT id_pengajuan FROM berita_acara_peserta WHERE ba_id=?1').bind(draft.baId).all();
    expect(rows.results.map((r) => r.id_pengajuan)).toEqual(['INHAL-1']);
  });

  it('menolak koreksi peserta di luar kegiatan BA', async () => {
    await seedDuaKegiatan();
    const ctx = await bagianCtx();
    const draft = await draftBa(ctx);

    const res = await lengkapiBeritaAcaraBagian(env.DB, draft.baId, { pesertaIds: ['INHAL-3'] }, 'SGD', ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('tidak sesuai dengan kegiatan');

    const rows = await env.DB.prepare('SELECT id_pengajuan FROM berita_acara_peserta WHERE ba_id=?1').bind(draft.baId).all();
    expect(rows.results.map((r) => r.id_pengajuan)).toEqual(['INHAL-1']);
  });

  it('menolak koreksi peserta yang belum berstatus final', async () => {
    await seedDuaKegiatan();
    const ctx = await bagianCtx();
    const draft = await draftBa(ctx);
    await env.DB.prepare("UPDATE pengajuan SET status='Menunggu' WHERE id_pengajuan='INHAL-2'").run();

    const res = await lengkapiBeritaAcaraBagian(env.DB, draft.baId, { pesertaIds: ['INHAL-1', 'INHAL-2'] }, 'SGD', ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('belum berstatus');
  });

  it('menolak koreksi tanpa peserta', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx();
    const draft = await draftBa(ctx);
    const res = await lengkapiBeritaAcaraBagian(env.DB, draft.baId, { peserta: [] }, 'SGD', ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('tidak ada peserta');
  });

  it('mengunggah berkas pada BA draft dan menggantinya', async () => {
    await seedPengajuan();
    const ctx = {
      token: await createSession(env.DB, { role: 'bagian', nama: 'Bagian', kategoris: ['SGD'] }),
      env: { GAS_DRIVE_URL: 'https://script.example/exec', GAS_DRIVE_TOKEN: 'tok' }
    };
    const ids = ['AAAABBBBCCCCDDDDEEEEFFFFGGGG11111', 'AAAABBBBCCCCDDDDEEEEFFFFGGGG22222'];
    let call = 0;
    const f = vi.fn(async () => new Response(
      JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/' + ids[Math.min(call++, 1)] + '/view', fileId: ids[0] }),
      { status: 200 }
    ));
    vi.stubGlobal('fetch', f);
    const draft = await draftBa(ctx);

    const first = await lengkapiBeritaAcaraBagian(env.DB, draft.baId, {
      file: { data: btoa('%PDF-1.4 berkas awal'), mimeType: 'application/pdf', name: 'ba-awal.pdf' }
    }, 'SGD', ctx);
    expect(first.success).toBe(true);
    expect(first.gantiFile).toBe(true);
    let ba = await env.DB.prepare('SELECT file_url, file_name FROM berita_acara WHERE ba_id=?1').bind(draft.baId).first();
    expect(ba.file_url).toContain(ids[0]);
    expect(ba.file_name).toBe('ba-awal.pdf');

    const second = await lengkapiBeritaAcaraBagian(env.DB, draft.baId, {
      file: { data: btoa('%PDF-1.4 berkas revisi'), mimeType: 'application/pdf', name: 'ba-revisi.pdf' }
    }, 'SGD', ctx);
    expect(second.success).toBe(true);
    ba = await env.DB.prepare('SELECT file_url, file_name FROM berita_acara WHERE ba_id=?1').bind(draft.baId).first();
    expect(ba.file_url).toContain(ids[1]);
    expect(ba.file_name).toBe('ba-revisi.pdf');
    // unggah pertama + pindahkan berkas lama ke trash + unggah pengganti
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('bagian dapat menghapus BA draft yang belum berberkas', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx();
    const draft = await draftBa(ctx);
    await env.DB.prepare("UPDATE pengajuan SET dosen='dr. Andi', tanggal_pelaksanaan='2026-09-20T09:00'").run();

    const del = await deleteDraftBeritaAcaraBagian(env.DB, draft.baId, 'SGD', ctx);
    expect(del.success).toBe(true);
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara').first();
    expect(Number(n.n)).toBe(0);
    const p = await env.DB.prepare('SELECT dosen, tanggal_pelaksanaan FROM pengajuan WHERE id_pengajuan=?1').bind('INHAL-1').first();
    expect(p.dosen).toBe('');
    expect(p.tanggal_pelaksanaan).toBe('');
  });

  it('menolak hapus BA berberkas dan permintaan tanpa sesi Bagian', async () => {
    await seedPengajuan();
    const ctx = await bagianCtx();
    const draft = await draftBa(ctx);
    await env.DB.prepare("UPDATE berita_acara SET file_url='https://drive.google.com/file/d/AAAABBBBCCCCDDDDEEEEFFFFGGGG12345/view' WHERE ba_id=?1").bind(draft.baId).run();

    const tolak = await deleteDraftBeritaAcaraBagian(env.DB, draft.baId, 'SGD', ctx);
    expect(tolak.success).toBe(false);
    expect(tolak.message).toContain('admin dashboard');

    await expect(deleteDraftBeritaAcaraBagian(env.DB, draft.baId, 'SGD', {})).rejects.toThrow();

    const missing = await deleteDraftBeritaAcaraBagian(env.DB, 'BA-PEL-2026-9999', 'SGD', ctx);
    expect(missing.success).toBe(false);
    expect(missing.message).toContain('tidak ditemukan');
  });
});
