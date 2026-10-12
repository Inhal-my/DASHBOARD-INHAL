import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';

describe('skema ba pendukung berkas', () => {
  it('menyimpan kolom needs_regen & updated_at pada berita_acara_admin', async () => {
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,kegiatan_key,needs_regen,updated_at) VALUES ('2026-10-12T00:00:00','BA-PEN-2026-0001','SGD','A','SGD 1','2026-10-20','sgd|a|sgd 1',1,'2026-10-12T01:00:00')"
    ).run();
    const row = await env.DB.prepare('SELECT needs_regen, updated_at FROM berita_acara_admin WHERE ba_id = ?1').bind('BA-PEN-2026-0001').first();
    expect(Number(row.needs_regen)).toBe(1);
    expect(row.updated_at).toBe('2026-10-12T01:00:00');
  });

  it('menyimpan urutan & active pada peserta', async () => {
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok,urutan,active) VALUES ('2026-10-12T00:00:00','BA-PEN-2026-0001','INHAL-1','2201010001','Aisyah','A',1,1)"
    ).run();
    const row = await env.DB.prepare('SELECT urutan, active FROM berita_acara_admin_peserta WHERE ba_id = ?1').bind('BA-PEN-2026-0001').first();
    expect(Number(row.urutan)).toBe(1);
    expect(Number(row.active)).toBe(1);
  });

  it('menyimpan baris berkas per mahasiswa', async () => {
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin_berkas (timestamp,ba_id,id_pengajuan,npm,urutan,page_index,file_name,file_url,active) VALUES ('2026-10-12T00:00:00','BA-PEN-2026-0001','INHAL-1','2201010001',1,0,'p1.jpg','https://drive/x',1)"
    ).run();
    const row = await env.DB.prepare('SELECT page_index, active FROM berita_acara_admin_berkas WHERE ba_id = ?1').bind('BA-PEN-2026-0001').first();
    expect(Number(row.page_index)).toBe(0);
    expect(Number(row.active)).toBe(1);
  });
});
