import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { computeJadwalList } from '../src/read/jadwal.js';

async function seedJadwal(id = 'JDW-2026-0001', bagian = 'SGD', blok = 'A', nama = 'SGD 1') {
  await env.DB.prepare(
    "INSERT INTO jadwal_pelaksanaan (timestamp,jadwal_id,bagian,blok,nama_kegiatan,kegiatan_key,tanggal,jam,dosen,catatan,active) VALUES ('2026-10-01T08:00:00',?1,?2,?3,?4,?5,'2026-10-02','09:00','dr. Andi','',1)"
  ).bind(id, bagian, blok, nama, [bagian, blok, nama].join('|').toLowerCase()).run();
  await env.DB.prepare(
    "INSERT INTO jadwal_peserta (timestamp,jadwal_id,id_pengajuan,npm,nama_lengkap,blok,status_pengajuan) VALUES ('2026-10-01T08:00:00',?1,'INHAL-1','2201010001','Aisyah','A','ACC')"
  ).bind(id).run();
}

describe('computeJadwalList', () => {
  it('mengembalikan jadwal aktif dengan peserta', async () => {
    await seedJadwal();
    const list = await computeJadwalList(env.DB, '', '');
    expect(list).toHaveLength(1);
    expect(list[0].JadwalID).toBe('JDW-2026-0001');
    expect(list[0].Dosen).toBe('dr. Andi');
    expect(list[0].punyaBa).toBe(false);
    expect(list[0].peserta).toHaveLength(1);
    expect(list[0].peserta[0].namaLengkap).toBe('Aisyah');
  });

  it('menandai punyaBa bila ada BA merujuk jadwal', async () => {
    await seedJadwal();
    await env.DB.prepare("INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,sumber,kegiatan_key,jadwal_id) VALUES ('2026-10-02T09:00:00','BA-PEL-2026-0001','SGD','A','SGD 1','2026-10-02','Bagian','sgd|a|sgd 1','JDW-2026-0001')").run();
    const list = await computeJadwalList(env.DB, '', '');
    expect(list[0].punyaBa).toBe(true);
    expect(list[0].baId).toBe('BA-PEL-2026-0001');
  });

  it('menyembunyikan jadwal yang dibatalkan', async () => {
    await seedJadwal();
    await env.DB.prepare("UPDATE jadwal_pelaksanaan SET active=0").run();
    const list = await computeJadwalList(env.DB, '', '');
    expect(list).toHaveLength(0);
  });

  it('menyaring berdasarkan bagian', async () => {
    await seedJadwal('JDW-2026-0001', 'SGD', 'A', 'SGD 1');
    await seedJadwal('JDW-2026-0002', 'KKD', 'B', 'KKD 1');
    const list = await computeJadwalList(env.DB, 'KKD', 'KKD');
    expect(list).toHaveLength(1);
    expect(list[0].JadwalID).toBe('JDW-2026-0002');
  });
});
