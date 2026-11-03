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
    expect(html).toContain("baListFilter: { jenis: '', dosen: '', sumber: '', kelengkapan: '', sesi: '' }");
  });
  it('menyediakan computed dan helper', async () => {
    const html = await loadHtml();
    for (const name of ['daftarBaRows()', 'filteredDaftarBa()',
      'daftarBaJenisOptions()', 'daftarBaSumberOptions()',
      'daftarBaLengkapCount()', 'daftarBaDraftCount()', 'daftarBaUnitCount()', 'daftarBaUnitRows()',
      'baLengkap(', 'baTanggalEfektif(', 'baDaftarItem(', 'baAuditRows()', 'baAuditSummary()', 'baAuditExportRows()', 'baAuditSessions(']) {
      expect(html).toContain(name);
    }
  });
});

describe('daftar BA: tab & UI', () => {
  it('menyatukan Daftar BA sebagai lapis dalam tab Berita Acara', async () => {
    const html = await loadHtml();
    expect(html).not.toContain("key: 'daftarba'");
    expect(html).not.toContain("activeTab === 'daftarba'");
    expect(html).toContain("baLayer: 'kegiatan'");
    expect(html).toContain("activeTab === 'ba' && baLayer === 'berkas'");
    expect(html).toContain("baLayer = 'berkas'");
  });
  it('memuat kolom dan filter wajib', async () => {
    const html = await loadHtml();
    for (const s of ['>BA ID</th>', '>Jenis</th>', '>Label</th>', '>Dibuat</th>',
      '>Kelengkapan</th>', '>Berkas</th>', '>Sumber</th>', '>Peserta</th>']) {
      expect(html).toContain(s);
    }
    for (const s of ['baListFilter.jenis',
      'baListFilter.dosen', 'baListFilter.sumber', 'baListFilter.kelengkapan']) {
      expect(html).toContain(s);
    }
    for (const s of ['baListFilter.bagian', 'baListFilter.blok', 'baListFilter.from', 'baListFilter.to', 'baListFilter.q']) {
      expect(html).not.toContain(s);
    }
    const start = html.indexOf('filteredDaftarBa()');
    const end = html.indexOf('daftarBaJenisOptions()', start);
    const block = html.slice(start, end);
    for (const s of ['this.filters.from', 'this.filters.to', 'this.filters.blok', 'this.filters.search', 'this.baFilter.bagian']) {
      expect(block).toContain(s);
    }
  });
});

describe('daftar BA: indikator kelengkapan', () => {
  it('menampilkan rasio masuk BA', async () => {
    const html = await loadHtml();
    expect(html).toContain('masuk BA');
    expect(html).toContain('r.counts.final');
  });
  it('menampilkan badge Lengkap/Draft per BA', async () => {
    const html = await loadHtml();
    expect(html).toContain("baLengkap(b, 'Pendukung')");
    expect(html).toContain("baLengkap(b, 'Pelaksanaan')");
  });
});

describe('daftar BA: export xlsx', () => {
  it('menyediakan handler dan dua sheet', async () => {
    const html = await loadHtml();
    expect(html).toContain('exportDaftarBa()');
    expect(html).toContain("'Daftar BA'");
    expect(html).toContain("'Rekap per Unit'");
    expect(html).toContain('Export XLSX');
  });

  it('helper sesi berparameter berada di methods, bukan computed', async () => {
    const res = await env.ASSETS.fetch(new Request('https://example.com/detail-laporan.html'));
    const html = await res.text();
    const computed = html.slice(html.lastIndexOf('computed: {'), html.lastIndexOf('methods: {'));
    const methods = html.slice(html.lastIndexOf('methods: {'));
    expect(computed).not.toMatch(/baAuditSessions\(r\)\s*\{/);
    expect(computed).not.toMatch(/baAuditSessionFor\(unit, baId\)\s*\{/);
    expect(methods).toMatch(/baAuditSessions\(r\)\s*\{/);
    expect(methods).toMatch(/baAuditSessionFor\(unit, baId\)\s*\{/);
  });
});
