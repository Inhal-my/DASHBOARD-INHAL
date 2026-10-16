import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { saveJadwalPelaksanaan } from '../src/write/jadwal.js';
import { saveBeritaAcaraBagian, lengkapiBeritaAcaraBagian } from '../src/write/beritaAcara.js';

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
