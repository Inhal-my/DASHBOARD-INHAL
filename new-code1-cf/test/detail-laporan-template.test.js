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

async function loadHtml() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/detail-laporan.html'));
  expect(res.status).toBe(200);
  return res.text();
}

function cssSelectors(html) {
  const css = (html.match(/<style[^>]*>[\s\S]*?<\/style>/g) || [])
    .map((block) => block.replace(/<\/?style[^>]*>/g, ''))
    .join('\n');
  const set = new Set();
  const re = /([^{}]+)\{/g;
  let m;
  while ((m = re.exec(css))) m[1].split(',').forEach((sel) => set.add(sel.trim()));
  return set;
}

describe('detail-laporan template', () => {
  it('compiles without Vue template errors', async () => {
    installDocumentStub();
    const html = await loadHtml();
    const template = extractAppTemplate(html);
    const errors = [];
    compile(template, {
      onError: (e) => errors.push(e.message),
      onWarn: (w) => errors.push('warn: ' + w.message)
    });
    expect(errors).toEqual([]);
  });

  it('renders the kegiatan-level recap with drill-down', async () => {
    const html = await loadHtml();
    expect(html).toContain('baKegiatanRows');
    expect(html).toContain('baKegiatanBiaya');
    expect(html).toContain('progresDots');
    expect(html).toContain('stageTooltip');
    expect(html).toContain('openKelolaBa');
    expect(html).toContain('deleteBaAdmin');
    expect(html).toContain('this.kegiatan = data.kegiatan || []');
    expect(html).toContain('dosenSuggestions');
    expect(html).toContain('dosenOptions');
  });

  it('menyediakan drawer Riwayat Proses', async () => {
    const html = await loadHtml();
    expect(html).toContain('Riwayat Proses');
    expect(html).toContain('openRiwayat');
    expect(html).toContain('riwayatEvents');
  });

  it('mendefinisikan seluruh kelas CSS untuk titik progres', async () => {
    const html = await loadHtml();
    const selectors = cssSelectors(html);
    for (const sel of ['.inline-block', '.h-2\\.5', '.w-2\\.5', '.rounded-full', '.bg-emerald-500', '.bg-amber-400', '.bg-slate-200']) {
      expect(selectors.has(sel)).toBe(true);
    }
  });
});

describe('detail laporan tab pembayaran', () => {
  it('punya tab Data Pembayaran', async () => {
    const html = await loadHtml();
    expect(html).toContain("key: 'bayar', label: 'Data Pembayaran'");
    expect(html).toContain("activeTab === 'bayar'");
    expect(html).toContain("bayarFilter: { q: '', status: '', kelengkapan: '' }");
  });
  it('agregasi pembayaran per mahasiswa', async () => {
    const html = await loadHtml();
    expect(html).toContain('npmPembayaranMap()');
    expect(html).toContain('pembayaranRows()');
    expect(html).toContain('pembayaranFiltered()');
    expect(html).toContain('pembayaranSummary()');
    expect(html).toContain('bayarBuktiUrl(m)');
    expect(html).toContain('statusList(m)');
  });
  it('kolom Bukti Bayar punya keterangan rasio', async () => {
    const html = await loadHtml();
    expect(html).toContain('Peserta yang sudah unggah bukti bayar / total peserta kegiatan');
    expect(html).toContain('sudah unggah bukti / total peserta kegiatan');
  });
  it('export memuat sheet pembayaran', async () => {
    const html = await loadHtml();
    expect(html).toContain("'Pembayaran Mahasiswa'");
    expect(html).toContain("'Pembayaran Detail'");
    expect(html).toContain("'Link ACC INHAL': it.linkAcc");
  });
});

describe('detail laporan kejelasan tampilan', () => {
  it('sumbu matriks dijelaskan', async () => {
    const html = await loadHtml();
    expect(html).toContain('Dosen \\ Bagian');
    expect(html).toContain('Blok \\ Bagian');
    expect(html).toContain('Baris = Dosen, kolom = Bagian');
    expect(html).toContain('Baris = Blok, kolom = Bagian');
  });
  it('istilah chip seragam', async () => {
    const html = await loadHtml();
    expect(html).toContain('{{ baKegiatanBaTotal }} BA total');
    expect(html).toContain('{{ baKegiatanRows.length }} kegiatan');
  });
  it('filter rekap punya label dan Reset tidak menyisakan kolom kosong', async () => {
    const html = await loadHtml();
    expect(html).toContain('<label class="label">Jenis Kegiatan</label>');
    expect(html).toContain('<label class="label">Cari Mahasiswa</label>');
    expect(html).toContain('<div v-if="activeDosenCell" class="flex items-end md:col-span-6">');
    expect(html).toContain('<div v-if="activeMatrixCell" class="flex items-end md:col-span-2">');
  });
});
