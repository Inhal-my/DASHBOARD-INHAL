import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import migrationSql from '../migrations/2026-09-15-ba-kegiatan-key-dash.sql?raw';
import { createSession } from '../src/session.js';
import { getLaporanBootstrap } from '../src/read/laporan.js';

const statements = String(migrationSql)
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

describe('migrasi kegiatan_key tanda hubung', () => {
  it('menyatukan em-dash menjadi tanda hubung agar BA menempel ke unit', async () => {
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','SGD','Diterima')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','SGD','SGD 1','Remediasi','2026-09-20','')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara_admin (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jam,sumber,kegiatan_key) VALUES ('2026-09-11T08:00:00','BA-2026-0001','SGD','A','SGD 1 — Remediasi','2026-09-20','','Admin','sgd|a|sgd 1 — remediasi')"
    ).run();

    for (const stmt of statements) await env.DB.prepare(stmt).run();

    const row = await env.DB.prepare('SELECT kegiatan_key FROM berita_acara_admin').first();
    expect(row.kegiatan_key).toBe('sgd|a|sgd 1 - remediasi');

    const token = await createSession(env.DB, { role: 'admin', nama: 'Admin' });
    const data = await getLaporanBootstrap(env.DB, { token });
    const unit = data.kegiatan.find((u) => u.key === 'sgd|a|sgd 1 - remediasi');
    expect(unit).toBeTruthy();
    expect(unit.baPendukung).toHaveLength(1);
    expect(unit.progress.pendukung).toBe('all');
  });
});
