import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { saveMasterRow, deleteMasterRow, previewMasterRename, renameMasterValue, saveMasterKegiatan } from '../src/write/master.js';
import { kegiatanKey } from '../src/read/common.js';

async function adminCtx() {
  return { token: await createSession(env.DB, { role: 'admin', nama: 'Admin' }) };
}

const OLD = 'Blok Lama';
const NEW = 'Blok Baru';
const BAGIAN = 'Bagian A';
const KEGIATAN = 'Kegiatan A';

async function seedBlokUsage() {
  await env.DB.prepare("INSERT INTO master_kegiatan (kategori, nilai) VALUES ('Blok', ?1)").bind(OLD).run();
  const master = await env.DB.prepare("SELECT id FROM master_kegiatan WHERE kategori = 'Blok' AND nilai = ?1").bind(OLD).first();
  const oldKey = kegiatanKey(BAGIAN, OLD, KEGIATAN);

  await env.DB.prepare("INSERT INTO pengajuan (id_pengajuan, npm, nama_lengkap, blok, jenis_kegiatan) VALUES ('P1', '1', 'Satu', ?1, 'Blok')").bind(OLD).run();
  await env.DB.prepare("INSERT INTO check_data (check_id, id_pengajuan, npm, nama_lengkap, blok, jenis_kegiatan) VALUES ('C1', 'P1', '1', 'Satu', ?1, 'Blok')").bind(OLD).run();
  await env.DB.prepare("UPDATE mahasiswa SET blok = ?1 WHERE npm = '2201010001'").bind(OLD).run();
  await env.DB.prepare("INSERT INTO berita_acara (ba_id, bagian, blok, nama_kegiatan, kegiatan_key) VALUES ('BA1', ?1, ?2, ?3, ?4)").bind(BAGIAN, OLD, KEGIATAN, oldKey).run();
  await env.DB.prepare("INSERT INTO berita_acara_peserta (ba_id, id_pengajuan, blok) VALUES ('BA1', 'P1', ?1)").bind(OLD).run();
  await env.DB.prepare("INSERT INTO berita_acara_admin (ba_id, bagian, blok, nama_kegiatan, kegiatan_key, file_url) VALUES ('BA2', ?1, ?2, ?3, ?4, 'https://drive/ba2.pdf')").bind(BAGIAN, OLD, KEGIATAN, oldKey).run();
  await env.DB.prepare("INSERT INTO berita_acara_admin (ba_id, bagian, blok, nama_kegiatan, kegiatan_key, file_url) VALUES ('BA3', ?1, ?2, ?3, ?4, '')").bind(BAGIAN, OLD, KEGIATAN, oldKey).run();
  await env.DB.prepare("INSERT INTO berita_acara_admin_peserta (ba_id, id_pengajuan, blok) VALUES ('BA2', 'P1', ?1)").bind(OLD).run();
  await env.DB.prepare("INSERT INTO jadwal_pelaksanaan (jadwal_id, bagian, blok, nama_kegiatan, kegiatan_key) VALUES ('J1', ?1, ?2, ?3, ?4)").bind(BAGIAN, OLD, KEGIATAN, oldKey).run();
  await env.DB.prepare("INSERT INTO jadwal_peserta (jadwal_id, id_pengajuan, blok) VALUES ('J1', 'P1', ?1)").bind(OLD).run();
  await env.DB.prepare("INSERT INTO log_upload (id_pengajuan, blok) VALUES ('P1', ?1)").bind(OLD).run();

  return { masterId: master.id, oldKey };
}

