import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import migrationSql from '../migrations/2026-10-21-poin6-backfill-mahasiswa-blok.sql?raw';

function statements() {
  return String(migrationSql)
    .split(';')
    .map((s) => s.replace(/--[^\n]*/g, '').trim())
    .filter(Boolean);
}

describe('migrasi backfill blok mahasiswa', () => {
  it('mengisi blok hanya bila NPM punya satu nilai blok', async () => {
    await env.DB.prepare("INSERT INTO mahasiswa (npm, nama_lengkap, blok) VALUES ('9900000001','Satu Blok','')").run();
    await env.DB.prepare("INSERT INTO mahasiswa (npm, nama_lengkap, blok) VALUES ('9900000002','Dua Blok','')").run();
    await env.DB.prepare("INSERT INTO mahasiswa (npm, nama_lengkap, blok) VALUES ('9900000003','Sudah Ada','B')").run();
    await env.DB.prepare("INSERT INTO pengajuan (id_pengajuan, npm, blok) VALUES ('P1','9900000001','A')").run();
    await env.DB.prepare("INSERT INTO pengajuan (id_pengajuan, npm, blok) VALUES ('P2','9900000002','A')").run();
    await env.DB.prepare("INSERT INTO pengajuan (id_pengajuan, npm, blok) VALUES ('P3','9900000002','C')").run();
    await env.DB.prepare("INSERT INTO pengajuan (id_pengajuan, npm, blok) VALUES ('P4','9900000003','C')").run();

    for (const stmt of statements()) await env.DB.prepare(stmt).run();

    const satu = await env.DB.prepare("SELECT blok FROM mahasiswa WHERE npm = '9900000001'").first();
    const dua = await env.DB.prepare("SELECT blok FROM mahasiswa WHERE npm = '9900000002'").first();
    const sudah = await env.DB.prepare("SELECT blok FROM mahasiswa WHERE npm = '9900000003'").first();
    expect(satu.blok).toBe('A');
    expect(dua.blok).toBe('');
    expect(sudah.blok).toBe('B');
  });
});
