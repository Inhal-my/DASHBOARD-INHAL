import { describe, it, expect } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { createSession } from '../src/session.js';

describe('audit akses berkas', () => {
  it('mencatat FILE_ACCESS saat admin mengunduh berkas', async () => {
    await env.DB.prepare(
      "INSERT INTO uploads (id, pengajuan_id, kind, file_name, mime_type, size, content, created_at, created_by) " +
      "VALUES ('UPL-audit','INHAL-1','acc','bukti.pdf','application/pdf',5,'aGVsbG8=','2026-10-18T00:00:00','admin')"
    ).run();
    const token = await createSession(env.DB, { role: 'admin', nama: 'Admin Uji', adminId: 1 });

    const res = await SELF.fetch('http://example.com/api/files/UPL-audit?token=' + token);
    expect(res.status).toBe(200);

    const row = await env.DB.prepare(
      "SELECT actor_email, aksi, target FROM audit_log WHERE aksi = 'FILE_ACCESS' ORDER BY id DESC LIMIT 1"
    ).first();
    expect(row.actor_email).toBe('Admin Uji');
    expect(row.target).toBe('UPL-audit');
  });

  it('menolak akses tanpa sesi admin dan tidak menulis audit', async () => {
    await env.DB.prepare(
      "INSERT INTO uploads (id, pengajuan_id, kind, file_name, mime_type, size, content, created_at, created_by) " +
      "VALUES ('UPL-noauth','INHAL-1','acc','bukti.pdf','application/pdf',5,'aGVsbG8=','2026-10-18T00:00:00','admin')"
    ).run();
    const res = await SELF.fetch('http://example.com/api/files/UPL-noauth');
    expect(res.status).toBe(401);
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM audit_log WHERE target = 'UPL-noauth'"
    ).first();
    expect(row.n).toBe(0);
  });
});
