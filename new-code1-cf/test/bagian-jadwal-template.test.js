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

  it('memiliki menu Jadwal / Berita Acara / Riwayat', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('activeTab');
    expect(html).toContain("label: 'Jadwal'");
    expect(html).toContain("label: 'Berita Acara'");
    expect(html).toContain("label: 'Riwayat'");
  });

  it('memiliki alur jadwal', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('Buat Jadwal');
    expect(html).toContain('saveJadwalPelaksanaan');
    expect(html).toContain('cancelJadwalPelaksanaan');
    expect(html).toContain('jadwal.dosen');
    expect(html).toContain('jadwal.jam');
  });

  it('mengganti Daftar Peserta dengan workspace empat menu', async () => {
    const html = await loadBagianHtml();
    expect(html).not.toContain('Daftar Peserta');
    expect(html).toContain('openBaPicker');
    expect(html).toContain("label: 'Ringkasan'");
    expect(html).toContain('class="workspace"');
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

  it('memakai helper jadwalFormGroup untuk form jadwal', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('jadwalFormGroup');
    expect(html).toContain('jadwalPendingGroups');
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
