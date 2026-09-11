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
  it('upgrades a legacy plaintext password to a hash on successful login', async () => {
    await seedAuth();
    const res = await authenticateAdmin(env.DB, 'rahasia');
    expect(res.ok).toBe(true);
    const stored = (await env.DB.prepare('SELECT password FROM admin').first()).password;
    expect(stored).toMatch(/^pbkdf2\$/);
    const again = await authenticateAdmin(env.DB, 'rahasia');
    expect(again.ok).toBe(true);
  });
  it('locks out after repeated failed admin logins from the same ip', async () => {
    await seedAuth();
    for (let i = 0; i < 5; i++) {
      const r = await authenticateAdmin(env.DB, 'salah', '10.0.0.9');
      expect(r.message).toBe('Password admin salah.');
    }
    const locked = await authenticateAdmin(env.DB, 'rahasia', '10.0.0.9');
    expect(locked.ok).toBe(false);
    expect(locked.message).toContain('Terlalu banyak percobaan login');
    const other = await authenticateAdmin(env.DB, 'rahasia', '10.0.0.10');
    expect(other.ok).toBe(true);
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
