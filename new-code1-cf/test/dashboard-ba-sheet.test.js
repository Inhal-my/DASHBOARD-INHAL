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

  it('menyediakan state baSheet dengan default pendukung', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('baSheet: {');
    expect(html).toContain("type: 'pendukung'");
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

  it('menempatkan form pelaksanaan di dalam sheet, bukan panel', async () => {
    const html = await loadDashboardHtml();
    const sheetStart = html.indexOf('ba-sheet-wrap');
    const sheetEnd = html.indexOf('<!-- ============ MOBILE MENU SHEET', sheetStart);
    const sheet = html.slice(sheetStart, sheetEnd);
    expect(sheet).toContain('babOnBaFile');
    expect(sheet).toContain('babSubmitBa');

    const panelStart = html.indexOf('id="bab-panel"');
    const panelEnd = html.indexOf('<!-- ============ TAB: MASTER', panelStart);
    const panel = html.slice(panelStart, panelEnd);
    expect(panel).not.toContain('babOnBaFile');
  });

  it('menyediakan sesi otomatis dan pemilihan pelaksanaan', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('deriveBagianScope(bagian)');
    expect(html).toContain('babEnsureSession(kategori, subBagian)');
    expect(html).toContain('_baSheetPickPelaksanaan(u)');
  });

  it('mengirim jadwal, jam, dan dosen saat membuat BA Pelaksanaan', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('this.bab.jadwalList = boot.jadwalList || []');
    expect(html).toContain('babSelectedJadwal()');
    expect(html).toContain('const jadwal = this.babSelectedJadwal || {}');
    expect(html).toContain('jadwalId: jadwal.JadwalID ||');
    expect(html).toContain('jam: jadwal.Jam ||');
    expect(html).toContain('dosenList: (Array.isArray(jadwal.DosenList)');
    expect(html).toContain('dosen: (Array.isArray(jadwal.DosenList)');
  });

  it('menampilkan nama blok tanpa awalan "Blok"', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('blokName(c.blok)');
    expect(html).toContain('blokName(g.blok)');
    expect(html).toContain('blokName(baSheet.blok)');
    expect(html).toContain('blokName(v)');
    expect(html).not.toContain('>Blok {{ c.blok }}<');
    expect(html).not.toContain('>Blok {{ g.blok }}<');
  });
});

describe('sheet Pendukung: pilih banyak peserta', () => {
  it('menyediakan level peserta dengan checkbox default kosong', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain("baSheet.level==='peserta'");
    expect(html).toContain('v-model="baSheet.pesertaIds"');
    expect(html).toContain('baSheetToggleAllPeserta');
    expect(html).toContain('baSheetAllSelected');
    expect(html).toContain('baSheetCreateBa');
  });

  it('membuat BA lewat RPC bulk yang sudah ada', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain("this.run('baAdminCreate', kegiatan)");
    expect(html).toContain("this.run('baAdminAddPeserta', created.baId, ids)");
    expect(html).toContain("this.run('baAdminGet', first)");
  });

  it('menawarkan Kelola BA bila kegiatan sudah punya BA', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('baSheet.baAda');
    expect(html).toContain('baSheetKelolaExisting');
  });

  it('default peserta kosong saat sheet dibuka', async () => {
    const html = await loadDashboardHtml();
    const load = html.slice(html.indexOf('async baSheetLoadPeserta(u)'));
    const body = load.slice(0, load.indexOf('baSheetToggleAllPeserta()'));
    expect(body).toContain('this.baSheet.pesertaIds = [];');
    expect(body).not.toContain('pesertaOpsi || []).map(');
  });
});

describe('status PDF BA Pendukung', () => {
  it('membedakan BA ada tetapi PDF belum ada', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('unitPendukungPdfSiap(u)');
    expect(html).toContain('unitPendukungLabel(u)');
    expect(html).toContain("'PDF belum ada'");
    expect(html).toContain("'BA Pendukung': u.__orphan ? '-' : this.unitPendukungLabel(u)");
  });
});

describe('modal Kelola: PDF BA bersama (Tahap 2)', () => {
  it('menyediakan seksi unggah PDF untuk semua peserta', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('PDF BA untuk semua peserta');
    expect(html).toContain('kbPickShared()');
    expect(html).toContain('onKbSharedFile($event)');
    expect(html).toContain('kbRemoveShared()');
    expect(html).toContain("this.run('baAdminSetSharedFile'");
    expect(html).toContain("this.run('baAdminRemoveSharedFile'");
  });

  it('memakai konfirmasi saat mengganti PDF bersama dan tetap mempertahankan unggah per peserta', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('Ganti PDF BA bersama? PDF lama tetap tersimpan sebagai riwayat.');
    expect(html).toContain("kbStartBerkas('change-scan', pe)");
    expect(html).toContain("kbStartBerkas('change-pdf', pe)");
    expect(html).toContain('Mengikuti PDF bersama');
  });
});
