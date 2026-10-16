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
    if (m[0] === '</div>') { depth -= 1; if (depth === 0) { end = re.lastIndex; break; } }
    else depth += 1;
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

async function loadHtml() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/detail-laporan.html'));
  expect(res.status).toBe(200);
  return res.text();
}

describe('jadwal realisasi: template', () => {
  it('compiles without Vue template errors', async () => {
    installDocumentStub();
    const html = await loadHtml();
    const errors = [];
    compile(extractAppTemplate(html), {
      onError: (e) => errors.push(e.message),
      onWarn: (w) => errors.push('warn: ' + w.message)
    });
    expect(errors).toEqual([]);
  });
});

describe('jadwal realisasi: lapisan data', () => {
  it('menyediakan state jadwal & filter', async () => {
    const html = await loadHtml();
    expect(html).toContain('jadwal: [],');
    expect(html).toContain("jadwalFilter: { bagian: '', blok: '', from: '', to: '', status: '', q: '' }");
    expect(html).toContain('this.jadwal = data.jadwal || []');
  });
  it('menyediakan computed kunci', async () => {
    const html = await loadHtml();
    for (const name of ['baPelaksanaanIndex()', 'jadwalRealisasiRows()', 'jadwalExtraRows()',
      'jadwalRealisasiAll()', 'jadwalRealisasiFiltered()', 'jadwalBagianOptions()',
      'jadwalBlokOptions()', 'jadwalStatusOptions()', 'jadwalTotalCount()',
      'jadwalSesuaiCount()', 'jadwalBelumCount()', 'jadwalExtraCount()']) {
      expect(html).toContain(name);
    }
  });
});

describe('jadwal realisasi: tab & UI', () => {
  it('mendaftarkan tab dan section', async () => {
    const html = await loadHtml();
    expect(html).toContain("key: 'jadwal', label: 'Jadwal vs Realisasi'");
    expect(html).toContain("activeTab === 'jadwal'");
  });
  it('memuat kolom, filter, dan badge status', async () => {
    const html = await loadHtml();
    for (const s of ['>Jadwal</th>', '>Dosen Jadwal</th>', '>Peserta Jadwal</th>',
      '>Realisasi</th>', '>Dosen Realisasi</th>', '>Peserta BA</th>', '>Status</th>']) {
      expect(html).toContain(s);
    }
    for (const s of ['jadwalFilter.bagian', 'jadwalFilter.blok', 'jadwalFilter.from',
      'jadwalFilter.to', 'jadwalFilter.status', 'jadwalFilter.q']) {
      expect(html).toContain(s);
    }
    expect(html).toContain('Sesuai');
    expect(html).toContain('Belum');
    expect(html).toContain('Extra');
  });
});
