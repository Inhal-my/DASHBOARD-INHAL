import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { getDashboardBootstrap, getPengajuanList, getBaUploadOptions, getLabOptions, uploadSuratKeterangan, getBagianAggregation } from '../src/read/dashboard.js';

afterEach(() => { vi.unstubAllGlobals(); });

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), env: { GAS_DRIVE_URL: 'https://script.example/exec', GAS_DRIVE_TOKEN: 'tok' } };
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
  it('mengembalikan progres dan realisasi per kegiatan', async () => {
    const token = await createSession(env.DB, { role: 'admin', nama: 'Admin' });
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status,link_final) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','SGD','ACC','http://final')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','SGD','SGD 1','','2026-09-20','')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jam,dosen,kegiatan_key) VALUES ('2026-09-20T08:00:00','BA-2026-0001','SGD','A','SGD 1','2026-09-20','09:00','dr. Andi','sgd|a|sgd 1')"
    ).run();
    const res = await getBagianAggregation(env.DB, { token });
    const unit = res.units.find((u) => u.key === 'sgd|a|sgd 1');
    expect(unit).toBeTruthy();
    expect(unit.progress.selesai).toBe('all');
    expect(unit.pelaksanaan[0].jam).toBe('09:00');
    expect(unit.dosenList).toEqual(['dr. Andi']);
  });

  it('allows only admins to upload a surat keterangan', async () => {
    await seed();
    const file = { data: 'aGVsbG8=', mimeType: 'application/pdf', name: 'surat.pdf' };
    await expect(uploadSuratKeterangan(env.DB, 'INHAL-1', file, {})).rejects.toThrow();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/SURAT1234567890ABCDEF/view' }),
      { status: 200 }
    )));
    const res = await uploadSuratKeterangan(env.DB, 'INHAL-1', file, await adminCtx());
    expect(res.success).toBe(true);
    const p = await env.DB.prepare('SELECT link_surat_keterangan FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(p.link_surat_keterangan).toContain('SURAT1234567890ABCDEF');
  });
});
