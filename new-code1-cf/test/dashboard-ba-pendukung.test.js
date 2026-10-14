import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

async function loadDashboardHtml() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/dashboard.html'));
  expect(res.status).toBe(200);
  return res.text();
}

describe('dashboard modal Kelola BA Pendukung', () => {
  it('menyediakan modal, pemilih peserta+berkas, dan hook aksi', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('openKelolaBaPendukung(');
    expect(html).toContain('kbStartBerkas(');
    expect(html).toContain('baAdminAddPesertaBerkas');
    expect(html).toContain('kbRemove(');
    expect(html).toContain('kbRegenerate(');
    expect(html).toContain('Kelola BA Pendukung');
    expect(html).toContain('ref="kbCamera"');
    expect(html).toContain('ref="kbPdf"');
    expect(html).toContain('onKbPdf(');
    expect(html).toContain('onKbPhotos(');
    expect(html).toContain('.max-w-2xl');
    expect(html).toContain('.max-h-\\[60vh\\]');
    expect(html).toContain('refreshBaPendukungIndicators()');
  });
});
