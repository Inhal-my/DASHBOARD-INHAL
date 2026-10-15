import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { getDashboardBootstrap } from '../src/read/dashboard.js';

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), env: {} };
}

async function addPeserta(idPengajuan, urutan, active) {
  await env.DB.prepare(
    "INSERT INTO berita_acara_admin_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok,bagian,status_pengajuan,urutan,active) VALUES ('2026-10-01T08:00:00','BA-PEN-2026-0001',?1,?2,?3,'A','SGD','ACC',?4,?5)"
  ).bind(idPengajuan, '22010100' + urutan, 'Peserta ' + urutan, urutan, active).run();
}

async function addBerkas(idPengajuan, active) {
  await env.DB.prepare(
    "INSERT INTO berita_acara_admin_berkas (timestamp,ba_id,id_pengajuan,npm,urutan,page_index,file_name,file_url,page_count,byte_size,active) VALUES ('2026-10-12T08:00:00','BA-PEN-2026-0001',?1,'2201010001',1,0,'p1.jpg','https://drive/1',1,100,?2)"
  ).bind(idPengajuan, active).run();
}

describe('getDashboardBootstrap baPendukungIds', () => {
  it('hanya mengembalikan pengajuan dengan peserta aktif DAN berkas aktif', async () => {
    await env.DB.prepare("INSERT INTO berita_acara_admin (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jam,jumlah_peserta,file_name,file_url,catatan,sumber,kegiatan_key,updated_at,needs_regen) VALUES ('2026-10-01T08:00:00','BA-PEN-2026-0001','SGD','A','SGD 1','2026-10-20','','3','','','','Admin','sgd|a|sgd 1','2026-10-01T08:00:00',0)").run();

    await addPeserta('INHAL-1', 1, 1);
    await addBerkas('INHAL-1', 1);

    await addPeserta('INHAL-2', 2, 0);
    await addBerkas('INHAL-2', 1);

    await addPeserta('INHAL-3', 3, 1);
    await addBerkas('INHAL-3', 0);

    await addPeserta('INHAL-4', 4, 1);

    const ctx = await adminCtx();
    const b = await getDashboardBootstrap(env.DB, ctx);
    expect(b.baPendukungIds).toContain('INHAL-1');
    expect(b.baPendukungIds).not.toContain('INHAL-2');
    expect(b.baPendukungIds).not.toContain('INHAL-3');
    expect(b.baPendukungIds).not.toContain('INHAL-4');
  });
});
