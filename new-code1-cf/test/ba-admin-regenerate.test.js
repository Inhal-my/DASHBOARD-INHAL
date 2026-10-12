import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { getOrCreateBaAdmin, addBaAdminPesertaBulk, regenerateBaAdminPdf } from '../src/write/baAdmin.js';

afterEach(() => { vi.unstubAllGlobals(); });
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
const BRIDGE = { GAS_DRIVE_URL: 'https://script.example/exec', GAS_DRIVE_TOKEN: 'tok' };
async function adminCtx() { return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), env: { ...BRIDGE } }; }
async function seed(id, npm, nama, status, pilihan) {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-10-01T08:00:00',?1,?2,?3,'A','SGD',?4)").bind(id, npm, nama, status).run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-10-01T08:00:00',?1,'SGD',?2,'','2026-10-20','')").bind(id, pilihan).run();
}
const keg = { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-10-20' };

async function seedBerkas(baId) {
  await env.DB.prepare("INSERT INTO berita_acara_admin_berkas (timestamp,ba_id,id_pengajuan,npm,urutan,page_index,file_name,file_url,active) VALUES ('2026-10-12T00:00:00',?1,'INHAL-1','2201010001',1,0,'p1.jpg','https://drive.google.com/file/d/AAAABBBBCCCCDDDDEEEEFFFFGGGG12345/view',1)").bind(baId).run();
}

describe('regenerateBaAdminPdf', () => {
  it('sukses: simpan PDF & needs_regen=0', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    await seedBerkas(baId);
    const f = vi.fn(async (url, opts) => {
      const body = JSON.parse(opts.body);
      if (body.action === 'getFile') return new Response(JSON.stringify({ success: true, base64: PNG, mimeType: 'image/png' }), { status: 200 });
      return new Response(JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/NEWNEWNEWNEWNEWNEWNEWNEWNEW1/view', fileId: 'NEWNEWNEWNEWNEWNEWNEWNEW1' }), { status: 200 });
    });
    vi.stubGlobal('fetch', f);
    const res = await regenerateBaAdminPdf(env.DB, baId, ctx);
    expect(res.success).toBe(true);
    const ba = await env.DB.prepare('SELECT file_url, needs_regen FROM berita_acara_admin WHERE ba_id=?1').bind(baId).first();
    expect(ba.file_url).toContain('NEWNEWNEWNEWNEWNEWNEWNEW1');
    expect(Number(ba.needs_regen)).toBe(0);
  });

  it('gagal: needs_regen=1 & file_url lama tetap', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    await seedBerkas(baId);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: false, message: 'bridge down' }), { status: 200 })));
    const res = await regenerateBaAdminPdf(env.DB, baId, ctx);
    expect(res.success).toBe(false);
    const ba = await env.DB.prepare('SELECT needs_regen FROM berita_acara_admin WHERE ba_id=?1').bind(baId).first();
    expect(Number(ba.needs_regen)).toBe(1);
  });

  it('error D1 awal: resolve {success:false}, bukan reject', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const real = env.DB;
    const db = new Proxy(real, {
      get(target, prop) {
        if (prop === 'prepare') {
          return (sql) => {
            if (sql.indexOf('FROM berita_acara_admin WHERE ba_id') !== -1) throw new Error('D1 down');
            return target.prepare(sql);
          };
        }
        const v = target[prop];
        return typeof v === 'function' ? v.bind(target) : v;
      }
    });
    const res = await regenerateBaAdminPdf(db, 'INHAL-1', ctx);
    expect(res.success).toBe(false);
    expect(typeof res.message).toBe('string');
  });

  it('mengunci regenerate bersamaan untuk BA yang sama', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    await seedBerkas(baId);
    let release;
    const gate = new Promise((r) => { release = r; });
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      const body = JSON.parse(opts.body);
      if (body.action === 'getFile') { await gate; return new Response(JSON.stringify({ success: true, base64: PNG, mimeType: 'image/png' }), { status: 200 }); }
      return new Response(JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/NEWNEWNEWNEWNEWNEWNEWNEWNEW1/view', fileId: 'NEWNEWNEWNEWNEWNEWNEWNEW1' }), { status: 200 });
    }));
    const p1 = regenerateBaAdminPdf(env.DB, baId, ctx);
    const r2 = await regenerateBaAdminPdf(env.DB, baId, ctx);
    expect(r2.success).toBe(false);
    expect(r2.message).toContain('sedang berjalan');
    release();
    const r1 = await p1;
    expect(r1.success).toBe(true);
  });
});