describe('rename master blok', () => {
  it('previews how many rows in each table are affected', async () => {
    const { masterId } = await seedBlokUsage();
    const res = await previewMasterRename(env.DB, { id: masterId, newValue: NEW }, await adminCtx());
    expect(res.success).toBe(true);
    expect(res.oldValue).toBe(OLD);
    expect(res.newValue).toBe(NEW);
    expect(res.impact).toMatchObject({
      pengajuan: 1, check_data: 1, mahasiswa: 1, berita_acara: 1, berita_acara_peserta: 1,
      berita_acara_admin: 2, berita_acara_admin_peserta: 1, jadwal_pelaksanaan: 1,
      jadwal_peserta: 1, log_upload: 1
    });
    expect(res.baRegen).toBe(1);
  });

  it('updates every reference, recomputes kegiatan_key, and marks BA files for regeneration', async () => {
    const { masterId } = await seedBlokUsage();
    const res = await renameMasterValue(env.DB, { id: masterId, newValue: NEW }, await adminCtx());
    expect(res.success).toBe(true);

    const master = await env.DB.prepare('SELECT nilai FROM master_kegiatan WHERE id = ?1').bind(masterId).first();
    expect(master.nilai).toBe(NEW);

    for (const [table, where] of [
      ['pengajuan', "id_pengajuan = 'P1'"], ['check_data', "check_id = 'C1'"],
      ['mahasiswa', "npm = '2201010001'"], ['berita_acara', "ba_id = 'BA1'"],
      ['berita_acara_peserta', "ba_id = 'BA1'"], ['berita_acara_admin', "ba_id IN ('BA2','BA3')"],
      ['berita_acara_admin_peserta', "ba_id = 'BA2'"], ['jadwal_pelaksanaan', "jadwal_id = 'J1'"],
      ['jadwal_peserta', "jadwal_id = 'J1'"], ['log_upload', "id_pengajuan = 'P1'"]
    ]) {
      const rows = await env.DB.prepare(`SELECT blok FROM ${table} WHERE ${where}`).all();
      expect(rows.results.length).toBeGreaterThan(0);
      for (const row of rows.results) expect(row.blok).toBe(NEW);
    }

    const expectedKey = kegiatanKey(BAGIAN, NEW, KEGIATAN);
    for (const [table, idCol, id] of [
      ['berita_acara', 'ba_id', 'BA1'], ['berita_acara_admin', 'ba_id', 'BA2'],
      ['berita_acara_admin', 'ba_id', 'BA3'], ['jadwal_pelaksanaan', 'jadwal_id', 'J1']
    ]) {
      const row = await env.DB.prepare(`SELECT kegiatan_key FROM ${table} WHERE ${idCol} = ?1`).bind(id).first();
      expect(row.kegiatan_key).toBe(expectedKey);
    }

    const ba2 = await env.DB.prepare("SELECT needs_regen FROM berita_acara_admin WHERE ba_id = 'BA2'").first();
    const ba3 = await env.DB.prepare("SELECT needs_regen FROM berita_acara_admin WHERE ba_id = 'BA3'").first();
    expect(ba2.needs_regen).toBe(1);
    expect(ba3.needs_regen).toBe(0);

    const audit = await env.DB.prepare("SELECT aksi, target FROM audit_log ORDER BY id DESC").first();
    expect(audit.aksi).toBe('RENAME_MASTER');
    expect(audit.target).toContain(OLD);
  });

  it('rejects a target name that already exists or is already used by data', async () => {
    const { masterId } = await seedBlokUsage();
    await env.DB.prepare("INSERT INTO master_kegiatan (kategori, nilai) VALUES ('Blok', 'Sudah Ada')").run();
    const ctx = await adminCtx();
    const conflict = await renameMasterValue(env.DB, { id: masterId, newValue: 'sudah ada' }, ctx);
    expect(conflict.success).toBe(false);
    expect(conflict.code).toBe('RENAME_CONFLICT');

    await env.DB.prepare("INSERT INTO pengajuan (id_pengajuan, blok) VALUES ('P9', 'Data Yatim')").run();
    const orphan = await renameMasterValue(env.DB, { id: masterId, newValue: 'Data Yatim' }, ctx);
    expect(orphan.success).toBe(false);
    expect(orphan.code).toBe('RENAME_CONFLICT');
    expect((await env.DB.prepare('SELECT nilai FROM master_kegiatan WHERE id = ?1').bind(masterId).first()).nilai).toBe(OLD);
  });

  it('rejects blank or missing rows', async () => {
    const { masterId } = await seedBlokUsage();
    const ctx = await adminCtx();
    expect((await renameMasterValue(env.DB, { id: masterId, newValue: '  ' }, ctx)).success).toBe(false);
    expect((await renameMasterValue(env.DB, { id: 999999, newValue: NEW }, ctx)).success).toBe(false);
  });

  it('blocks renaming a used value through the generic save path', async () => {
    const { masterId } = await seedBlokUsage();
    const ctx = await adminCtx();
    const res = await saveMasterRow(env.DB, {
      table: 'master_kegiatan', row: { id: masterId, Kategori: 'Blok', Nilai: NEW }
    }, ctx);
    expect(res.success).toBe(false);
    expect(res.code).toBe('RENAME_REQUIRED');
    expect((await env.DB.prepare('SELECT nilai FROM master_kegiatan WHERE id = ?1').bind(masterId).first()).nilai).toBe(OLD);
  });

  it('allows renaming an unused master value through the generic save path', async () => {
    await env.DB.prepare("INSERT INTO master_kegiatan (kategori, nilai) VALUES ('Blok', 'Belum Dipakai')").run();
    const row = await env.DB.prepare("SELECT id FROM master_kegiatan WHERE nilai = 'Belum Dipakai'").first();
    const res = await saveMasterRow(env.DB, {
      table: 'master_kegiatan', row: { id: row.id, Kategori: 'Blok', Nilai: 'Masih Bebas' }
    }, await adminCtx());
    expect(res.success).toBe(true);
    expect((await env.DB.prepare('SELECT nilai FROM master_kegiatan WHERE id = ?1').bind(row.id).first()).nilai).toBe('Masih Bebas');
  });

  it('rejects duplicate master values and blocks deleting a used value', async () => {
    const { masterId } = await seedBlokUsage();
    const ctx = await adminCtx();
    const dup = await saveMasterRow(env.DB, { table: 'master_kegiatan', row: { Kategori: 'Blok', Nilai: 'blok lama' } }, ctx);
    expect(dup.success).toBe(false);
    const del = await deleteMasterRow(env.DB, { table: 'master_kegiatan', id: masterId }, ctx);
    expect(del.success).toBe(false);
    expect(del.code).toBe('MASTER_IN_USE');
  });

  it('menolak replace-all master yang menghilangkan blok terpakai', async () => {
    await seedBlokUsage();
    const res = await saveMasterKegiatan(env.DB, {
      rows: [{ Kategori: 'Blok', Nilai: NEW }, { Kategori: 'Ujian', Nilai: 'UTS' }]
    }, await adminCtx());
    expect(res.success).toBe(false);
    expect(res.code).toBe('RENAME_REQUIRED');
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM master_kegiatan WHERE nilai = ?1").bind(OLD).first()).n).toBe(1);
  });
});
