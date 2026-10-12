import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { PDFDocument } from 'pdf-lib';
import { createSession } from '../src/session.js';
import { getOrCreateBaAdmin, addBaAdminPesertaBulk, setBaAdminPesertaBerkas, removeBaAdminPeserta, BA_ADMIN_MAX_PAGES } from '../src/write/baAdmin.js';

afterEach(() => { vi.unstubAllGlobals(); });

const BRIDGE = { GAS_DRIVE_URL: 'https://script.example/exec', GAS_DRIVE_TOKEN: 'tok' };
function stubSave() {
  let n = 0;
  const f = vi.fn(async () => { n += 1; return new Response(JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/IDIDIDIDIDIDIDID' + n + 'xxxx/view', fileId: 'IDIDIDIDIDIDIDID' + n + 'xxxx' }), { status: 200 }); });
  vi.stubGlobal('fetch', f);
  return f;
}
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

describe('baAdmin berkas', () => {
  it('mengunggah halaman & menyimpan baris berkas', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    stubSave();
    const res = await setBaAdminPesertaBerkas(env.DB, baId, 'INHAL-1', [IMG, IMG], ctx);
    expect(res.success).toBe(true);
    expect(res.pages).toBe(2);
    const rows = (await env.DB.prepare('SELECT page_index, active FROM berita_acara_admin_berkas WHERE ba_id=?1 ORDER BY page_index').bind(baId).all()).results;
    expect(rows.map(r => Number(r.page_index))).toEqual([0, 1]);
    expect(rows.every(r => Number(r.active) === 1)).toBe(true);
  });

  it('mengganti berkas: yang lama menjadi riwayat (active=0)', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    stubSave();
    await setBaAdminPesertaBerkas(env.DB, baId, 'INHAL-1', [IMG], ctx);
    await setBaAdminPesertaBerkas(env.DB, baId, 'INHAL-1', [IMG], ctx);
    const active = (await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara_admin_berkas WHERE ba_id=?1 AND active=1').bind(baId).first()).n;
    const all = (await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara_admin_berkas WHERE ba_id=?1').bind(baId).first()).n;
    expect(Number(active)).toBe(1);
    expect(Number(all)).toBe(2);
  });

  it('menolak melebihi batas halaman', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    stubSave();
    const many = new Array(BA_ADMIN_MAX_PAGES + 1).fill(IMG);
    const res = await setBaAdminPesertaBerkas(env.DB, baId, 'INHAL-1', many, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('halaman');
  });

  it('gagal unggah: tidak ada perubahan D1 (berkas lama tetap active)', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    stubSave();
    await setBaAdminPesertaBerkas(env.DB, baId, 'INHAL-1', [IMG], ctx);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: false, message: 'drive down' }), { status: 200 })));
    const res = await setBaAdminPesertaBerkas(env.DB, baId, 'INHAL-1', [IMG, IMG], ctx);
    expect(res.success).toBe(false);
    const active = (await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara_admin_berkas WHERE ba_id=?1 AND active=1').bind(baId).first()).n;
    const all = (await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara_admin_berkas WHERE ba_id=?1').bind(baId).first()).n;
    expect(Number(active)).toBe(1);
    expect(Number(all)).toBe(1);
  });

  it('hapus peserta: peserta & berkas menjadi tidak aktif', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    stubSave();
    await setBaAdminPesertaBerkas(env.DB, baId, 'INHAL-1', [IMG], ctx);
    const res = await removeBaAdminPeserta(env.DB, baId, 'INHAL-1', ctx);
    expect(res.success).toBe(true);
    const p = await env.DB.prepare('SELECT active FROM berita_acara_admin_peserta WHERE ba_id=?1 AND id_pengajuan=?2').bind(baId, 'INHAL-1').first();
    const b = await env.DB.prepare('SELECT active FROM berita_acara_admin_berkas WHERE ba_id=?1 AND id_pengajuan=?2').bind(baId, 'INHAL-1').first();
    expect(Number(p.active)).toBe(0);
    expect(Number(b.active)).toBe(0);
  });

  it('menerima PDF dan menyimpan page_count', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    stubSave();
    const res = await setBaAdminPesertaBerkas(env.DB, baId, 'INHAL-1', [{ data: await pdfB64(3), mimeType: 'application/pdf', name: 'scan.pdf' }], ctx);
    expect(res.success).toBe(true);
    expect(res.pages).toBe(3);
    const row = await env.DB.prepare('SELECT page_count, active FROM berita_acara_admin_berkas WHERE ba_id=?1').bind(baId).first();
    expect(Number(row.page_count)).toBe(3);
    expect(Number(row.active)).toBe(1);
  });

  it('menolak format berkas yang tidak didukung', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    const res = await setBaAdminPesertaBerkas(env.DB, baId, 'INHAL-1', [{ data: btoa('hello'), mimeType: 'text/plain', name: 'x.txt' }], ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('PDF');
  });

  it('menghitung batas dari jumlah halaman PDF', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    const res = await setBaAdminPesertaBerkas(env.DB, baId, 'INHAL-1', [{ data: await pdfB64(BA_ADMIN_MAX_PAGES + 1), mimeType: 'application/pdf', name: 'big.pdf' }], ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('halaman');
  });
});
