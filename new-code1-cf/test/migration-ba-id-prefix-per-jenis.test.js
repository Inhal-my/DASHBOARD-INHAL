import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import migrationSql from '../migrations/2026-09-17-ba-id-prefix-per-jenis.sql?raw';

const statements = String(migrationSql)
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

describe('migrasi awalan ba_id per jenis', () => {
  it('mengubah nomor lama menjadi BA-PEL / BA-PEN di semua tabel', async () => {
    await env.DB.prepare(
      "INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,sumber) VALUES ('2026-09-10T09:00:00','BA-2026-0001','SGD','A','SGD 1','2026-09-20','Bagian')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara_peserta (timestamp,ba_id,npm,nama_lengkap,blok) VALUES ('2026-09-10T09:00:00','BA-2026-0001','2201010001','Aisyah','A')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jam,sumber) VALUES ('2026-09-11T08:00:00','BA-2026-0002','SGD','A','SGD 1','2026-09-20','','Admin')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin_peserta (timestamp,ba_id,npm,nama_lengkap,blok) VALUES ('2026-09-11T08:00:00','BA-2026-0002','2201010001','Aisyah','A')"
    ).run();

    for (const stmt of statements) await env.DB.prepare(stmt).run();

    expect((await env.DB.prepare('SELECT ba_id FROM berita_acara').first()).ba_id).toBe('BA-PEL-2026-0001');
    expect((await env.DB.prepare('SELECT ba_id FROM berita_acara_peserta').first()).ba_id).toBe('BA-PEL-2026-0001');
    expect((await env.DB.prepare('SELECT ba_id FROM berita_acara_admin').first()).ba_id).toBe('BA-PEN-2026-0002');
    expect((await env.DB.prepare('SELECT ba_id FROM berita_acara_admin_peserta').first()).ba_id).toBe('BA-PEN-2026-0002');
  });

  it('idempoten: nomor yang sudah berawalan PEL/PEN tidak berubah', async () => {
    await env.DB.prepare(
      "INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,sumber) VALUES ('2026-09-10T09:00:00','BA-PEL-2026-0009','SGD','A','SGD 1','2026-09-20','Bagian')"
    ).run();

    for (const stmt of statements) await env.DB.prepare(stmt).run();

    expect((await env.DB.prepare('SELECT ba_id FROM berita_acara').first()).ba_id).toBe('BA-PEL-2026-0009');
  });
});
