import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { saveMahasiswa, deleteMahasiswa } from '../src/write/master.js';
import { getMasterDataMonitor } from '../src/read/dashboard.js';

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

import { importMahasiswaCsv } from '../src/write/master.js';

describe('importMahasiswaCsv', () => {
  it('inserts new NPM and updates existing NPM, keeping other columns', async () => {
    const ctx = await adminCtx();
    await env.DB.prepare("INSERT INTO mahasiswa (npm, nama_lengkap, email, blok, keterangan) VALUES ('8800000001','Lama','lama@x.id','Z','note')").run();
    const res = await importMahasiswaCsv(env.DB, {
      rows: [
        { npm: '8800000001', namaLengkap: 'Nama Baru' },
        { npm: '8800000002', namaLengkap: 'Siswa Dua' }
      ]
    }, ctx);
    expect(res.success).toBe(true);
    expect(res.inserted).toBe(1);
    expect(res.updated).toBe(1);
    const kept = await env.DB.prepare('SELECT * FROM mahasiswa WHERE npm = ?1').bind('8800000001').first();
    expect(kept.nama_lengkap).toBe('Nama Baru');
    expect(kept.email).toBe('lama@x.id');
    expect(kept.blok).toBe('Z');
    expect(kept.keterangan).toBe('note');
    const fresh = await env.DB.prepare('SELECT * FROM mahasiswa WHERE npm = ?1').bind('8800000002').first();
    expect(fresh.email).toBe('');
    expect(fresh.blok).toBe('');
  });

  it('skips blank NPM and rejects duplicate NPM in the file', async () => {
    const ctx = await adminCtx();
    const res = await importMahasiswaCsv(env.DB, {
      rows: [{ npm: '', namaLengkap: 'Kosong' }, { npm: '8800000003', namaLengkap: 'Tiga' }]
    }, ctx);
    expect(res.success).toBe(true);
    expect(res.skipped).toBe(1);
    const dup = await importMahasiswaCsv(env.DB, {
      rows: [{ npm: '8800000004', namaLengkap: 'A' }, { npm: '8800000004', namaLengkap: 'B' }]
    }, ctx);
    expect(dup.success).toBe(false);
    expect(await env.DB.prepare('SELECT npm FROM mahasiswa WHERE npm = ?1').bind('8800000004').first()).toBeNull();
  });

  it('rejects an empty payload', async () => {
    const res = await importMahasiswaCsv(env.DB, { rows: [] }, await adminCtx());
    expect(res.success).toBe(false);
  });
});

import { saveMasterRow, deleteMasterRow } from '../src/write/master.js';

