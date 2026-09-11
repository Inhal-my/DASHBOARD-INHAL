import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { getDashboardBootstrap, getPengajuanList, getBaUploadOptions, getLabOptions, uploadSuratKeterangan } from '../src/read/dashboard.js';

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }) };
}
async function seed() {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status,link_final) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','Ujian','Diterima','')").run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','Ujian','UAS','','2026-09-20','')").run();
  await env.DB.prepare("INSERT INTO master_biaya (kegiatan,biaya) VALUES ('Ujian','Rp. 300.000')").run();
}

describe('dashboard read', () => {
  it('builds bootstrap with stats and biaya', async () => {
    await seed();
    const ctx = await adminCtx();
    const boot = await getDashboardBootstrap(env.DB, ctx);
    expect(boot.pengajuan).toHaveLength(1);
    expect(boot.pengajuan[0]['ID Pengajuan']).toBe('INHAL-1');
    expect(boot.pengajuan[0].Biaya).toBe(300000);
    expect(boot.pengajuan[0]['Biaya Rupiah']).toBe('Rp 300.000');
    expect(boot.stats.total).toBe(1);
    expect(boot.detailMap['INHAL-1']).toHaveLength(1);
  });
  it('filters pengajuan list by status', async () => {
    await seed();
    const ctx = await adminCtx();
    const rows = await getPengajuanList(env.DB, { status: 'Diterima' }, ctx);
    expect(rows).toHaveLength(1);
    const none = await getPengajuanList(env.DB, { status: 'ACC' }, ctx);
    expect(none).toHaveLength(0);
  });
  it('requires admin for lab options', async () => {
    await expect(getLabOptions(env.DB, {})).rejects.toThrow();
    const labs = await getLabOptions(env.DB, await adminCtx());
    expect(Array.isArray(labs)).toBe(true);
  });
  it('builds ba upload options', async () => {
    await seed();
    const ctx = await adminCtx();
    const opts = await getBaUploadOptions(env.DB, ctx);
    expect(opts.blok).toContain('A');
    expect(opts.details[0].jenis).toBe('Ujian');
  });
  it('allows only admins to upload a surat keterangan', async () => {
    await seed();
    const file = { data: 'aGVsbG8=', mimeType: 'application/pdf', name: 'surat.pdf' };
    await expect(uploadSuratKeterangan(env.DB, 'INHAL-1', file, {})).rejects.toThrow();
    const res = await uploadSuratKeterangan(env.DB, 'INHAL-1', file, await adminCtx());
    expect(res.success).toBe(true);
    const p = await env.DB.prepare('SELECT link_surat_keterangan FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(p.link_surat_keterangan).toMatch(/^\/api\/files\/UPL-/);
  });
});
