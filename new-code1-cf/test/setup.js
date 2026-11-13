import { beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import schemaSql from '../schema.sql?raw';

const statements = String(schemaSql)
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.replace(/--[^\n]*/g, '').trim());

beforeEach(async () => {
  for (const stmt of statements) {
    await env.DB.prepare(stmt).run();
  }
  const extraDosen = ['dr. Budi', 'Dr. Citra', 'dr. Ani'];
  for (const nama of extraDosen) {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO master_kegiatan (kategori, nilai) VALUES ('Dosen', ?1)"
    ).bind(nama).run();
  }
});
