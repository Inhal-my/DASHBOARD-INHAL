import { describe, it, expect } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { createSession } from '../src/session.js';
import { dispatchRpc } from '../src/rpc.js';
import { AUTH_ERROR } from '../src/session.js';

function unzipStore(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const files = {};
  let i = 0;
  while (i + 30 <= u8.length) {
    const sig = view.getUint32(i, true);
    if (sig !== 0x04034b50) break;
    const method = view.getUint16(i + 8, true);
    const compSize = view.getUint32(i + 18, true);
    const nameLen = view.getUint16(i + 26, true);
    const extraLen = view.getUint16(i + 28, true);
    const name = new TextDecoder().decode(u8.slice(i + 30, i + 30 + nameLen));
    const start = i + 30 + nameLen + extraLen;
    const data = u8.slice(start, start + compSize);
    if (method !== 0) throw new Error('compressed: ' + name);
    files[name] = new TextDecoder().decode(data);
    i = start + compSize;
  }
  return files;
}

describe('POST /api/database-export', () => {
  it('rejects missing token', async () => {
    const res = await SELF.fetch('http://example.com/api/database-export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ success: false, message: AUTH_ERROR });
  });

  it('rejects a bagian session', async () => {
    const token = await createSession(env.DB, { role: 'bagian', nama: 'Bagian', kategoris: ['SGD'] });
    const res = await SELF.fetch('http://example.com/api/database-export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ success: false, message: AUTH_ERROR });
  });

  it('returns xlsx for an admin with all user tables and secrets', async () => {
    const token = await createSession(env.DB, { role: 'admin', nama: 'Admin' });
    await env.DB.prepare("INSERT INTO admin (password, nama) VALUES ('pbkdf2$secret','Admin Utama')").run();
    await env.DB.prepare(
      "INSERT INTO uploads (id, pengajuan_id, kind, file_name, mime_type, size, content, created_at, created_by) VALUES ('UPL-1','INHAL-1','acc','a.pdf','application/pdf',4,'aGVsbG8=','2026-09-18T00:00:00','admin')"
    ).run();
    const res = await SELF.fetch('http://example.com/api/database-export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('spreadsheetml');
    const disp = res.headers.get('content-disposition') || '';
    expect(disp).toMatch(/attachment; filename="inhal-database-\d{4}-\d{2}-\d{2}\.xlsx"/);
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(String.fromCharCode(buf[0], buf[1])).toBe('PK');
    const files = unzipStore(buf);
    const wb = files['xl/workbook.xml'];
    expect(wb).toContain('name="mahasiswa"');
    expect(wb).toContain('name="admin"');
    expect(wb).toContain('name="uploads"');
    expect(wb).toContain('name="sessions"');
    expect(wb).not.toContain('sqlite_');
    const xmlBlob = Object.values(files).join('\n');
    expect(xmlBlob).toContain('Aisyah Putri');
    expect(xmlBlob).toContain('pbkdf2$secret');
    expect(xmlBlob).toContain('aGVsbG8=');
    expect(xmlBlob).toContain(token);
  });
});

describe('rpc downloadDatabase', () => {
  it('is not registered as an rpc handler', async () => {
    const res = await dispatchRpc(env.DB, 'downloadDatabase', []);
    expect(res).toEqual({ success: false, message: 'Fitur downloadDatabase belum tersedia pada tahap ini.' });
  });
});