describe('saveMasterRow and deleteMasterRow', () => {
  it('inserts and updates a master_kegiatan row by id', async () => {
    const ctx = await adminCtx();
    const ins = await saveMasterRow(env.DB, { table: 'master_kegiatan', row: { Kategori: 'Blok', Nilai: 'C' } }, ctx);
    expect(ins.success).toBe(true);
    const row = await env.DB.prepare("SELECT * FROM master_kegiatan WHERE nilai = 'C'").first();
    const upd = await saveMasterRow(env.DB, { table: 'master_kegiatan', row: { id: row.id, Kategori: 'Blok', Nilai: 'D' } }, ctx);
    expect(upd.success).toBe(true);
    const after = await env.DB.prepare('SELECT nilai FROM master_kegiatan WHERE id = ?1').bind(row.id).first();
    expect(after.nilai).toBe('D');
  });

  it('rejects unknown tables and empty rows', async () => {
    const ctx = await adminCtx();
    expect((await saveMasterRow(env.DB, { table: 'pengajuan', row: { npm: '1' } }, ctx)).success).toBe(false);
    expect((await saveMasterRow(env.DB, { table: 'master_kegiatan', row: {} }, ctx)).success).toBe(false);
  });

  it('inserts config, rejects duplicate key, updates by key, and never deletes config', async () => {
    const ctx = await adminCtx();
    const ins = await saveMasterRow(env.DB, { table: 'config', row: { Key: 'TEMA', Value: 'indigo' } }, ctx);
    expect(ins.success).toBe(true);
    const dup = await saveMasterRow(env.DB, { table: 'config', row: { Key: 'tema', Value: 'x' } }, ctx);
    expect(dup.success).toBe(false);
    const upd = await saveMasterRow(env.DB, { table: 'config', row: { Key: 'bukti_mode', Value: 'lenggang', mode: 'update' } }, ctx);
    expect(upd.success).toBe(true);
    const row = await env.DB.prepare("SELECT value FROM config WHERE lower(key) = 'bukti_mode'").first();
    expect(row.value).toBe('lenggang');
    const miss = await saveMasterRow(env.DB, { table: 'config', row: { Key: 'TIDAK_ADA', Value: 'x', mode: 'update' } }, ctx);
    expect(miss.success).toBe(false);
    const del = await deleteMasterRow(env.DB, { table: 'config' }, ctx);
    expect(del.success).toBe(false);
  });

  it('keeps the old password when the field is blank on update', async () => {
    const ctx = await adminCtx();
    await env.DB.prepare("INSERT INTO admin (password, nama) VALUES ('pbkdf2$1000$YQ==$YQ==','Admin Lama')").run();
    const row = await env.DB.prepare('SELECT * FROM admin ORDER BY id DESC LIMIT 1').first();
    const upd = await saveMasterRow(env.DB, { table: 'admin', row: { id: row.id, Password: '', Nama: 'Admin Tetap' } }, ctx);
    expect(upd.success).toBe(true);
    const after = await env.DB.prepare('SELECT password, nama FROM admin WHERE id = ?1').bind(row.id).first();
    expect(after.password).toBe('pbkdf2$1000$YQ==$YQ==');
    expect(after.nama).toBe('Admin Tetap');
  });

  it('hashes a new password on update', async () => {
    await env.DB.prepare("INSERT INTO admin (password, nama) VALUES ('pbkdf2$1000$YQ==$YQ==','Admin Awal')").run();
    const row = await env.DB.prepare('SELECT * FROM admin ORDER BY id DESC LIMIT 1').first();
    const upd = await saveMasterRow(env.DB, { table: 'admin', row: { id: row.id, Password: 'rahasia2', Nama: 'Admin' } }, await adminCtx());
    expect(upd.success).toBe(true);
    const after = await env.DB.prepare('SELECT password FROM admin WHERE id = ?1').bind(row.id).first();
    expect(after.password).toMatch(/^pbkdf2\$/);
  });

  it('deletes a non-config row and rejects a missing id', async () => {
    await env.DB.prepare("INSERT INTO master_kegiatan (kategori, nilai) VALUES ('Blok','D')").run();
    const row = await env.DB.prepare("SELECT * FROM master_kegiatan WHERE nilai = 'D'").first();
    const ctx = await adminCtx();
    const ok = await deleteMasterRow(env.DB, { table: 'master_kegiatan', id: row.id }, ctx);
    expect(ok.success).toBe(true);
    const miss = await deleteMasterRow(env.DB, { table: 'master_kegiatan', id: 999999 }, ctx);
    expect(miss.success).toBe(false);
  });
});

describe('getMasterDataMonitor mahasiswa', () => {
  it('includes mahasiswa mapped to client columns', async () => {
    await env.DB.prepare("INSERT INTO mahasiswa (npm, nama_lengkap, email, blok, keterangan) VALUES ('7700000001','Uji Map','u@x.id','B','ket')").run();
    const data = await getMasterDataMonitor(env.DB, await adminCtx());
    const row = data.mahasiswa.find((r) => r.NPM === '7700000001');
    expect(row['Nama Lengkap']).toBe('Uji Map');
    expect(row.Email).toBe('u@x.id');
    expect(row.Blok).toBe('B');
  });
});
