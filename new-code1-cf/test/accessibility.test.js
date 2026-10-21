import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

const pages = ['index.html', 'dashboard.html', 'bagian.html', 'detail-laporan.html', 'portal.html'];

async function loadPage(name) {
  const res = await env.ASSETS.fetch(new Request(`https://example.com/${name}`));
  expect(res.status, name).toBe(200);
  return res.text();
}

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((m) => m[0]);
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match ? match[1] : null;
}

describe('aksesibilitas halaman publik', () => {
  it('memakai bahasa, viewport, dan alt gambar yang benar', async () => {
    for (const name of pages) {
      const html = await loadPage(name);
      expect(html, name).toContain('<html lang="id">');
      expect(html, name).toContain('name="viewport"');
      for (const tag of tags(html, 'img')) {
        expect(attr(tag, 'alt') !== null || /:alt=/.test(tag), `${name}: ${tag}`).toBe(true);
      }
    }
  });

  it('menghubungkan label dengan kontrol formulir pendaftaran', async () => {
    for (const name of ['index.html', 'portal.html']) {
      const html = await loadPage(name);
      const ids = new Set(tags(html, 'input').map((t) => attr(t, 'id')).filter(Boolean));
      const dynamicIds = new Set();
      for (const tag of [...tags(html, 'input'), ...tags(html, 'select'), ...tags(html, 'textarea')]) {
        const id = attr(tag, 'id');
        const boundId = tag.match(/:id="'([a-zA-Z]+)-' \+ i"/);
        if (boundId) dynamicIds.add(boundId[1]);
        expect(id !== null || boundId !== null, `${name} kontrol tanpa id: ${tag}`).toBe(true);
        if (id) ids.add(id);
      }
      for (const tag of tags(html, 'label')) {
        const target = attr(tag, 'for');
        const bound = tag.match(/:for="'([a-zA-Z]+)-' \+ i"/);
        if (bound) {
          expect(dynamicIds.has(bound[1]), `${name} label dinamis tanpa kontrol: ${tag}`).toBe(true);
        } else if (target) {
          expect(ids.has(target), `${name} label for="${target}" tanpa kontrol`).toBe(true);
        } else {
          throw new Error(`${name} label tanpa for: ${tag}`);
        }
      }
      expect(html).not.toMatch(/\balert\(/);
    }
  });

  it('memberi nama aksesibel pada dialog dan input login', async () => {
    for (const name of pages) {
      const html = await loadPage(name);
      for (const tag of tags(html, 'div')) {
        if (attr(tag, 'role') !== 'dialog') continue;
        const labelled = attr(tag, 'aria-label') || attr(tag, 'aria-labelledby');
        expect(labelled, `${name}: ${tag}`).toBeTruthy();
      }
    }

    const dashboard = await loadPage('dashboard.html');
    expect(dashboard).toContain('for="adminPassword"');
    expect(dashboard).toContain('id="adminPassword"');
    expect(dashboard).toContain('for="adminMfaCode"');
    expect(dashboard).toContain('id="adminMfaCode"');
    expect(dashboard).toContain('id="adminLoginError" role="alert"');

    const bagian = await loadPage('bagian.html');
    expect(bagian).toContain('for="bagianPassword"');
    expect(bagian).toContain('id="bagianPassword"');
    expect(bagian).toContain('id="bagianLoginError" role="alert"');
  });

  it('mengumumkan status loading, error, dan toast', async () => {
    const portal = await loadPage('index.html');
    expect(portal).toContain('role="status" aria-live="polite"');
    expect(portal).toContain(':role="result.success ? \'status\' : \'alert\'"');

    const dashboard = await loadPage('dashboard.html');
    expect(dashboard).toContain('aria-live="polite" aria-atomic="true"');

    const bagian = await loadPage('bagian.html');
    expect(bagian).toContain('aria-live="polite" aria-atomic="true"');

    const laporan = await loadPage('detail-laporan.html');
    expect(laporan).toContain('aria-live="polite" aria-atomic="true"');
    expect(laporan).toContain('aria-labelledby="riwayatTitle"');
  });
});
