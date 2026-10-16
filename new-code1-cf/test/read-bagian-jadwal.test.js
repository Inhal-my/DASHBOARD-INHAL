import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { getBagianBootstrap, getBeritaAcaraList } from '../src/read/bagian.js';

async function bagianCtx(kategoris = ['Ujian']) {
  return { token: await createSession(env.DB, { role: 'bagian', nama: 'Bagian Umum', kategori: 'Ujian', subBagian: '', kategoris }) };
}
async function seed() {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','Ujian','ACC')").run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','Ujian','UAS','','2026-09-20','')").run();
  await env.DB.prepare("INSERT INTO jadwal_pelaksanaan (timestamp,jadwal_id,bagian,blok,nama_kegiatan,kegiatan_key,tanggal,jam,dosen,catatan,active) VALUES ('2026-09-10T08:00:00','JDW-2026-0001','Ujian','A','UAS','ujian|a|uas','2026-09-20','09:00','dr. Andi','',1)").run();
  await env.DB.prepare("INSERT INTO jadwal_peserta (timestamp,jadwal_id,id_pengajuan,npm,nama_lengkap,blok,status_pengajuan) VALUES ('2026-09-10T08:00:00','JDW-2026-0001','INHAL-1','2201010001','Aisyah','A','ACC')").run();
}

describe('bagian bootstrap jadwal', () => {
  it('menyertakan jadwalList di bootstrap', async () => {
    await seed();
    const boot = await getBagianBootstrap(env.DB, 'Ujian', '', await bagianCtx());
    expect(boot.ok).toBe(true);
    expect(Array.isArray(boot.jadwalList)).toBe(true);
    expect(boot.jadwalList).toHaveLength(1);
    expect(boot.jadwalList[0].JadwalID).toBe('JDW-2026-0001');
  });

  it('menandai BA selesai bila dosen+tanggal+jam terisi', async () => {
    await seed();
    await env.DB.prepare("INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jam,dosen,jumlah_peserta,sumber,kegiatan_key,jadwal_id) VALUES ('2026-09-20T09:00:00','BA-PEL-2026-0001','Ujian','A','UAS','2026-09-20','09:00','dr. Andi','1','Bagian','ujian|a|uas','JDW-2026-0001')").run();
    const list = await getBeritaAcaraList(env.DB, 'Ujian', 'Ujian', await bagianCtx());
    expect(list).toHaveLength(1);
    expect(list[0].selesai).toBe(true);
    expect(list[0]['Jadwal ID']).toBe('JDW-2026-0001');

    await env.DB.prepare("UPDATE berita_acara SET jam=''").run();
    const list2 = await getBeritaAcaraList(env.DB, 'Ujian', 'Ujian', await bagianCtx());
    expect(list2[0].selesai).toBe(false);
  });
});
