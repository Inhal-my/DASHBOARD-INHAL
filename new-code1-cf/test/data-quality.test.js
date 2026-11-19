import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { auditDataQuality } from '../src/read/dataQuality.js';

async function seedSesi(baId, jadwalId, urutan) {
  await env.DB.prepare(
    'INSERT INTO berita_acara_sesi (timestamp, ba_id, jadwal_id, urutan) VALUES (?1, ?2, ?3, ?4)'
  ).bind('2026-11-19T00:00:00', baId, jadwalId, urutan).run();
}

describe('audit kualitas data BA', () => {
  it('mendeteksi sesi yatim dan urutan sesi ganda', async () => {
    await env.DB.prepare(
      "INSERT INTO berita_acara (timestamp, ba_id, bagian, blok, nama_kegiatan, kegiatan_key) VALUES ('2026-11-19T00:00:00','BA-T1','SGD','A','SGD 1','sgd|a|sgd 1')"
    ).run();
    await seedSesi('BA-T1', 'JDW-T1', 1);
    await seedSesi('BA-T1', 'JDW-T2', 1);
    await seedSesi('BA-HILANG', 'JDW-T3', 1);

    const res = await auditDataQuality(env.DB);

    expect(res.totals.baSesiUrutanGanda).toBe(1);
    expect(res.baSesiUrutanGanda.groups).toEqual([{ ba_id: 'BA-T1', urutan: 1, n: 2 }]);
    expect(res.totals.baSesiYatim).toBe(1);
    expect(res.baSesiYatim.samples).toEqual([{ ba_id: 'BA-HILANG', jadwal_id: 'JDW-T3', urutan: 1 }]);
  });

  it('tidak melaporkan temuan bila sesi konsisten', async () => {
    await env.DB.prepare(
      "INSERT INTO berita_acara (timestamp, ba_id, bagian, blok, nama_kegiatan, kegiatan_key) VALUES ('2026-11-19T00:00:00','BA-T2','SGD','A','SGD 1','sgd|a|sgd 1')"
    ).run();
    await seedSesi('BA-T2', 'JDW-T4', 1);
    await seedSesi('BA-T2', 'JDW-T5', 2);

    const res = await auditDataQuality(env.DB);

    expect(res.totals.baSesiUrutanGanda).toBe(0);
    expect(res.baSesiUrutanGanda.groups).toEqual([]);
    expect(res.totals.baSesiYatim).toBe(0);
    expect(res.baSesiYatim.samples).toEqual([]);
  });
});
