import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';

describe('skema ba tanggal & dosen', () => {
  it('menyimpan jam, dosen, kegiatan_key pada berita_acara', async () => {
    await env.DB.prepare(
      "INSERT INTO berita_acara (timestamp, ba_id, bagian, blok, nama_kegiatan, tanggal_pelaksanaan, jam, dosen, kegiatan_key) VALUES ('2026-09-20T00:00:00','BA-2026-0001','SGD','A','SGD 1','2026-09-20','09:00','dr. Andi','sgd|a|sgd 1')"
    ).run();
    const row = await env.DB.prepare('SELECT jam, dosen, kegiatan_key FROM berita_acara WHERE ba_id = ?1').bind('BA-2026-0001').first();
    expect(row.jam).toBe('09:00');
    expect(row.dosen).toBe('dr. Andi');
    expect(row.kegiatan_key).toBe('sgd|a|sgd 1');
  });

  it('menyimpan jam dan kegiatan_key pada berita_acara_admin', async () => {
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin (timestamp, ba_id, bagian, blok, nama_kegiatan, tanggal_pelaksanaan, jam, kegiatan_key) VALUES ('2026-09-12T00:00:00','BA-2026-0002','SGD','A','SGD 1','2026-09-12','10:15','sgd|a|sgd 1')"
    ).run();
    const row = await env.DB.prepare('SELECT jam, kegiatan_key FROM berita_acara_admin WHERE ba_id = ?1').bind('BA-2026-0002').first();
    expect(row.jam).toBe('10:15');
    expect(row.kegiatan_key).toBe('sgd|a|sgd 1');
  });
});
