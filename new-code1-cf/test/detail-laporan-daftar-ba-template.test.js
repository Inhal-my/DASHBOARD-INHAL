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

describe('daftar BA: template', () => {
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

describe('daftar BA: pembersihan dead code', () => {
  it('menghapus computed BA yang tidak dipakai', async () => {
    const html = await loadHtml();
    expect(html).not.toContain('baGroupRows');
    expect(html).not.toContain('baGroupSections');
    expect(html).not.toContain('filteredBaTab');
    expect(html).not.toContain('baGroupGrandTotal');
    expect(html).not.toContain('baGroupBaTotal');
    expect(html).not.toContain('baGroupPesertaTotal');
  });
});

describe('daftar BA: lapisan data', () => {
  it('menyediakan state filter', async () => {
    const html = await loadHtml();
    expect(html).toContain("baListFilter: { bagian: '', blok: '', jenis: '', from: '', to: '', dosen: '', sumber: '', kelengkapan: '', q: '' }");
  });
  it('menyediakan computed dan helper', async () => {
    const html = await loadHtml();
    for (const name of ['daftarBaRows()', 'filteredDaftarBa()', 'daftarBaBagianOptions()',
      'daftarBaBlokOptions()', 'daftarBaJenisOptions()', 'daftarBaSumberOptions()',
      'daftarBaLengkapCount()', 'daftarBaDraftCount()', 'daftarBaUnitCount()', 'daftarBaUnitRows()',
      'baLengkap(', 'baTanggalEfektif(', 'baDaftarItem(']) {
      expect(html).toContain(name);
    }
  });
});

describe('daftar BA: tab & UI', () => {
  it('mendaftarkan tab dan section', async () => {
    const html = await loadHtml();
    expect(html).toContain("key: 'daftarba', label: 'Daftar BA'");
    expect(html).toContain("activeTab === 'daftarba'");
  });
  it('memuat kolom dan filter wajib', async () => {
    const html = await loadHtml();
    for (const s of ['>BA ID</th>', '>Jenis</th>', '>Label</th>', '>Dibuat</th>',
      '>Kelengkapan</th>', '>Berkas</th>', '>Sumber</th>', '>Peserta</th>']) {
      expect(html).toContain(s);
    }
    for (const s of ['baListFilter.bagian', 'baListFilter.blok', 'baListFilter.jenis',
      'baListFilter.from', 'baListFilter.to', 'baListFilter.dosen', 'baListFilter.sumber',
      'baListFilter.kelengkapan', 'baListFilter.q']) {
      expect(html).toContain(s);
    }
  });
});
