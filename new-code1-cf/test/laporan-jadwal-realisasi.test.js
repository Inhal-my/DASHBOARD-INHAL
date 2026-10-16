import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { getLaporanBootstrap } from '../src/read/laporan.js';

async function seedUnit() {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','SGD','ACC')").run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','SGD','SGD 1','','2026-10-02','')").run();
}

describe('getLaporanBootstrap jadwal', () => {
  it('membawa daftar jadwal aktif dan menautkannya ke unit', async () => {
    const token = await createSession(env.DB, { role: 'admin', nama: 'Admin' });
    await seedUnit();
    await env.DB.prepare("INSERT INTO jadwal_pelaksanaan (timestamp,jadwal_id,bagian,blok,nama_kegiatan,kegiatan_key,tanggal,jam,dosen,catatan,active) VALUES ('2026-10-01T08:00:00','JDW-2026-0001','SGD','A','SGD 1','sgd|a|sgd 1','2026-10-02','09:00','dr. Andi','',1)").run();
    await env.DB.prepare("INSERT INTO jadwal_peserta (timestamp,jadwal_id,id_pengajuan,npm,nama_lengkap,blok,status_pengajuan) VALUES ('2026-10-01T08:00:00','JDW-2026-0001','INHAL-1','2201010001','Aisyah','A','ACC')").run();
    await env.DB.prepare("INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jam,dosen,sumber,kegiatan_key,jadwal_id) VALUES ('2026-10-02T09:00:00','BA-PEL-2026-0001','SGD','A','SGD 1','2026-10-02','09:00','dr. Andi','Bagian','sgd|a|sgd 1','JDW-2026-0001')").run();

    const boot = await getLaporanBootstrap(env.DB, { token });
    expect(Array.isArray(boot.jadwal)).toBe(true);
    const j = boot.jadwal.find((x) => x.jadwalId === 'JDW-2026-0001');
    expect(j).toBeTruthy();
    expect(j.baId).toBe('BA-PEL-2026-0001');
    expect(j.peserta).toHaveLength(1);
    expect(j.peserta[0].namaLengkap).toBe('Aisyah');
    const unit = boot.kegiatan.find((u) => u.key === 'sgd|a|sgd 1');
    expect(unit.jadwal).toHaveLength(1);
    expect(unit.jadwal[0].jadwalId).toBe('JDW-2026-0001');
    expect(unit.jadwal[0].baId).toBe('BA-PEL-2026-0001');
  });

  it('mengecualikan jadwal tidak aktif', async () => {
    const token = await createSession(env.DB, { role: 'admin', nama: 'Admin' });
    await env.DB.prepare("INSERT INTO jadwal_pelaksanaan (timestamp,jadwal_id,bagian,blok,nama_kegiatan,kegiatan_key,tanggal,jam,dosen,catatan,active) VALUES ('2026-10-01T08:00:00','JDW-2026-0009','SGD','A','SGD 1','sgd|a|sgd 1','2026-10-02','09:00','dr. Andi','',0)").run();
    const boot = await getLaporanBootstrap(env.DB, { token });
    expect(boot.jadwal.find((x) => x.jadwalId === 'JDW-2026-0009')).toBeFalsy();
  });
});
