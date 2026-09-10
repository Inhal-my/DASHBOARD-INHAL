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
