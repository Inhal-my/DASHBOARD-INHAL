import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

async function loadDashboardHtml() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/dashboard.html'));
  expect(res.status).toBe(200);
  return res.text();
}

describe('dashboard tab manual: kegiatan yang sama', () => {
  it('menampilkan panel peserta sekegiatan dan aksi kelola BA', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('manualSameKegiatan');
    expect(html).toContain('manualAddAnother()');
    expect(html).toContain('Kegiatan ini sudah punya');
    expect(html).toContain('openKelolaBaPendukung(m.idPengajuan)');
  });
});
