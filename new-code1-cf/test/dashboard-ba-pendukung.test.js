import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

async function loadDashboardHtml() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/dashboard.html'));
  expect(res.status).toBe(200);
  return res.text();
}

describe('dashboard BA Pendukung di modal detail', () => {
  it('memuat kartu, pemilih peserta, dan hook aksi', async () => {
    const dashboardHtml = await loadDashboardHtml();
    expect(dashboardHtml).toContain('baPendukung');
    expect(dashboardHtml).toContain('openBaPendukung(');
    expect(dashboardHtml).toContain('tambahPesertaBa(');
    expect(dashboardHtml).toContain('unggahBerkasBa(');
    expect(dashboardHtml).toContain('hapusPesertaBa(');
    expect(dashboardHtml).toContain('regenerateBa(');
    expect(dashboardHtml).toContain('Berita Acara Pendukung');
  });
});
