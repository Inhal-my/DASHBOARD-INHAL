import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import migrationSql from '../migrations/2026-11-09-biaya-detail-inhal.sql?raw';

const statements = String(migrationSql)
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.replace(/--[^\n]*/g, '').trim());

async function runMigration() {
  for (const stmt of statements) {
    await env.DB.prepare(stmt).run();
  }
}

async function masterBiaya() {
  return (await env.DB.prepare('SELECT kegiatan, biaya FROM master_biaya ORDER BY kegiatan').all()).results || [];
}

describe('migrasi biaya berbasis Detail', () => {
  beforeEach(async () => {
    await env.DB.prepare('DELETE FROM master_biaya').run();
    await env.DB.prepare('DELETE FROM master_kegiatan').run();
  });

  it('mengganti Postest menjadi PostTest', async () => {
    await env.DB.prepare("INSERT INTO master_biaya (kegiatan,biaya) VALUES ('Postest','Rp. 250.000')").run();
    await env.DB.prepare("INSERT INTO master_biaya (kegiatan,biaya) VALUES ('Gratis Postest','Rp. 0')").run();
    await runMigration();
    const names = (await masterBiaya()).map((r) => r.kegiatan);
    expect(names).toContain('PostTest');
    expect(names).toContain('Gratis PostTest');
    expect(names).not.toContain('Postest');
    expect(names).not.toContain('Gratis Postest');
  });

  it('tidak menimpa bila PostTest sudah ada', async () => {
    await env.DB.prepare("INSERT INTO master_biaya (kegiatan,biaya) VALUES ('Postest','Rp. 100.000')").run();
    await env.DB.prepare("INSERT INTO master_biaya (kegiatan,biaya) VALUES ('PostTest','Rp. 250.000')").run();
    await runMigration();
    const rows = await masterBiaya();
    const post = rows.filter((r) => String(r.kegiatan).toLowerCase() === 'posttest');
    expect(post).toHaveLength(1);
    expect(post[0].biaya).toBe('Rp. 250.000');
  });

  it('menambahkan opsi Detail KKD/SGD Inhal tanpa duplikat', async () => {
    await env.DB.prepare("INSERT INTO master_kegiatan (kategori,nilai) VALUES ('Detail KKD','Inhal')").run();
    await runMigration();
    await runMigration();
    const rows = (await env.DB.prepare(
      "SELECT kategori, nilai FROM master_kegiatan WHERE lower(trim(kategori)) IN ('detail kkd','detail sgd')"
    ).all()).results || [];
    const pairs = rows.map((r) => r.kategori + ':' + r.nilai).sort();
    expect(pairs).toEqual(['Detail KKD:Inhal', 'Detail SGD:Inhal']);
  });
});
