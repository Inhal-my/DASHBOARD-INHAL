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
});
