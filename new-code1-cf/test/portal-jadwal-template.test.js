import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

async function loadPortalHtml() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/portal.html'));
  return res.text();
}

describe('guard template portal jadwal', () => {
  it('menambahkan langkah Jadwal Pelaksanaan', async () => {
    const html = await loadPortalHtml();
    expect(html).toContain('Jadwal Pelaksanaan');
    expect(html).toContain('detailItem.jadwal');
    expect(html).toContain('Belum dijadwalkan');
  });
});
