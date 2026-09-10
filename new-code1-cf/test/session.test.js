import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import {
  authenticateAdmin, authenticateBagian, getSession, logoutSession,
  requireAdmin, adminBagianBypass, AUTH_ERROR
} from '../src/session.js';

async function seedAuth() {
  await env.DB.prepare("INSERT INTO admin (password, nama) VALUES ('rahasia', 'Admin Utama')").run();
  await env.DB.prepare("INSERT INTO bagian_staff (email, kategori, nama, pass) VALUES ('a@x.id','*','Bagian Umum','bgn')").run();
  await env.DB.prepare("INSERT INTO bagian_staff (email, kategori, nama, pass) VALUES ('b@x.id','SGD','Bagian SGD','sgd')").run();
}

describe('session and auth', () => {
  it('authenticates admin and requires a valid token', async () => {
    await seedAuth();
    const res = await authenticateAdmin(env.DB, 'rahasia');
    expect(res.ok).toBe(true);
    expect(res.nama).toBe('Admin Utama');
    const s = await getSession(env.DB, res.token);
    expect(s.role).toBe('admin');
    await expect(requireAdmin(env.DB, res.token)).resolves.toBeTruthy();
  });
  it('rejects wrong admin password', async () => {
    await seedAuth();
    const res = await authenticateAdmin(env.DB, 'salah');
    expect(res.ok).toBe(false);
    expect(res.message).toBe('Password admin salah.');
  });
  it('rejects invalid token with exact message', async () => {
    await expect(requireAdmin(env.DB, 'nope')).rejects.toThrow(AUTH_ERROR);
  });
  it('authenticates bagian with wildcard and denies mismatched category', async () => {
    await seedAuth();
    const ok = await authenticateBagian(env.DB, 'bgn', 'SGD', '');
    expect(ok.ok).toBe(true);
    const denied = await authenticateBagian(env.DB, 'sgd', 'KKD', '');
    expect(denied.ok).toBe(false);
  });
  it('adminBagianBypass creates a bagian session', async () => {
    await seedAuth();
    const admin = await authenticateAdmin(env.DB, 'rahasia');
    const res = await adminBagianBypass(env.DB, 'SGD', '', admin.token);
    expect(res.ok).toBe(true);
    const s = await getSession(env.DB, res.token);
    expect(s.role).toBe('bagian');
  });
  it('logoutSession destroys the session', async () => {
    await seedAuth();
    const res = await authenticateAdmin(env.DB, 'rahasia');
    await logoutSession(env.DB, res.token);
    expect(await getSession(env.DB, res.token)).toBeNull();
  });
});
