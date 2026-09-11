import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { getBaginaConfig, getBagianBootstrap, getBeritaAcaraList } from '../src/read/bagian.js';

async function bagianCtx(kategoris = ['*']) {
  return { token: await createSession(env.DB, { role: 'bagian', nama: 'Bagian Umum', kategori: '', subBagian: '', kategoris }) };
}
async function seed() {
  await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','Ujian','Diterima')").run();
  await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','Ujian','UAS','','2026-09-20','')").run();
  await env.DB.prepare("INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jumlah_peserta,sumber) VALUES ('2026-09-10T09:00:00','BA-2026-0001','Ujian','A','UAS','2026-09-20','1','Bagian')").run();
  await env.DB.prepare("INSERT INTO berita_acara_peserta (timestamp,ba_id,npm,nama_lengkap,blok) VALUES ('2026-09-10T09:00:00','BA-2026-0001','2201010001','Aisyah','A')").run();
}

describe('bagian read', () => {
  it('requires a bagian session for config', async () => {
    await expect(getBaginaConfig(env.DB, {})).rejects.toThrow();
    const cfg = await getBaginaConfig(env.DB, await bagianCtx());
    expect(cfg.categories).toEqual(['SGD', 'KKD', 'Ujian', 'Praktikum']);
    expect(Array.isArray(cfg.labOptions)).toBe(true);
  });
  it('returns bootstrap for a valid session', async () => {
    await seed();
    const boot = await getBagianBootstrap(env.DB, 'Ujian', '', await bagianCtx());
    expect(boot.ok).toBe(true);
    expect(boot.rows).toHaveLength(1);
    expect(boot.rows[0].idPengajuan).toBe('INHAL-1');
    expect(boot.baList).toHaveLength(1);
    expect(boot.baList[0].peserta).toHaveLength(1);
  });
  it('returns bootstrap with ok=false on invalid session', async () => {
    const boot = await getBagianBootstrap(env.DB, 'Ujian', '', { token: 'nope' });
    expect(boot.ok).toBe(false);
    expect(boot.message).toBe('Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.');
  });
  it('returns BA list for a valid session', async () => {
    await seed();
    const list = await getBeritaAcaraList(env.DB, 'Ujian', 'Ujian', await bagianCtx());
    expect(list).toHaveLength(1);
    expect(list[0]['BA ID']).toBe('BA-2026-0001');
  });
});
