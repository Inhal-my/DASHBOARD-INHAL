import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { dispatchRpc } from '../src/rpc.js';

describe('dispatchRpc', () => {
  it('returns an auth error object for a protected call without token', async () => {
    const res = await dispatchRpc(env.DB, 'getDashboardBootstrap', []);
    expect(res.error).toBe('Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.');
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
  it('dispatches public repo reads and protects the staff list', async () => {
    const m = await dispatchRpc(env.DB, 'getMahasiswaByNpm', ['2201010001']);
    expect(m['Nama Lengkap']).toBe('Aisyah Putri');
    const denied = await dispatchRpc(env.DB, 'getBagianStaffList', []);
    expect(denied.error).toBe('Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.');
  });
});
