import { describe, it, expect, vi, afterEach } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import app from '../src/index.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('scaffold', () => {
  it('responds ok on health after checking the database', async () => {
    const res = await SELF.fetch('http://example.com/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.db).toBe('ok');
    expect(typeof body.latencyMs).toBe('number');
    expect(Number.isNaN(Date.parse(body.ts))).toBe(false);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });

  it('returns 503 when the database check fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const brokenEnv = { DB: { prepare() { throw new Error('db down'); } } };
    const res = await app.request('http://example.com/api/health', {}, brokenEnv);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, db: 'error' });
    const log = JSON.parse(spy.mock.calls[0][0]);
    expect(log.event).toBe('health_check_failed');
    expect(log.error.message).toBe('db down');
  });

  it('mempertahankan x-request-id dari klien', async () => {
    const res = await SELF.fetch('http://example.com/api/health', {
      headers: { 'x-request-id': 'req-123' }
    });
    expect(res.headers.get('x-request-id')).toBe('req-123');
  });

  it('applies schema and seed to D1', async () => {
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM mahasiswa').first();
    expect(row.n).toBe(3);
  });
});

describe('portal entry redirect', () => {
  it('redirects / to /portal', async () => {
    const res = await app.request('http://example.com/', { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/portal');
  });

  it('redirects /index.html to /portal', async () => {
    const res = await app.request('http://example.com/index.html', { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/portal');
  });
});

describe('read endpoints', () => {
  it('returns registration options', async () => {
    const res = await SELF.fetch('http://example.com/api/registration-options');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ujian).toEqual(['UAS', 'UTS']);
    expect(body.lab).toEqual(['Lab Anatomi']);
    expect(body.buktiMode).toBe('strict');
    expect(body).toHaveProperty('detailSgd');
    expect(body).toHaveProperty('detailKkd');
    expect(body).toHaveProperty('dosen');
  });

  it('returns student name as a JSON string', async () => {
    const res = await SELF.fetch('http://example.com/api/mahasiswa/2201010001');
    expect(res.status).toBe(200);
    expect(await res.json()).toBe('Aisyah Putri');
  });

  it('returns empty string for unknown npm', async () => {
    const res = await SELF.fetch('http://example.com/api/mahasiswa/999');
    expect(await res.json()).toBe('');
  });
});

describe('portal endpoints', () => {
  it('returns portal data for a known npm', async () => {
    const res = await SELF.fetch('http://example.com/api/portal/2201010001');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nama).toBe('Aisyah Putri');
    expect(Array.isArray(body.history)).toBe(true);
    expect(body.buktiMode).toBe('strict');
  });

  it('returns an error object for an unknown npm', async () => {
    const res = await SELF.fetch('http://example.com/api/portal/9999999999');
    expect(res.status).toBe(200);
    expect(typeof (await res.json()).error).toBe('string');
  });

  it('rejects an upload without an id pengajuan', async () => {
    const res = await SELF.fetch('http://example.com/api/portal/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('ID Pengajuan');
  });
});

describe('surat keterangan upload', () => {
  const suratBody = {
    npm: '2201010002', namaLengkap: 'Budi Santoso', email: 'budi@contoh.com',
    noHp: '08123456789', blok: 'B', jenisKegiatan: 'Ujian',
    detailKegiatan: 'UAS', tanggalKegiatan: '2026-09-21',
    fileSurat: { data: 'aGVsbG8=', mimeType: 'application/pdf', name: 'surat.pdf' }
  };

  it('rejects a surat upload when the drive bridge is not configured', async () => {
    const res = await SELF.fetch('http://example.com/api/pengajuan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(suratBody)
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('belum dikonfigurasi');
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM pengajuan WHERE npm = ?1').bind('2201010002').first();
    expect(n.n).toBe(0);
  });

  it('rejects an oversize surat upload and stores nothing', async () => {
    const res = await SELF.fetch('http://example.com/api/pengajuan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...suratBody, fileSurat: { data: 'A'.repeat(7_500_000), mimeType: 'application/pdf', name: 'big.pdf' } })
    });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain('maksimal');
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM pengajuan WHERE npm = ?1').bind('2201010002').first();
    expect(n.n).toBe(0);
  });

  it('returns 404 for an unknown file id', async () => {
    const res = await SELF.fetch('http://example.com/api/files/UPL-nope');
    expect(res.status).toBe(404);
  });
});
