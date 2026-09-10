import { describe, it, expect } from 'vitest';
import { env, SELF } from 'cloudflare:test';

describe('scaffold', () => {
  it('responds ok on health', async () => {
    const res = await SELF.fetch('http://example.com/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('applies schema and seed to D1', async () => {
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM mahasiswa').first();
    expect(row.n).toBe(3);
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

  it('stubs the upload endpoint', async () => {
    const res = await SELF.fetch('http://example.com/api/portal/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('tahap berikutnya');
  });
});
