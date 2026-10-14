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
    for (const path of ['/vendor/vue.global.prod.js', '/vendor/bootstrap-icons.min.css', '/vendor/fonts/bootstrap-icons.woff2']) {
      const res = await env.ASSETS.fetch(new Request(`https://example.com${path}`));
      expect(res.status, path).toBe(200);
    }
  });
});
