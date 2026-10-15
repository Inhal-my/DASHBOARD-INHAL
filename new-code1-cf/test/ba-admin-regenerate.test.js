import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { PDFDocument } from 'pdf-lib';
import { createSession } from '../src/session.js';
import { getOrCreateBaAdmin, addBaAdminPesertaBulk, regenerateBaAdminPdf, getBaAdminForPengajuan, setBaAdminBaseFile } from '../src/write/baAdmin.js';

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

async function pdfB64(pageCount) {
  const d = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) d.addPage([200, 300]);
  const bytes = await d.save();
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
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
    await env.DB.prepare("UPDATE berita_acara_admin SET file_url='https://drive.google.com/file/d/OLDFILE0000000000000000/view' WHERE ba_id=?1").bind(baId).run();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: false, message: 'bridge down' }), { status: 200 })));
    const res = await regenerateBaAdminPdf(env.DB, baId, ctx);
    expect(res.success).toBe(false);
    const ba = await env.DB.prepare('SELECT file_url, needs_regen FROM berita_acara_admin WHERE ba_id=?1').bind(baId).first();
    expect(ba.file_url).toContain('OLDFILE0000000000000000');
    expect(Number(ba.needs_regen)).toBe(1);
  });

  it('tanpa halaman aktif: kosongkan file_url & needs_regen=0', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await env.DB.prepare("UPDATE berita_acara_admin SET file_url='https://drive.google.com/file/d/STALEFILE00000000000000/view', file_name='old.pdf' WHERE ba_id=?1").bind(baId).run();
    const res = await regenerateBaAdminPdf(env.DB, baId, ctx);
    expect(res.success).toBe(true);
    expect(res.pages).toBe(0);
    const ba = await env.DB.prepare('SELECT file_url, file_name, needs_regen FROM berita_acara_admin WHERE ba_id=?1').bind(baId).first();
    expect(ba.file_url).toBe('');
    expect(ba.file_name).toBe('');
    expect(Number(ba.needs_regen)).toBe(0);
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
    const p2 = regenerateBaAdminPdf(env.DB, baId, ctx);
    release();
    const results = await Promise.all([p1, p2]);
    const failed = results.filter((r) => !r.success);
    const ok = results.filter((r) => r.success);
    expect(failed.length).toBe(1);
    expect(failed[0].message).toContain('sedang berjalan');
    expect(ok.length).toBe(1);
  });

  it('menyalin halaman PDF peserta + sampul/pembatas ke PDF gabungan', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    await env.DB.prepare("INSERT INTO berita_acara_admin_berkas (timestamp,ba_id,id_pengajuan,npm,urutan,page_index,file_name,file_url,page_count,active) VALUES ('2026-10-12T00:00:00',?1,'INHAL-1','2201010001',1,0,'scan.pdf','https://drive.google.com/file/d/AAAABBBBCCCCDDDDEEEEFFFFGGGG12345/view',2,1)").bind(baId).run();
    const scan = await pdfB64(2);
    let saved = '';
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      const body = JSON.parse(opts.body);
      if (body.action === 'getFile') return new Response(JSON.stringify({ success: true, base64: scan, mimeType: 'application/pdf' }), { status: 200 });
      saved = body.base64;
      return new Response(JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/NEWNEWNEWNEWNEWNEWNEWNEWNEW1/view', fileId: 'NEWNEWNEWNEWNEWNEWNEWNEW1' }), { status: 200 });
    }));
    const res = await regenerateBaAdminPdf(env.DB, baId, ctx);
    expect(res.success).toBe(true);
    const bytes = Uint8Array.from(atob(saved), (c) => c.charCodeAt(0));
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(4);
  });

  it('melaporkan jumlah halaman = total page_count', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    await env.DB.prepare("INSERT INTO berita_acara_admin_berkas (timestamp,ba_id,id_pengajuan,npm,urutan,page_index,file_name,file_url,page_count,active) VALUES ('2026-10-12T00:00:00',?1,'INHAL-1','2201010001',1,0,'scan.pdf','https://drive/x',4,1)").bind(baId).run();
    const got = await getBaAdminForPengajuan(env.DB, 'INHAL-1', ctx);
    expect(got.data.peserta[0].pages).toBe(4);
    expect(got.data.peserta[0].files[0].pageCount).toBe(4);
  });

  it('menggabungkan dokumen dasar + berkas peserta', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    await seedBerkas(baId);
    await env.DB.prepare("UPDATE berita_acara_admin SET base_file_url='https://drive.google.com/file/d/BASEFILE0000000000000BASE/view' WHERE ba_id=?1").bind(baId).run();
    const base = await pdfB64(2);
    const member = await pdfB64(1);
    let saved = '';
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      const body = JSON.parse(opts.body);
      if (body.action === 'getFile') {
        const isBase = String(body.fileId || '').indexOf('BASE') === 0;
        return new Response(JSON.stringify({ success: true, base64: isBase ? base : member, mimeType: 'application/pdf' }), { status: 200 });
      }
      saved = body.base64;
      return new Response(JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/NEWNEWNEWNEWNEWNEWNEWNEWNEW1/view', fileId: 'NEWNEWNEWNEWNEWNEWNEWNEW1' }), { status: 200 });
    }));
    const res = await regenerateBaAdminPdf(env.DB, baId, ctx);
    expect(res.success).toBe(true);
    const bytes = Uint8Array.from(atob(saved), (c) => c.charCodeAt(0));
    const doc = await PDFDocument.load(bytes);
    // sampul(1) + dasar(2) + pembatas(1) + peserta(1) = 5
    expect(doc.getPageCount()).toBe(5);
  });

  it('setBaAdminBaseFile menyimpan dokumen dasar & regenerate', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    const base = await pdfB64(1);
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      const body = JSON.parse(opts.body);
      if (body.action === 'getFile') return new Response(JSON.stringify({ success: true, base64: base, mimeType: 'application/pdf' }), { status: 200 });
      return new Response(JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/BASEFILE0000000000000BASE/view', fileId: 'BASEFILE0000000000000BASE' }), { status: 200 });
    }));
    const res = await setBaAdminBaseFile(env.DB, baId, { data: base, mimeType: 'application/pdf', name: 'dasar.pdf' }, ctx);
    expect(res.success).toBe(true);
    const row = await env.DB.prepare('SELECT base_file_url FROM berita_acara_admin WHERE ba_id=?1').bind(baId).first();
    expect(row.base_file_url).toContain('BASEFILE');
  });
});
