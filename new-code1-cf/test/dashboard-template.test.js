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

describe('dashboard template', () => {
  it('compiles without Vue template errors', async () => {
    installDocumentStub();
    const html = await loadDashboardHtml();
    const template = extractAppTemplate(html);
    const errors = [];
    compile(template, {
      onError: (e) => errors.push(e.message),
      onWarn: (w) => errors.push('warn: ' + w.message)
    });
    expect(errors).toEqual([]);
  });

  it('contains the unified Berita Acara process markers', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('Dua tahap: unggah BA Pendukung');
    expect(html).toContain('Peta Kelengkapan Bagian × Blok');
    expect(html).toContain('Unggah BA Pendukung');
    expect(html).toContain('Unggah BA Pelaksanaan');
    expect(html).toContain('Belum Pendukung');
    expect(html).toContain('Belum Pelaksanaan');
    expect(html).toContain('xlsx@0.18.5');
  });

  it('removes the header Pelaksanaan button and uses emerald for the row action', async () => {
    const html = await loadDashboardHtml();
    expect(html).not.toContain('<i class="bi bi-journal-check"></i> Unggah BA Pelaksanaan');
    expect(html).toContain('class="btn-emerald !px-2 !py-1 text-[11px]" @click="openPelaksanaanPanel(r)"');
    expect(html).toContain('id="bab-panel"');
  });

  it('has a single Berita Acara tab without leftover menus', async () => {
    const html = await loadDashboardHtml();
    expect(html).not.toContain("tab==='baBagian'");
    expect(html).not.toContain("tab==='bagian'");
    expect(html).not.toContain('Audit kelengkapan berita acara per kegiatan');
    expect(html).not.toContain('Isi berita acara atas nama bagian');
    expect((html.match(/<section v-if="tab==='ba'">/g) || []).length).toBe(1);
    expect(html).toContain('v-if="tab===\'ba\' && bab.showPanel"');
    expect(html).toContain('key: \'ba\', icon: \'bi-file-earmark-pdf\', label: \'Berita Acara\'');
    expect(html).not.toContain("label: 'Laporan Bagian'");
    expect(html).not.toContain("label: 'Berita Acara Bagian'");
  });
});
