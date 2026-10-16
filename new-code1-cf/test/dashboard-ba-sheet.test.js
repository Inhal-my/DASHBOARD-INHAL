import { env } from 'cloudflare:test';
import { compile } from '@vue/compiler-dom';
import { describe, it, expect } from 'vitest';

function extractAppTemplate(html) {
  const start = html.indexOf('<div id="app"');
  if (start === -1) throw new Error('#app root not found');
  const scriptStart = html.indexOf('<script src="/gs-shim.js"', start);
  const slice = html.slice(start, scriptStart === -1 ? html.length : scriptStart);
  const re = /<div\b|<\/div>/g;
  let depth = 0;
  let end = -1;
  let m;
  while ((m = re.exec(slice))) {
    if (m[0] === '</div>') {
      depth -= 1;
      if (depth === 0) { end = re.lastIndex; break; }
    } else {
      depth += 1;
    }
  }
  if (end === -1) throw new Error('#app root close not found');
  return slice.slice(0, end);
}

function installDocumentStub() {
  if (globalThis.document) return;
  globalThis.document = {
    createElement: () => {
      const el = {
        _html: '',
        set innerHTML(v) { this._html = String(v); },
        get innerHTML() { return this._html; },
        get textContent() { return this._html; },
        get children() {
          const match = this._html.match(/^<div foo="([\s\S]*)">$/);
          const value = match ? match[1] : this._html;
          return [{ getAttribute: () => value }];
        }
      };
      return el;
    }
  };
}

async function loadDashboardHtml() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/dashboard.html'));
  expect(res.status).toBe(200);
  return res.text();
}

describe('dashboard BA sheet template', () => {
  it('compiles without Vue template errors', async () => {
    installDocumentStub();
    const html = await loadDashboardHtml();
    compile(extractAppTemplate(html), {
      onError: (e) => { throw new Error(e.message); },
      onWarn: (w) => { throw new Error('warn: ' + w.message); }
    });
  });

  it('menyediakan state baSheet dengan default pelaksanaan', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('baSheet: {');
    expect(html).toContain("type: 'pelaksanaan'");
    expect(html).toContain("level: 'blok'");
  });

  it('menyediakan tab tergeser dan aksi tingkat sheet', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('Buat Berita Acara');
    expect(html).toContain("baSheetSetType('pendukung')");
    expect(html).toContain("baSheetSetType('pelaksanaan')");
    expect(html).toContain('baSheetOpenKegiatan(g.blok)');
    expect(html).toContain('baSheetBack()');
    expect(html).toContain('baSheetClose()');
  });

  it('menyediakan computed dan helper pencarian lintas blok', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('baSheetBlokGroups()');
    expect(html).toContain('baSheetBlokUnits()');
    expect(html).toContain('baSheetSearchResults()');
    expect(html).toContain('unitMatchesQuery(u, q)');
    expect(html).toContain('baSheetPickKegiatan(u)');
  });

  it('mengarahkan header dan FAB ke pembuka sheet', async () => {
    const html = await loadDashboardHtml();
    expect(html).not.toContain('@click="openKelolaBaPicker()"');
    expect(html).toContain('openBaSheet()');
  });
});
