import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { dispatchRpc } from '../src/rpc.js';

describe('dispatchRpc', () => {
  it('returns an auth error object for a protected call without token', async () => {
    const res = await dispatchRpc(env.DB, 'getDashboardBootstrap', []);
    expect(res.error).toBe('Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.');
  });
  it('masks internal errors instead of leaking them', async () => {
    const boom = { prepare() { throw new Error('SQLITE_ERROR: no such table: rahasia'); } };
    const res = await dispatchRpc(boom, 'authenticateAdmin', [[]]);
    expect(res.error).toBe('Terjadi kesalahan pada server. Silakan coba lagi.');
    expect(res.error).not.toContain('SQLITE');
  });
  it('stubs unknown write functions', async () => {
    const res = await dispatchRpc(env.DB, 'fiturTidakAda', [['x']]);
    expect(res).toEqual({ success: false, message: 'Fitur fiturTidakAda belum tersedia pada tahap ini.' });
  });
  it('dispatches authenticateAdmin', async () => {
    await env.DB.prepare("INSERT INTO admin (password, nama) VALUES ('rahasia','Admin')").run();
    const res = await dispatchRpc(env.DB, 'authenticateAdmin', ['rahasia']);
    expect(res.ok).toBe(true);
  });
  it('dispatches admin repo reads and protects them without a token', async () => {
    const deniedRead = await dispatchRpc(env.DB, 'getMahasiswaByNpm', ['2201010001']);
    expect(deniedRead.error).toBe('Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.');
    const denied = await dispatchRpc(env.DB, 'getBagianStaffList', []);
    expect(denied.error).toBe('Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.');

    await env.DB.prepare("INSERT INTO admin (password, nama) VALUES ('rahasia','Admin')").run();
    const sess = await dispatchRpc(env.DB, 'authenticateAdmin', ['rahasia']);
    const m = await dispatchRpc(env.DB, 'getMahasiswaByNpm', ['2201010001', sess.token]);
    expect(m['Nama Lengkap']).toBe('Aisyah Putri');
  });
  it('dispatches the new master row RPCs', async () => {
    await env.DB.prepare("INSERT INTO admin (password, nama) VALUES ('rahasia','Admin')").run();
    const sess = await dispatchRpc(env.DB, 'authenticateAdmin', ['rahasia']);
    const token = sess.token;
    const save = await dispatchRpc(env.DB, 'saveMahasiswa', [{ row: { npm: '6600000001', namaLengkap: 'RPC Test', mode: 'insert' } }, token]);
    expect(save.success).toBe(true);
    const csv = await dispatchRpc(env.DB, 'importMahasiswaCsv', [{ rows: [{ npm: '6600000002', namaLengkap: 'CSV Test' }] }, token]);
    expect(csv.success).toBe(true);
    const master = await dispatchRpc(env.DB, 'saveMasterRow', [{ table: 'master_biaya', row: { Kegiatan: 'KKD', Biaya: 'Rp 1' } }, token]);
    expect(master.success).toBe(true);
    const del = await dispatchRpc(env.DB, 'deleteMahasiswa', ['6600000001', token]);
    expect(del.success).toBe(true);
  });
});
