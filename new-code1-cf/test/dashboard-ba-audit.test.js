import { env } from 'cloudflare:test';
import { compile } from '@vue/compiler-dom';
import { describe, it, expect } from 'vitest';

async function loadHtml() {
  const res = await env.ASSETS.fetch(new Request('http://local/dashboard.html'));
  return res.text();
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

describe('dashboard pemeriksaan BA Pelaksanaan', () => {
  it('template tetap valid', async () => {
    installDocumentStub();
    const html = await loadHtml();
    const errors = [];
    compile(extractAppTemplate(html), { onError: (e) => errors.push(e) });
    expect(errors).toEqual([]);
  });

  it('menyediakan panel, filter, dan ekspor pemeriksaan', async () => {
    const html = await loadHtml();
    for (const s of ['Pemeriksaan BA Pelaksanaan', 'bagianAuditRows()', 'bagianAuditSummary()',
      'bagianAuditExportRows()', 'exportBagianAudit', "setBagianChip('multi')", 'Ekspor Pemeriksaan']) {
      expect(html).toContain(s);
    }
  });

  it('menjelaskan unggahan tambahan sebagai multi-sesi tanpa memblokir', async () => {
    const html = await loadHtml();
    expect(html).toContain('sebagai sesi tambahan (multi-sesi)');
    expect(html).not.toContain('Upload ini akan menambah BA baru.');
  });

  it('menghitung sesi berjalan dan menampilkan peringatan sesi berikutnya', async () => {
    const html = await loadHtml();
    expect(html).toContain('babSesiCount() {');
    expect(html).toContain('Kegiatan ini sudah memiliki {{ babSesiCount }} sesi. Unggahan ini menjadi sesi {{ babSesiCount + 1 }}.');
    expect(html).toContain('v-if="babSesiCount"');
  });
});
