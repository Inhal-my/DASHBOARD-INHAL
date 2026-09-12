import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { saveMahasiswa, deleteMahasiswa } from '../src/write/master.js';

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }) };
}

describe('saveMahasiswa', () => {
  it('rejects writes without an admin token', async () => {
    await expect(saveMahasiswa(env.DB, { row: { npm: '1', mode: 'insert' } }, {})).rejects.toThrow();
    await expect(deleteMahasiswa(env.DB, '1', {})).rejects.toThrow();
  });

  it('inserts a new mahasiswa', async () => {
    const res = await saveMahasiswa(env.DB, {
      row: { npm: '9900000001', namaLengkap: 'Baru Satu', email: 'b@x.id', blok: 'A', keterangan: 'baru', mode: 'insert' }
    }, await adminCtx());
    expect(res.success).toBe(true);
    const row = await env.DB.prepare('SELECT * FROM mahasiswa WHERE npm = ?1').bind('9900000001').first();
    expect(row.nama_lengkap).toBe('Baru Satu');
    expect(row.email).toBe('b@x.id');
  });

  it('rejects insert when NPM already exists', async () => {
    await env.DB.prepare("INSERT INTO mahasiswa (npm, nama_lengkap) VALUES ('9900000001','Lama')").run();
    const res = await saveMahasiswa(env.DB, { row: { npm: '9900000001', namaLengkap: 'Dobel', mode: 'insert' } }, await adminCtx());
    expect(res.success).toBe(false);
    const row = await env.DB.prepare('SELECT nama_lengkap FROM mahasiswa WHERE npm = ?1').bind('9900000001').first();
    expect(row.nama_lengkap).toBe('Lama');
  });

  it('updates an existing mahasiswa', async () => {
    await env.DB.prepare("INSERT INTO mahasiswa (npm, nama_lengkap, email) VALUES ('9900000001','Lama','lama@x.id')").run();
    const ok = await saveMahasiswa(env.DB, {
      row: { npm: '9900000001', namaLengkap: 'Diubah', email: '', blok: '', keterangan: '', mode: 'update' }
    }, await adminCtx());
    expect(ok.success).toBe(true);
    const row = await env.DB.prepare('SELECT nama_lengkap, email FROM mahasiswa WHERE npm = ?1').bind('9900000001').first();
    expect(row.nama_lengkap).toBe('Diubah');
    expect(row.email).toBe('');
  });

  it('rejects update for a missing NPM and rejects empty NPM', async () => {
    const ctx = await adminCtx();
    const miss = await saveMahasiswa(env.DB, { row: { npm: '0000000000', namaLengkap: 'X', mode: 'update' } }, ctx);
    expect(miss.success).toBe(false);
    const empty = await saveMahasiswa(env.DB, { row: { npm: '  ', mode: 'insert' } }, ctx);
    expect(empty.success).toBe(false);
  });
});

describe('deleteMahasiswa', () => {
  it('deletes an existing row and rejects a missing one', async () => {
    await env.DB.prepare("INSERT INTO mahasiswa (npm, nama_lengkap) VALUES ('9900000001','Hapus')").run();
    const ctx = await adminCtx();
    const ok = await deleteMahasiswa(env.DB, '9900000001', ctx);
    expect(ok.success).toBe(true);
    expect(await env.DB.prepare('SELECT npm FROM mahasiswa WHERE npm = ?1').bind('9900000001').first()).toBeNull();
    const miss = await deleteMahasiswa(env.DB, '9900000001', ctx);
    expect(miss.success).toBe(false);
  });
});
