import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import migrationSql from '../migrations/2026-10-17-master-kegiatan-integrity.sql?raw';
import { kegiatanKey } from '../src/read/common.js';

const OLD = 'Gastrointestinal, hepatobilier, and pancreas';
const NEW = 'Gastro';

function statements() {
  return String(migrationSql)
    .split(';')
    .map((s) => s.replace(/--[^\n]*/g, '').trim())
    .filter(Boolean);
}

async function runMigration() {
  for (const stmt of statements()) await env.DB.prepare(stmt).run();
}

describe('migrasi integritas master kegiatan', () => {
  it('memindahkan seluruh referensi lama ke Gastro dan merapikan key', async () => {
    await env.DB.prepare('DROP INDEX idx_master_kegiatan_unique').run();
    await env.DB.prepare("INSERT INTO master_kegiatan (kategori, nilai) VALUES ('Blok', ?1)").bind(OLD).run();
    await env.DB.prepare("INSERT INTO master_kegiatan (kategori, nilai) VALUES ('Blok', 'Psikiatri')").run();
    await env.DB.prepare("INSERT INTO master_kegiatan (kategori, nilai) VALUES ('blok', ' psikiatri ')").run();
    const oldKey = kegiatanKey('Bagian A', OLD, 'Kegiatan A');
    await env.DB.prepare("INSERT INTO pengajuan (id_pengajuan, blok) VALUES ('P1', ?1)").bind(OLD).run();
    await env.DB.prepare("INSERT INTO check_data (check_id, id_pengajuan, blok) VALUES ('C1', 'P1', ?1)").bind(OLD).run();
    await env.DB.prepare("INSERT INTO berita_acara (ba_id, bagian, blok, nama_kegiatan, kegiatan_key) VALUES ('BA1', 'Bagian A', ?1, 'Kegiatan A', ?2)").bind(OLD, oldKey).run();
    await env.DB.prepare("INSERT INTO berita_acara_peserta (ba_id, id_pengajuan, blok) VALUES ('BA1', 'P1', ?1)").bind(OLD).run();
    await env.DB.prepare("INSERT INTO berita_acara_admin (ba_id, bagian, blok, nama_kegiatan, kegiatan_key, file_url) VALUES ('BA2', 'Bagian A', ?1, 'Kegiatan A', ?2, 'https://drive/ba2.pdf')").bind(OLD, oldKey).run();
    await env.DB.prepare("INSERT INTO berita_acara_admin_peserta (ba_id, id_pengajuan, blok) VALUES ('BA2', 'P1', ?1)").bind(OLD).run();
    await env.DB.prepare("INSERT INTO jadwal_pelaksanaan (jadwal_id, bagian, blok, nama_kegiatan, kegiatan_key) VALUES ('J1', 'Bagian A', ?1, 'Kegiatan A', ?2)").bind(OLD, oldKey).run();
    await env.DB.prepare("INSERT INTO jadwal_peserta (jadwal_id, id_pengajuan, blok) VALUES ('J1', 'P1', ?1)").bind(OLD).run();
    await env.DB.prepare("INSERT INTO log_upload (id_pengajuan, blok) VALUES ('P1', ?1)").bind(OLD).run();

    await runMigration();

    const expectedKey = kegiatanKey('Bagian A', NEW, 'Kegiatan A');
    for (const table of ['pengajuan', 'check_data', 'berita_acara', 'berita_acara_peserta', 'berita_acara_admin', 'berita_acara_admin_peserta', 'jadwal_pelaksanaan', 'jadwal_peserta', 'log_upload']) {
      const oldRows = await env.DB.prepare('SELECT COUNT(*) AS n FROM ' + table + ' WHERE lower(trim(blok)) = lower(?1)').bind(OLD).first();
      expect(oldRows.n).toBe(0);
    }
    for (const [table, idCol, id] of [['berita_acara', 'ba_id', 'BA1'], ['berita_acara_admin', 'ba_id', 'BA2'], ['jadwal_pelaksanaan', 'jadwal_id', 'J1']]) {
      const row = await env.DB.prepare('SELECT blok, kegiatan_key FROM ' + table + ' WHERE ' + idCol + ' = ?1').bind(id).first();
      expect(row.blok).toBe(NEW);
      expect(row.kegiatan_key).toBe(expectedKey);
    }
    expect((await env.DB.prepare("SELECT needs_regen FROM berita_acara_admin WHERE ba_id = 'BA2'").first()).needs_regen).toBe(1);

    const master = await env.DB.prepare("SELECT COUNT(*) AS n FROM master_kegiatan WHERE lower(trim(nilai)) = 'psikiatri'").first();
    expect(master.n).toBe(1);
    await expect(env.DB.prepare("INSERT INTO master_kegiatan (kategori, nilai) VALUES ('Blok', 'Gastro')").run()).rejects.toThrow();
  });
});
