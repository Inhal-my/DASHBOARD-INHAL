import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { getOrCreateBaAdmin, addBaAdminPesertaBulk } from '../src/write/baAdmin.js';
import { saveBeritaAcaraBagian } from '../src/write/beritaAcara.js';
import { getBagianAggregation } from '../src/read/dashboard.js';

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), env: {} };
}
async function bagianCtx() {
  return { token: await createSession(env.DB, { role: 'bagian', nama: 'Bagian', kategori: '', subBagian: '', kategoris: ['*'] }), env: {} };
}
async function seed(id, npm, nama) {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-10-01T08:00:00',?1,?2,?3,'A','SGD','Diterima')").bind(id, npm, nama).run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-10-01T08:00:00',?1,'SGD','SGD 1','','2026-10-20','')").bind(id).run();
}
const keg = { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-10-20' };

describe('BA Pendukung & BA Pelaksanaan berdampingan di unit', () => {
  it('keduanya tetap tampil saat BA Pelaksanaan diunggah (file_url sama/kosong)', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah');
    await seed('INHAL-2', '2201010002', 'Budi');
    const a = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, a);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], a);

    await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-10-20',
      peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'Diterima' }]
    }, 'SGD', await bagianCtx());

    const agg = await getBagianAggregation(env.DB, a);
    const unit = (agg.units || []).find((u) => u.blok === 'A');
    expect(unit.baPendukung.length).toBe(1);
    expect(unit.baPelaksanaan.length).toBe(1);
    expect(unit.pesertaDenganBa).toBe(1);
    expect(unit.jumlahPeserta).toBe(2);
  });

  it('keduanya tampil jika file_url berbeda', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah');
    const a = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, a);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], a);
    await env.DB.prepare("UPDATE berita_acara_admin SET file_url='https://x/admin.pdf' WHERE ba_id=?1").bind(baId).run();

    await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-10-20',
      peserta: [{ idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'Diterima' }]
    }, 'SGD', await bagianCtx());
    await env.DB.prepare("UPDATE berita_acara SET file_url='https://x/pel.pdf' WHERE kegiatan_key='sgd|a|sgd 1'").run();

    const agg = await getBagianAggregation(env.DB, a);
    const unit = (agg.units || []).find((u) => u.blok === 'A');
    expect(unit.baPendukung.length).toBe(1);
    expect(unit.baPelaksanaan.length).toBe(1);
  });

  it('pesertaDenganBa hanya menghitung BA Pendukung, bukan BA Pelaksanaan', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah');
    await seed('INHAL-2', '2201010002', 'Budi');
    const a = await adminCtx();
    await saveBeritaAcaraBagian(env.DB, {
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-10-20',
      peserta: [
        { idPengajuan: 'INHAL-1', npm: '2201010001', namaLengkap: 'Aisyah', blok: 'A', statusPengajuan: 'Diterima' },
        { idPengajuan: 'INHAL-2', npm: '2201010002', namaLengkap: 'Budi', blok: 'A', statusPengajuan: 'Diterima' }
      ]
    }, 'SGD', await bagianCtx());

    const agg = await getBagianAggregation(env.DB, a);
    const unit = (agg.units || []).find((u) => u.blok === 'A');
    expect(unit.baPelaksanaan.length).toBe(1);
    expect(unit.baPendukung.length).toBe(0);
    expect(unit.pesertaDenganBa).toBe(0);
    expect(unit.jumlahPeserta).toBe(2);
  });
});
