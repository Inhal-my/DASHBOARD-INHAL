import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { getStudentPortalData } from '../src/portal.js';

async function seed() {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','SGD','ACC')").run();
  await env.DB.prepare("INSERT INTO jadwal_pelaksanaan (timestamp,jadwal_id,bagian,blok,nama_kegiatan,kegiatan_key,tanggal,jam,dosen,catatan,active) VALUES ('2026-09-10T08:00:00','JDW-2026-0001','SGD','A','SGD 1','sgd|a|sgd 1','2026-09-20','09:00','dr. Andi','',1)").run();
  await env.DB.prepare("INSERT INTO jadwal_peserta (timestamp,jadwal_id,id_pengajuan,npm,nama_lengkap,blok,status_pengajuan) VALUES ('2026-09-10T08:00:00','JDW-2026-0001','INHAL-1','2201010001','Aisyah','A','ACC')").run();
}

describe('portal jadwal', () => {
  it('melampirkan jadwal pada pengajuan terkait', async () => {
    await seed();
    const data = await getStudentPortalData(env.DB, '2201010001');
    expect(data.history).toHaveLength(1);
    expect(data.history[0].jadwal).toBeTruthy();
    expect(data.history[0].jadwal.Dosen).toBe('dr. Andi');
    expect(data.history[0].jadwal.Jam).toBe('09:00');
  });

  it('null bila tidak ada jadwal', async () => {
    await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-2','2201010002','Budi','B','SGD','ACC')").run();
    const data = await getStudentPortalData(env.DB, '2201010002');
    expect(data.history[0].jadwal).toBeNull();
  });
});
