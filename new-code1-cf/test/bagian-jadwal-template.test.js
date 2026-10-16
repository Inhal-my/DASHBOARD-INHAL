import { env } from 'cloudflare:test';
import { compile } from '@vue/compiler-dom';
import { describe, it, expect } from 'vitest';

function extractAppTemplate(html) {
  const start = html.indexOf('<div id="app"');
  const scriptStart = html.indexOf('<script src="/gs-shim.js"', start);
  const slice = html.slice(start, scriptStart === -1 ? html.length : scriptStart);
  const re = /<div\b|<\/div>/g;
  let depth = 0, end = -1, m;
  while ((m = re.exec(slice))) {
    if (m[0] === '</div>') { depth -= 1; if (depth === 0) { end = re.lastIndex; break; } }
    else depth += 1;
  }
  return slice.slice(0, end);
}
function installDocumentStub() {
  if (globalThis.document) return;
  globalThis.document = {
    createElement: () => ({ _html: '', set innerHTML(v) { this._html = String(v); }, get innerHTML() { return this._html; }, get textContent() { return this._html; }, get children() { const match = this._html.match(/^<div foo="([\s\S]*)">$/); const value = match ? match[1] : this._html; return [{ getAttribute: () => value }]; } })
  };
}
async function loadBagianHtml() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/bagian.html'));
  return res.text();
}

describe('bagian template jadwal', () => {
  it('compiles without Vue template errors', async () => {
    installDocumentStub();
    const html = await loadBagianHtml();
    const errors = [];
    compile(extractAppTemplate(html), { onError: (e) => errors.push(e.message), onWarn: (w) => errors.push('warn: ' + w.message) });
    expect(errors).toEqual([]);
  });

  it('memiliki tab Jadwal / Berita Acara / Riwayat', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('activeTab');
    expect(html).toContain('setTab(\'jadwal\')');
    expect(html).toContain('setTab(\'ba\')');
    expect(html).toContain('setTab(\'riwayat\')');
  });

  it('memiliki alur jadwal', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('Buat Jadwal');
    expect(html).toContain('saveJadwalPelaksanaan');
    expect(html).toContain('cancelJadwalPelaksanaan');
    expect(html).toContain('jadwal.dosen');
    expect(html).toContain('jadwal.jam');
  });

  it('tetap mempertahankan fitur produksi Daftar Peserta', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('Daftar Peserta');
    expect(html).toContain('filteredRows');
    expect(html).toContain('openBaPicker');
  });

  it('memiliki mode BA dari jadwal, draft, dan riwayat', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('ba.jadwalId');
    expect(html).toContain('lengkapiBeritaAcaraBagian');
    expect(html).toContain('draftBaList');
    expect(html).toContain('riwayatBaList');
    expect(html).toContain('ba.dosen');
    expect(html).toContain('ba.jam');
  });

  it('mengikat this pada callback computed jadwal', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('g.key === this.jadwal.kegiatanKey; }.bind(this)');
  });

  it('menyediakan picker Dosen searchable di semua field Dosen', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('dosenOptions');
    expect(html).toContain('dosenSuggest(');
    expect(html).toContain('pickDosen(');
    expect(html).toContain('dosenPick.jadwal');
    expect(html).toContain('dosenPick.ba');
    expect(html).toContain('dosenPick.lengkapi');
  });
});
