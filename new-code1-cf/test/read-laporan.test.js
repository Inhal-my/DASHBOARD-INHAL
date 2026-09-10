import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { getLaporanBootstrap } from '../src/read/laporan.js';

describe('getLaporanBootstrap', () => {
  it('summarizes pengajuan with biaya and BA', async () => {
    await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status,dosen,link_final) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','Ujian','Diterima','dr. Andi','https://x/final')").run();
    await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','Ujian','UAS','','2026-09-20','')").run();
    await env.DB.prepare("INSERT INTO master_biaya (kegiatan,biaya) VALUES ('Ujian','Rp. 300.000')").run();
    const ctx = { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }) };
    const boot = await getLaporanBootstrap(env.DB, ctx);
    expect(boot.summary.totalPendaftar).toBe(1);
    expect(boot.summary.totalDiterima).toBe(1);
    expect(boot.summary.totalBiaya).toBe(300000);
    expect(boot.rows[0].pengajuan['ID Pengajuan']).toBe('INHAL-1');
    expect(boot.rows[0].details).toHaveLength(1);
    expect(boot.dosen).toContain('dr. Andi');
    expect(boot.blok).toContain('A');
    expect(boot.bagian.labs).toContain('Lab Anatomi');
  });
});
