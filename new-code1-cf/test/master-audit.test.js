import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { auditMasterIntegrity } from '../src/read/masterAudit.js';
import { kegiatanKey } from '../src/read/common.js';

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }) };
}

describe('audit master integrity', () => {
  it('reports duplicates, orphan references, blank blocks, and key drift', async () => {
    await env.DB.prepare('DROP INDEX idx_master_kegiatan_unique').run();
    await env.DB.prepare("INSERT INTO master_kegiatan (kategori, nilai) VALUES ('Blok', 'Ganda')").run();
    await env.DB.prepare("INSERT INTO master_kegiatan (kategori, nilai) VALUES ('blok', ' ganda ')").run();
    await env.DB.prepare("INSERT INTO pengajuan (id_pengajuan, blok) VALUES ('P1', 'Blok Asing')").run();
    await env.DB.prepare("INSERT INTO pengajuan (id_pengajuan, blok) VALUES ('P2', '')").run();
    await env.DB.prepare("INSERT INTO berita_acara_admin (ba_id, bagian, blok, nama_kegiatan, kegiatan_key) VALUES ('BA1', 'Bagian A', 'A', 'Kegiatan', 'salah')").run();
    await env.DB.prepare("INSERT INTO jadwal_pelaksanaan (jadwal_id, bagian, blok, nama_kegiatan, kegiatan_key) VALUES ('J1', 'Bagian A', 'A', 'Kegiatan', ?1)").bind(kegiatanKey('Bagian A', 'A', 'Kegiatan')).run();

    const out = await auditMasterIntegrity(env.DB, await adminCtx());
    expect(out.duplicates).toEqual([{ kategori: 'Blok', nilai: 'ganda', count: 2 }]);
    expect(out.orphans).toEqual([{ table: 'pengajuan', blok: 'Blok Asing', count: 1 }]);
    expect(out.blanks).toContainEqual({ table: 'pengajuan', count: 1 });
    expect(out.keyDrift.berita_acara_admin.count).toBe(1);
    expect(out.keyDrift.jadwal_pelaksanaan.count).toBe(0);
    expect(out.totals.duplicates).toBe(1);
    expect(out.totals.orphans).toBe(1);
    expect(out.totals.keyDrift).toBe(1);
  });

  it('requires an admin session', async () => {
    await expect(auditMasterIntegrity(env.DB, {})).rejects.toThrow();
  });

  it('melaporkan kualitas data transaksi', async () => {
    await env.DB.prepare("INSERT INTO mahasiswa (npm, nama_lengkap, blok) VALUES ('2201010009','Tanpa Blok','')").run();
    await env.DB.prepare("INSERT INTO berita_acara_admin (timestamp,ba_id,bagian,blok,nama_kegiatan,kegiatan_key,needs_regen) VALUES ('2026-09-20T08:00:00','BA-PEN-2026-0001','SGD','A','SGD 1','sgd|a|sgd 1',1)").run();
    await env.DB.prepare("INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan) VALUES ('2026-09-20T08:00:00','BA-PEL-2026-0001','SGD','A','SGD 1')").run();
    await env.DB.prepare("INSERT INTO jadwal_pelaksanaan (timestamp,jadwal_id,bagian,blok,nama_kegiatan,kegiatan_key,tanggal,jam,dosen,active) VALUES ('2026-09-20T08:00:00','JDW-1','SGD','A','SGD 1','sgd|a|sgd 1','2026-09-20','09:00','dr. Andi',1)").run();
    await env.DB.prepare("INSERT INTO jadwal_pelaksanaan (timestamp,jadwal_id,bagian,blok,nama_kegiatan,kegiatan_key,tanggal,jam,dosen,active) VALUES ('2026-09-20T08:00:00','JDW-2','SGD','A','SGD 1','sgd|a|sgd 1','2026-09-20','09:00','dr. Andi',1)").run();
    await env.DB.prepare("INSERT INTO jadwal_peserta (timestamp,jadwal_id,id_pengajuan,npm,nama_lengkap) VALUES ('2026-09-20T08:00:00','JDW-1','INHAL-1','2201010001','Aisyah')").run();
    await env.DB.prepare("INSERT INTO jadwal_peserta (timestamp,jadwal_id,id_pengajuan,npm,nama_lengkap) VALUES ('2026-09-20T08:00:00','JDW-2','INHAL-1','2201010001','Aisyah')").run();

    const out = await auditMasterIntegrity(env.DB, await adminCtx());
    expect(out.dataQuality.mahasiswaBlokKosong.count).toBe(1);
    expect(out.dataQuality.baAdminOrphan.count).toBe(1);
    expect(out.dataQuality.baBagianOrphan.count).toBe(1);
    expect(out.dataQuality.jadwalDuplikat.count).toBe(1);
    expect(out.dataQuality.baNeedsRegen.count).toBe(1);
    expect(out.dataQuality.totals.baOrphan).toBe(2);
  });
});
