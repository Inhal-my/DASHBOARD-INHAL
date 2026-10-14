import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { getDashboardBootstrap } from '../src/read/dashboard.js';

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), env: {} };
}

describe('getDashboardBootstrap baPendukungIds', () => {
  it('mengembalikan id pengajuan yang punya BA Pendukung aktif', async () => {
    await env.DB.prepare("INSERT INTO berita_acara_admin (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jam,jumlah_peserta,file_name,file_url,catatan,sumber,kegiatan_key,updated_at,needs_regen) VALUES ('2026-10-01T08:00:00','BA-PEN-2026-0001','SGD','A','SGD 1','2026-10-20','','1','','','','Admin','sgd|a|sgd 1','2026-10-01T08:00:00',0)").run();
    await env.DB.prepare("INSERT INTO berita_acara_admin_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok,bagian,status_pengajuan,urutan,active) VALUES ('2026-10-01T08:00:00','BA-PEN-2026-0001','INHAL-1','2201010001','Aisyah','A','SGD','ACC',1,1)").run();
    await env.DB.prepare("INSERT INTO berita_acara_admin_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok,bagian,status_pengajuan,urutan,active) VALUES ('2026-10-01T08:00:00','BA-PEN-2026-0001','INHAL-2','2201010002','Budi','A','SGD','ACC',2,0)").run();

    const ctx = await adminCtx();
    const b = await getDashboardBootstrap(env.DB, ctx);
    expect(b.baPendukungIds).toContain('INHAL-1');
    expect(b.baPendukungIds).not.toContain('INHAL-2');
  });
});
