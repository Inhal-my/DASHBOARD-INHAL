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

describe('getDashboardBootstrap shared berkas', () => {
  async function seedBa(fileUrl) {
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jam,jumlah_peserta,file_name,file_url,catatan,sumber,kegiatan_key,updated_at,needs_regen) " +
      "VALUES ('2026-10-01T08:00:00','BA-PEN-2026-0001','SGD','A','SGD 1','2026-10-20','','3',?1,?1,'','Admin','sgd|a|sgd 1','2026-10-01T08:00:00',0)"
    ).bind(fileUrl).run();
  }
  async function addShared(active) {
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin_berkas (timestamp,ba_id,id_pengajuan,npm,urutan,page_index,file_name,file_url,page_count,byte_size,active,scope) " +
      "VALUES ('2026-10-12T08:00:00','BA-PEN-2026-0001','','',0,0,'s.pdf','https://drive/shared',1,100,?1,'shared')"
    ).bind(active).run();
  }

  it('peserta aktif dengan shared aktif masuk walau tanpa berkas per peserta', async () => {
    await seedBa('https://drive/ba-pdf');
    await addPeserta('INHAL-1', 1, 1);
    await addPeserta('INHAL-2', 2, 1);
    await addBerkas('INHAL-1', 1);
    await addShared(1);

    const b = await getDashboardBootstrap(env.DB, await adminCtx());
    expect(b.baPendukungIds).toContain('INHAL-1');
    expect(b.baPendukungIds).toContain('INHAL-2');
    expect(b.baPendukungByPengajuan['INHAL-2'].fileUrl).toBe('https://drive/ba-pdf');
  });

  it('shared tanpa file_url tidak mengisi baPendukungByPengajuan', async () => {
    await seedBa('');
    await addPeserta('INHAL-1', 1, 1);
    await addPeserta('INHAL-2', 2, 1);
    await addBerkas('INHAL-1', 1);
    await addShared(1);

    const b = await getDashboardBootstrap(env.DB, await adminCtx());
    expect(b.baPendukungIds).toContain('INHAL-2');
    expect(b.baPendukungByPengajuan['INHAL-2']).toBeUndefined();
    expect(b.baPendukungByPengajuan['INHAL-1']).toBeUndefined();
  });

  it('tanpa shared dan tanpa berkas tetap tidak masuk', async () => {
    await seedBa('https://drive/ba-pdf');
    await addPeserta('INHAL-1', 1, 1);
    await addShared(0);

    const b = await getDashboardBootstrap(env.DB, await adminCtx());
    expect(b.baPendukungIds).not.toContain('INHAL-1');
  });
});

describe('guard dokumen dasar BA Pendukung', () => {
  it('modal menyediakan aksi dokumen dasar', async () => {
    const res = await env.ASSETS.fetch(new Request('https://example.com/dashboard.html'));
    const html = await res.text();
    expect(html).toContain('baAdminSetBaseFile');
    expect(html).toContain('Dokumen dasar');
    expect(html).toContain('baAdminSetSharedFile');
    expect(html).toContain('PDF BA untuk semua peserta');
    expect(html).not.toContain('berstatus ACC/Diterima');
  });
});
