import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { kegiatanKey } from '../src/read/common.js';
import { getOrCreateBaAdmin, addBaAdminPesertaBulk, getBaAdminForPengajuan, removeBaAdminPeserta } from '../src/write/baAdmin.js';

afterEach(() => { vi.unstubAllGlobals(); });
async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }), env: {} };
}
async function seed(id, npm, nama, status, pilihan) {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-10-01T08:00:00',?1,?2,?3,'A','SGD',?4)").bind(id, npm, nama, status).run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-10-01T08:00:00',?1,'SGD',?2,'','2026-10-20','')").bind(id, pilihan).run();
}
async function seedPraktikum(id, npm, nama, status, pilihan, detail) {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-10-01T08:00:00',?1,?2,?3,'A','Praktikum',?4)").bind(id, npm, nama, status).run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-10-01T08:00:00',?1,'Praktikum',?2,?3,'2026-10-20','')").bind(id, pilihan, detail).run();
}
const keg = { bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-10-20' };

describe('baAdmin create & peserta', () => {
  it('membuat satu BA per kegiatan (idempoten)', async () => {
    const ctx = await adminCtx();
    const a = await getOrCreateBaAdmin(env.DB, keg, ctx);
    const b = await getOrCreateBaAdmin(env.DB, keg, ctx);
    expect(a.success).toBe(true);
    expect(a.created).toBe(true);
    expect(b.baId).toBe(a.baId);
    expect(b.created).toBe(false);
  });

  it('menambah peserta bulk tanpa duplikat & memberi urutan', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    await seed('INHAL-2', '2201010002', 'Budi', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    const r1 = await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1', 'INHAL-2'], ctx);
    expect(r1.added).toBe(2);
    const r2 = await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    expect(r2.added).toBe(0);
    expect(r2.skipped).toBe(1);
    const rows = (await env.DB.prepare('SELECT * FROM berita_acara_admin_peserta WHERE ba_id=?1 AND active=1 ORDER BY urutan').bind(baId).all()).results;
    expect(rows.map(r => r.npm)).toEqual(['2201010001', '2201010002']);
  });

  it('getBaAdminForPengajuan mengembalikan BA, peserta, dan kandidat', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    await seed('INHAL-2', '2201010002', 'Budi', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    await env.DB.prepare("INSERT INTO berita_acara_admin_berkas (timestamp,ba_id,id_pengajuan,npm,urutan,page_index,file_name,file_url,active) VALUES ('2026-10-12T00:00:00',?1,'INHAL-1','2201010001',1,0,'p1.jpg','https://drive/f1',1)").bind(baId).run();
    const res = await getBaAdminForPengajuan(env.DB, 'INHAL-1', ctx);
    expect(res.success).toBe(true);
    expect(res.data.ba.baId).toBe(baId);
    expect(res.data.peserta.length).toBe(1);
    expect(res.data.peserta[0].pages).toBe(1);
    expect(res.data.peserta[0].fileUrl).toBe('https://drive/f1');
    expect(res.data.candidates.map(c => c.idPengajuan)).toContain('INHAL-2');
  });

  it('kandidat mencakup semua status termasuk Menunggu', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    await seed('INHAL-2', '2201010002', 'Budi', 'Menunggu', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    const res = await getBaAdminForPengajuan(env.DB, 'INHAL-1', ctx);
    expect(res.data.candidates.map((c) => c.idPengajuan)).toContain('INHAL-2');
    expect(res.data.candidates.find((c) => c.idPengajuan === 'INHAL-2').statusPengajuan).toBe('Menunggu');
  });

  it('menambah ulang peserta yang pernah dihapus: reactivate, bukan skip', async () => {
    await seed('INHAL-1', '2201010001', 'Aisyah', 'ACC', 'SGD 1');
    const ctx = await adminCtx();
    const { baId } = await getOrCreateBaAdmin(env.DB, keg, ctx);
    const r1 = await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    expect(r1.added).toBe(1);
    await removeBaAdminPeserta(env.DB, baId, 'INHAL-1', ctx);
    const r2 = await addBaAdminPesertaBulk(env.DB, baId, ['INHAL-1'], ctx);
    expect(r2.added).toBe(1);
    const rows = (await env.DB.prepare('SELECT active, urutan FROM berita_acara_admin_peserta WHERE ba_id=?1 AND id_pengajuan=?2').bind(baId, 'INHAL-1').all()).results;
    expect(rows.length).toBe(1);
    expect(Number(rows[0].active)).toBe(1);
    expect(Number(rows[0].urutan)).toBe(1);
  });

  it('bagian Praktikum memakai Lab (selaras BA lama)', async () => {
    await env.DB.prepare("INSERT INTO master_kegiatan (kategori,nilai) VALUES ('Lab','Lab Komputer')").run();
    await seedPraktikum('INHAL-P1', '2201010009', 'Citra', 'ACC', 'Lab Komputer', 'Modul 1');
    const ctx = await adminCtx();
    const res = await getBaAdminForPengajuan(env.DB, 'INHAL-P1', ctx);
    expect(res.success).toBe(true);
    expect(res.data.kegiatan.bagian).toBe('Lab Komputer');

    const key = kegiatanKey('Lab Komputer', 'A', 'Lab Komputer - Modul 1');
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jam,jumlah_peserta,file_name,file_url,catatan,sumber,kegiatan_key,updated_at,needs_regen) " +
      "VALUES ('2026-10-01T08:00:00','BA-PEN-LEGACY','Lab Komputer','A','Lab Komputer - Modul 1','2026-10-20','','0','','','','Admin',?1,'2026-10-01T08:00:00',0)"
    ).bind(key).run();

    const created = await getOrCreateBaAdmin(env.DB, res.data.kegiatan, ctx);
    expect(created.success).toBe(true);
    expect(created.created).toBe(false);
    expect(created.baId).toBe('BA-PEN-LEGACY');
  });

  it('requires admin', async () => {
    await expect(getOrCreateBaAdmin(env.DB, keg, {})).rejects.toThrow();
  });
});
