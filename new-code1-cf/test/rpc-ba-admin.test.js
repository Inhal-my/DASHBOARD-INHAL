import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { dispatchRpc } from '../src/rpc.js';

afterEach(() => { vi.unstubAllGlobals(); });

describe('rpc baAdmin', () => {
  it('baAdminCreate lalu baAdminGet', async () => {
    await env.DB.prepare("INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-10-01T08:00:00','INHAL-1','2201010001','Aisyah','A','SGD','ACC')").run();
    await env.DB.prepare("INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-10-01T08:00:00','INHAL-1','SGD','SGD 1','','2026-10-20','')").run();
    const token = await createSession(env.DB, { role: 'admin', nama: 'Admin' });
    const get0 = await dispatchRpc(env.DB, 'baAdminGet', ['INHAL-1', token], '', env);
    expect(get0.success).toBe(true);
    expect(get0.data.ba).toBe(null);
    const created = await dispatchRpc(env.DB, 'baAdminCreate', [{ bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggalPelaksanaan: '2026-10-20' }, token], '', env);
    expect(created.success).toBe(true);
    const get1 = await dispatchRpc(env.DB, 'baAdminGet', ['INHAL-1', token], '', env);
    expect(get1.data.ba.baId).toBe(created.baId);
  });

  it('menolak tanpa token (tanpa bocor detail)', async () => {
    const res = await dispatchRpc(env.DB, 'baAdminGet', ['INHAL-1'], '', env);
    expect(res.success).toBeFalsy();
    expect(res.error || res.message).toBeTruthy();
  });
});
