import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { getPengajuanWithDetails } from '../src/read/dashboard.js';

afterEach(() => { vi.unstubAllGlobals(); });

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), env: {} };
}

async function seedPengajuan(id, npm, nama) {
  await env.DB.prepare(
    "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00',?1,?2,?3,'A','Ujian','ACC')"
  ).bind(id, npm, nama).run();
  await env.DB.prepare(
    "INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00',?1,'Ujian','UAS','','2026-09-20','')"
  ).bind(id).run();
}

describe('getPengajuanWithDetails — BA & catatan', () => {
  it('mengembalikan BA Pelaksanaan beserta catatan dan jumlah peserta', async () => {
    await seedPengajuan('INHAL-1', '2201010001', 'Aisyah');
    await seedPengajuan('INHAL-2', '2201010002', 'Budi');
    await env.DB.prepare(
      "INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jam,dosen,catatan,jumlah_peserta,file_url,sumber) " +
      "VALUES ('2026-09-21T08:00:00','BA-2026-0001','Ujian','A','UAS','2026-09-20','09:00','dr. Andi','Ruang lab 2, dua peserta hadir.','2','https://drive/ba','Bagian')"
    ).run();
    for (const [id, npm, nama] of [['INHAL-1', '2201010001', 'Aisyah'], ['INHAL-2', '2201010002', 'Budi']]) {
      await env.DB.prepare(
        "INSERT INTO berita_acara_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok,bagian,status_pengajuan) " +
        "VALUES ('2026-09-21T08:00:00','BA-2026-0001',?1,?2,?3,'A','Ujian','ACC')"
      ).bind(id, npm, nama).run();
    }

    const detail = await getPengajuanWithDetails(env.DB, 'INHAL-1', await adminCtx());
    expect(detail.ba).toHaveLength(1);
    expect(detail.ba[0]).toMatchObject({
      baId: 'BA-2026-0001',
      sumber: 'Bagian',
      kegiatan: 'UAS',
      dosen: 'dr. Andi',
      jam: '09:00',
      catatan: 'Ruang lab 2, dua peserta hadir.',
      jumlahPeserta: 2,
      fileUrl: 'https://drive/ba'
    });
    expect(detail.BaCatatanCount).toBe(1);
  });

  it('menyertakan BA Pendukung aktif dan melewati baris peserta nonaktif', async () => {
    await seedPengajuan('INHAL-1', '2201010001', 'Aisyah');
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,catatan,jumlah_peserta,file_name,file_url,sumber,kegiatan_key) " +
      "VALUES ('2026-09-22T08:00:00','BA-PEN-2026-0001','Ujian','A','UAS','2026-09-20','Catatan admin untuk bagian.','1','ba.pdf','https://drive/pen','Admin','ujian|a|uas')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok,bagian,status_pengajuan,urutan,active) " +
      "VALUES ('2026-09-22T08:00:00','BA-PEN-2026-0001','INHAL-1','2201010001','Aisyah','A','Ujian','ACC',1,1)"
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok,bagian,status_pengajuan,urutan,active) " +
      "VALUES ('2026-09-22T08:00:00','BA-PEN-2026-0001','INHAL-9','2201010009','Lama','A','Ujian','ACC',2,0)"
    ).run();

    const detail = await getPengajuanWithDetails(env.DB, 'INHAL-1', await adminCtx());
    expect(detail.ba).toHaveLength(1);
    expect(detail.ba[0].sumber).toBe('Admin');
    expect(detail.ba[0].catatan).toBe('Catatan admin untuk bagian.');
    expect(detail.ba[0].fileUrl).toBe('https://drive/pen');
    // Peserta nonaktif tidak dihitung sebagai anggota BA.
    expect(detail.ba[0].jumlahPeserta).toBe(1);
  });

  it('mengembalikan daftar BA kosong bila pengajuan belum masuk BA', async () => {
    await seedPengajuan('INHAL-1', '2201010001', 'Aisyah');
    const detail = await getPengajuanWithDetails(env.DB, 'INHAL-1', await adminCtx());
    expect(detail.ba).toEqual([]);
    expect(detail.BaCatatanCount).toBe(0);
  });
});