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

  it('adds the Mahasiswa master card with CSV upload and row actions', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain("key: 'mahasiswa', title: 'Mahasiswa'");
    expect(html).toContain('Unggah CSV');
    expect(html).toContain('@click="openMasterRow(activeMasterCard.key)"');
    expect(html).toContain('@click="deleteMasterRow(r)"');
    expect(html).toContain('onMahasiswaCsv');
    expect(html).toContain("master.rowModal");
  });

  it('memuat progres kegiatan dan modal Kelola BA', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('progresDots');
    expect(html).toContain('openKelolaBa');
    expect(html).toContain('dosenSuggestions');
  });

  it('mendefinisikan seluruh kelas CSS untuk titik progres', async () => {
    const html = await loadDashboardHtml();
    const selectors = cssSelectors(html);
    for (const sel of ['.inline-block', '.h-2\\.5', '.w-2\\.5', '.rounded-full', '.bg-emerald-500', '.bg-amber-400', '.bg-slate-200']) {
      expect(selectors.has(sel)).toBe(true);
    }
  });

  it('renders a per-BA mahasiswa roster toggle and list', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('@click="toggleBaExpand(b.baId)"');
    expect(html).toContain('Mahasiswa ({{ (b.peserta || []).length }})');
    expect(html).toContain('v-for="(p, pi) in b.peserta"');
    expect(html).toContain('Tidak ada peserta tercatat.');
    expect(html).toContain('v-if="expandedBa[b.baId]"');
  });

  it('renders the per-BA roster on mobile too', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain(":key=\"'mb' + bi\"");
    expect((html.match(/Tidak ada peserta tercatat\./g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('menyediakan drawer Riwayat Proses', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('Riwayat Proses');
    expect(html).toContain('openRiwayat');
    expect(html).toContain('riwayatEvents');
  });

  it('removes the old replace-all master editor entrypoint', async () => {
    const html = await loadDashboardHtml();
    expect(html).not.toContain('@click="editMaster(activeMasterCard.key)"');
    expect(html).toContain('master-table-dense');
  });
});
