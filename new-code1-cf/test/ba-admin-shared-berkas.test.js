import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { PDFDocument } from 'pdf-lib';
import { createSession } from '../src/session.js';
import {
  getOrCreateBaAdmin, addBaAdminPesertaBulk, setBaAdminPesertaBerkas,
  setBaAdminSharedBerkas, removeBaAdminSharedBerkas, getBaAdminForPengajuan,
  BA_ADMIN_MAX_PAGES
} from '../src/write/baAdmin.js';

afterEach(() => { vi.unstubAllGlobals(); });

const BRIDGE = { GAS_DRIVE_URL: 'https://script.example/exec', GAS_DRIVE_TOKEN: 'tok' };
async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), env: { ...BRIDGE } };
}
async function seed(id, npm, nama, status, pilihan) {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-10-01T08:00:00',?1,?2,?3,'A','SGD',?4)").bind(id, npm, nama, status).run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-10-01T08:00:00',?1,'SGD',?2,'','2026-10-20','')").bind(id, pilihan).run();
}
const keg = { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-10-20' };
const IMG = { data: btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xd9)), mimeType: 'image/jpeg' };

async function pdfB64(pageCount) {
  const d = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) d.addPage([200, 300]);
  const bytes = await d.save();
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function stubDrive() {
  let n = 0;
  const calls = [];
  const f = vi.fn(async (url, opts) => {
    const body = JSON.parse(opts.body);
    calls.push(body);
    if (body.action === 'getFile') {
      return new Response(JSON.stringify({ success: true, base64: body.__base64 || IMG.data, mimeType: body.__mime || 'image/jpeg' }), { status: 200 });
    }
    n += 1;
    return new Response(JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/NEWID00000000000000000' + n + '/view', fileId: 'NEWID00000000000000000' + n }), { status: 200 });
  });
  vi.stubGlobal('fetch', f);
  return calls;
}

describe('setBaAdminSharedBerkas', () => {
  it('menolak BA tanpa peserta aktif', async () => {
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    stubDrive();
    const res = await setBaAdminSharedBerkas(env.DB, baId, { data: await pdfB64(1), mimeType: 'application/pdf', name: 's.pdf' }, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('peserta');
  });

  it('menolak BA yang tidak ada', async () => {
    const ctx = await adminCtx();
    const res = await setBaAdminSharedBerkas(env.DB, 'BA-X', { data: await pdfB64(1), mimeType: 'application/pdf' }, ctx);
    expect(res.success).toBe(false);
  });

  it('menolak format berkas tidak didukung', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    stubDrive();
    const res = await setBaAdminSharedBerkas(env.DB, baId, { data: btoa('hello world plain text'), mimeType: 'text/plain', name: 'a.txt' }, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('Format');
  });

  it('menyimpan satu baris scope shared dengan id_pengajuan kosong', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    await seed('INHAL-2', '2201010002', 'Budi', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1', 'INHAL-2'], ctx);
    stubDrive();
    const res = await setBaAdminSharedBerkas(env.DB, baId, { data: await pdfB64(3), mimeType: 'application/pdf', name: 'shared.pdf' }, ctx);
    expect(res.success).toBe(true);
    expect(res.pages).toBe(3);

    const rows = (await env.DB.prepare("SELECT * FROM berita_acara_admin_berkas WHERE ba_id=?1 AND scope='shared'").bind(baId).all()).results || [];
    expect(rows.length).toBe(1);
    expect(String(rows[0].id_pengajuan)).toBe('');
    expect(String(rows[0].npm)).toBe('');
    expect(Number(rows[0].page_count)).toBe(3);
    expect(Number(rows[0].active)).toBe(1);
  });

  it('upload ulang menonaktifkan baris shared lama + superseded_at', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    stubDrive();
    await setBaAdminSharedBerkas(env.DB, baId, { data: await pdfB64(1), mimeType: 'application/pdf' }, ctx);
    await setBaAdminSharedBerkas(env.DB, baId, { data: await pdfB64(2), mimeType: 'application/pdf' }, ctx);

    const all = (await env.DB.prepare("SELECT * FROM berita_acara_admin_berkas WHERE ba_id=?1 AND scope='shared' ORDER BY id").bind(baId).all()).results || [];
    expect(all.length).toBe(2);
    expect(Number(all[0].active)).toBe(0);
    expect(String(all[0].superseded_at || '')).not.toBe('');
    expect(Number(all[1].active)).toBe(1);
    expect(Number(all[1].page_count)).toBe(2);

    const got = await getBaAdminForPengajuan(env.DB, 'INHAL-1', ctx);
    expect(got.data.ba.shared.pageCount).toBe(2);
    expect(got.data.ba.shared.fileUrl).toContain('NEWID');
  });

  it('menolak bila total halaman peserta + shared melebihi batas', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin_berkas (timestamp,ba_id,id_pengajuan,npm,urutan,page_index,file_name,file_url,page_count,byte_size,active,scope) " +
      "VALUES ('2026-10-12T00:00:00',?1,'INHAL-1','2201010001',1,0,'big.pdf','https://drive/big'," + (BA_ADMIN_MAX_PAGES - 1) + ",10,1,'peserta')"
    ).bind(baId).run();
    stubDrive();
    const res = await setBaAdminSharedBerkas(env.DB, baId, { data: await pdfB64(2), mimeType: 'application/pdf' }, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('halaman');
  });

  it('tidak mengganggu berkas peserta saat menyimpan shared', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    stubDrive();
    await setBaAdminPesertaBerkas(env.DB, baId, 'INHAL-1', [IMG], ctx);
    await setBaAdminSharedBerkas(env.DB, baId, { data: await pdfB64(1), mimeType: 'application/pdf' }, ctx);
    const pesertaRows = (await env.DB.prepare("SELECT * FROM berita_acara_admin_berkas WHERE ba_id=?1 AND scope='peserta' AND active=1").bind(baId).all()).results || [];
    expect(pesertaRows.length).toBe(1);
  });
});

