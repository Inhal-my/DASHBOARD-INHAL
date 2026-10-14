import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { addBaAdminPesertaWithBerkas } from '../src/write/baAdmin.js';

afterEach(() => { vi.unstubAllGlobals(); });

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
const BRIDGE = { GAS_DRIVE_URL: 'https://script.example/exec', GAS_DRIVE_TOKEN: 'tok' };
async function adminCtx() { return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), env: { ...BRIDGE } }; }
async function seed(id, npm, nama, status, pilihan) {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-10-01T08:00:00',?1,?2,?3,'A','SGD',?4)").bind(id, npm, nama, status).run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-10-01T08:00:00',?1,'SGD',?2,'','2026-10-20','')").bind(id, pilihan).run();
}
const keg = { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-10-20' };
const IMG = { data: PNG, mimeType: 'image/png', name: 'p.png' };

function stubBridge() {
  vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (body.action === 'getFile') return new Response(JSON.stringify({ success: true, base64: PNG, mimeType: 'image/png' }), { status: 200 });
    return new Response(JSON.stringify({ success: true, url: 'https://drive.google.com/file/d/NEWNEWNEWNEWNEWNEWNEWNEW1/view', fileId: 'NEWNEWNEWNEWNEWNEWNEWNEW1' }), { status: 200 });
  }));
}

describe('addBaAdminPesertaWithBerkas', () => {
  it('menolak bila berkas kosong (tidak membuat BA)', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const res = await addBaAdminPesertaWithBerkas(env.DB, keg, 'INHAL-1', [], ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('wajib');
    const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara_admin').first()).n;
    expect(Number(n)).toBe(0);
  });

  it('membuat BA, peserta aktif, berkas aktif, dan PDF tergenerate', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    stubBridge();
    const res = await addBaAdminPesertaWithBerkas(env.DB, keg, 'INHAL-1', [IMG], ctx);
    expect(res.success).toBe(true);
    const baId = res.baId;
    const p = await env.DB.prepare('SELECT active FROM berita_acara_admin_peserta WHERE ba_id=?1 AND id_pengajuan=?2').bind(baId, 'INHAL-1').first();
    expect(Number(p.active)).toBe(1);
    const b = await env.DB.prepare('SELECT active FROM berita_acara_admin_berkas WHERE ba_id=?1 AND id_pengajuan=?2').bind(baId, 'INHAL-1').first();
    expect(Number(b.active)).toBe(1);
    const ba = await env.DB.prepare('SELECT file_url, needs_regen FROM berita_acara_admin WHERE ba_id=?1').bind(baId).first();
    expect(ba.file_url).toContain('NEWNEWNEWNEWNEWNEWNEWNEW1');
    expect(Number(ba.needs_regen)).toBe(0);
  });

  it('idempoten saat peserta sudah ada (tidak menggandakan baris)', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    stubBridge();
    const r1 = await addBaAdminPesertaWithBerkas(env.DB, keg, 'INHAL-1', [IMG], ctx);
    const r2 = await addBaAdminPesertaWithBerkas(env.DB, keg, 'INHAL-1', [IMG], ctx);
    expect(r1.baId).toBe(r2.baId);
    const rows = (await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara_admin_peserta WHERE ba_id=?1 AND id_pengajuan=?2').bind(r1.baId, 'INHAL-1').first()).n;
    expect(Number(rows)).toBe(1);
    const ber = (await env.DB.prepare('SELECT COUNT(*) AS n FROM berita_acara_admin_berkas WHERE ba_id=?1 AND id_pengajuan=?2 AND active=1').bind(r1.baId, 'INHAL-1').first()).n;
    expect(Number(ber)).toBe(1);
  });
});
