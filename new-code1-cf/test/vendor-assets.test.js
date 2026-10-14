import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

const PAGES = ['dashboard.html', 'detail-laporan.html', 'portal.html', 'index.html', 'bagian.html'];

async function loadHtml(name) {
  const res = await env.ASSETS.fetch(new Request(`https://example.com/${name}`));
  expect(res.status).toBe(200);
  return res.text();
}

describe('aset runtime di-vendor lokal (tanpa CDN)', () => {
  for (const name of PAGES) {
    it(`${name}: memakai /vendor untuk Vue & Bootstrap Icons`, async () => {
      const html = await loadHtml(name);
      expect(html).toContain('/vendor/vue.global.prod.js');
      expect(html).toContain('/vendor/bootstrap-icons.min.css');
      expect(html).not.toContain('cdn.jsdelivr.net/npm/vue@');
      expect(html).not.toContain('cdn.jsdelivr.net/npm/bootstrap-icons');
    });
  }

  it('berkas vendor tersedia di aset', async () => {
    for (const path of ['/vendor/vue.global.prod.js', '/vendor/bootstrap-icons.min.css', '/vendor/fonts/bootstrap-icons.woff2', '/vendor/xlsx.full.min.js', '/vendor/pdf.min.js', '/vendor/pdf.worker.min.js']) {
      const res = await env.ASSETS.fetch(new Request(`https://example.com${path}`));
      expect(res.status, path).toBe(200);
    }
  });

  for (const name of ['dashboard.html', 'detail-laporan.html']) {
    it(`${name}: xlsx lokal, bukan CDN`, async () => {
      const html = await loadHtml(name);
      expect(html).toContain('/vendor/xlsx.full.min.js');
      expect(html).not.toContain('cdn.jsdelivr.net/npm/xlsx');
    });
  }

  it('portal.html: pdf.js lokal, bukan CDN', async () => {
    const html = await loadHtml('portal.html');
    expect(html).toContain('/vendor/pdf.min.js');
    expect(html).toContain('/vendor/pdf.worker.min.js');
    expect(html).not.toContain('cdnjs.cloudflare.com');
  });
});