describe('removeBaAdminSharedBerkas', () => {
  it('menonaktifkan baris shared dan regenerate', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    stubDrive();
    await setBaAdminSharedBerkas(env.DB, baId, { data: await pdfB64(2), mimeType: 'application/pdf' }, ctx);
    const res = await removeBaAdminSharedBerkas(env.DB, baId, ctx);
    expect(res.success).toBe(true);

    const active = (await env.DB.prepare("SELECT COUNT(*) AS n FROM berita_acara_admin_berkas WHERE ba_id=?1 AND scope='shared' AND active=1").bind(baId).first()).n;
    expect(Number(active)).toBe(0);
    const row = await env.DB.prepare("SELECT * FROM berita_acara_admin_berkas WHERE ba_id=?1 AND scope='shared'").bind(baId).first();
    expect(String(row.superseded_at || '')).not.toBe('');
  });

  it('tanpa shared aktif tetap sukses', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    stubDrive();
    const res = await removeBaAdminSharedBerkas(env.DB, baId, ctx);
    expect(res.success).toBe(true);
  });
});

describe('audit BA Pendukung', () => {
  it('mencatat BA_CREATE saat peserta pertama ditambahkan dan BA_UPDATE saat shared diunggah', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    stubDrive();
    await setBaAdminSharedBerkas(env.DB, baId, { data: await pdfB64(1), mimeType: 'application/pdf' }, ctx);

    const rows = (await env.DB.prepare('SELECT aksi, target FROM audit_log WHERE target=?1 ORDER BY id').bind(baId).all()).results || [];
    const aksi = rows.map((r) => r.aksi);
    expect(aksi).toContain('BA_CREATE');
    expect(aksi.filter((a) => a === 'BA_UPDATE').length).toBeGreaterThanOrEqual(1);
  });

  it('tidak mencatat saat tidak ada perubahan peserta', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    const before = (await env.DB.prepare('SELECT COUNT(*) AS n FROM audit_log WHERE target=?1').bind(baId).first()).n;
    await addBaAdminPesertaBulk(env.DB, baId, [], ctx);
    const after = (await env.DB.prepare('SELECT COUNT(*) AS n FROM audit_log WHERE target=?1').bind(baId).first()).n;
    expect(Number(after)).toBe(Number(before));
  });
});
