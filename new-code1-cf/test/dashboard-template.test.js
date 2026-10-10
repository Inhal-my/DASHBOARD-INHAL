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
    expect(html).toContain('_loadXlsx()');
    expect(html).not.toContain('<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>');
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
    expect(html).toContain("toggleBaExpand(b.sumber + '|' + b.baId)");
    expect(html).toContain('Mahasiswa ({{ (b.peserta || []).length }})');
    expect(html).toContain('v-for="(p, pi) in b.peserta"');
    expect(html).toContain('Tidak ada peserta tercatat.');
    expect(html).toContain("expandedBa[b.sumber + '|' + b.baId]");
  });

  it('menjadikan nomor BA tautan file dan menghapus teks Lihat File', async () => {
    const html = await loadDashboardHtml();
    expect(html).not.toContain('Lihat File');
    expect(html).not.toContain('Lihat file');
    expect(html).toContain(':href="safeUrl(b.fileUrl)" target="_blank" rel="noopener noreferrer" class="link font-mono font-bold text-slate-700">{{ b.baId }}</a>');
  });

  it('menampilkan ikon Kelola BA hanya untuk BA Pelaksanaan', async () => {
    const html = await loadDashboardHtml();
    const kelola = html.match(/<button[^>]*title="Kelola BA"/g) || [];
    expect(kelola.length).toBeGreaterThan(0);
    for (const btn of kelola) expect(btn).toContain("b.sumber === 'Bagian'");
  });

  it('hanya menampilkan kontrol Aksi BA Pelaksanaan tanpa tombol Riwayat', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain("v-for=\"(b, bi) in r.__pelaksanaanBa\" :key=\"'a'+bi\"");
    expect(html).not.toContain("v-for=\"(b, bi) in r.ba\" :key=\"'a'+bi\"");
    expect(html).not.toContain('@click="openRiwayat(r)">Riwayat</button>');
  });

  it('membuka riwayat saat isi kolom progres diklik', async () => {
    const html = await loadDashboardHtml();
    const m = html.match(/<button[^>]*@click="openRiwayat\(r\)"[^>]*>[\s\S]*?r\.__progres[\s\S]*?<\/button>/);
    expect(m).not.toBeNull();
    expect(m[0]).toContain('cursor-pointer');
    expect(m[0]).toContain('stageTooltip(r)');
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

  it('adds a Download Database settings card on Master Data', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain("key: 'downloadDatabase', title: 'Download Database'");
    expect(html).toContain('@click="downloadDatabase"');
    expect(html).toContain('/api/database-export');
    expect(html).toContain('tidak pernah ikut diekspor');
    expect(html).toContain("v-model=\"master.downloadScope\"");
    expect(html.indexOf("key: 'admin'")).toBeLessThan(html.indexOf("key: 'downloadDatabase'"));
  });

  it('adds the Kelola Unggahan master card with reset controls', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain("key: 'kelolaUnggahan', title: 'Kelola Unggahan'");
    expect(html).toContain('@click="openResetUpload(r)"');
    expect(html).toContain('@click="confirmResetUpload()"');
    expect(html).toContain('resetUploadBukti');
    expect(html).toContain('getUploadMonitor');
    expect(html).toContain('uploadMonitorRows');
    expect(html).toContain('Menunggu unggah ulang');
    expect(html.indexOf("key: 'downloadDatabase'")).toBeLessThan(html.indexOf("key: 'kelolaUnggahan'"));
  });
});

describe('dashboard master chip picker', () => {
  it('memakai grid chip horizontal, bukan sidebar 280px', async () => {
    const html = await loadDashboardHtml();
    expect(html).not.toContain('lg:grid-cols-[280px_1fr]');
    expect(html).toContain('selectMasterCard(m.key)');
    expect(html).toContain('grid grid-cols-2 gap-2 sm:grid-cols-4');
    expect(html).toContain('master-stat-label');
    expect(html).not.toContain('master-stat !w-auto');
  });
  it('overlay dialog konfirmasi di atas modal', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('z-[130] modal-overlay');
    expect(html).toContain('.z-\\[130\\] { z-index: 130; }');
    expect(html).toContain('.z-\\[150\\] { z-index: 150; }');
  });
});

describe('dashboard tab persistence', () => {
  it('tab aktif dibaca dari hash dan disinkronkan', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain("const TAB_KEYS = ['pengajuan', 'manual', 'stats', 'ba', 'master']");
    expect(html).toContain('hashTab()');
    expect(html).toContain("history.replaceState(null, '', h)");
    expect(html).toContain('this.tab = this.hashTab()');
  });
});

describe('dashboard responsive shell', () => {
  it('memakai app shell dengan sidebar yang bisa dilipat', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('class="app-shell font-sans text-ink antialiased"');
    expect(html).toContain(":class=\"sidebarCollapsed ? 'sidebar-collapsed' : ''\"");
    expect(html).toContain('sidebar-toggle');
    expect(html).toContain('sidebarCollapsed = !sidebarCollapsed');
    expect(html).toContain('sidebar-aside');
    expect(html).toContain('main-wrap');
    expect(html).toContain('content-wrap');
  });

  it('menyediakan bottom nav HP dengan 3 tab dan tombol Menu', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('bottom-nav');
    expect(html).toContain('bnav-btn');
    expect(html).toContain("@click=\"switchTab('pengajuan')\"");
    expect(html).toContain("@click=\"switchTab('ba')\"");
    expect(html).toContain("@click=\"switchTab('master')\"");
    expect(html).toContain('mobileMenuOpen = true');
    expect(html).toContain('sheet-panel');
    expect(html).toContain('sheet-item');
  });

  it('FAB (+) memanggil openBaUpload untuk BA Pendukung', async () => {
    const html = await loadDashboardHtml();
    const m = html.match(/<button[^>]*class="fab-btn[^"]*"[^>]*>/);
    expect(m).not.toBeNull();
    expect(m[0]).toContain('@click="openBaUpload()"');
    expect(m[0]).toContain('Tambah Berita Acara Pendukung');
  });

  it('topbar menampilkan pencarian dan notifikasi menunggu', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('topbar-search');
    expect(html).toContain('@keyup.enter="runTopbarSearch()"');
    expect(html).toContain('topbar-bell');
    expect(html).toContain('@click="goMenunggu()"');
    expect(html).toContain('menungguCount');
    expect(html).toContain('runTopbarSearch()');
    expect(html).toContain('goMenunggu()');
  });

  it('mendefinisikan CSS shell responsif', async () => {
    const html = await loadDashboardHtml();
    const selectors = cssSelectors(html);
    for (const sel of ['.app-shell', '.sidebar-aside', '.main-wrap', '.content-wrap', '.sidebar-toggle', '.bottom-nav', '.bnav-btn', '.fab-btn', '.sheet-panel', '.sheet-item', '.topbar-search', '.topbar-bell', '.stat-trend']) {
      expect(selectors.has(sel)).toBe(true);
    }
  });
});

describe('dashboard manual entry tab', () => {
  it('menambahkan tab Manual dengan ikon pensil', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain("key: 'manual', icon: 'bi-pencil-square', label: 'Manual'");
    expect(html).toContain("tab==='manual'");
    expect(html).toContain('Input Pengajuan Manual');
  });

  it('menyediakan form manual dengan status awal dan registrasi RPC admin', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('submitManual()');
    expect(html).toContain('registerManualPengajuan');
    expect(html).toContain('getRegistrationOptions');
    expect(html).toContain('onManualNpmBlur()');
    expect(html).toContain('Status Awal');
    expect(html).toContain("v-model=\"manual.form.status\"");
    expect(html).toContain('<option value="Menunggu">Menunggu</option>');
    expect(html).toContain('<option value="Diterima">Diterima</option>');
  });

  it('menandai sumber Manual dan menonaktifkan email notifikasi', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('isManual(r)');
    expect(html).toContain('manualHighlightId');
    expect(html).toContain('!isManual(detail.p)');
    expect(html).toContain("'Sumber'");
  });
});

describe('dashboard ubah status ke ACC', () => {
  it('menyediakan opsi ACC pada dropdown status', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('<option>ACC</option>');
  });
  it('menyediakan tombol Jadikan ACC tanpa kirim email', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain("@click=\"quickStatus('ACC')\"");
    expect(html).toContain('Jadikan ACC');
    expect(html).toContain("status === 'ACC'");
    expect(html).toContain('Tidak ada email yang dikirim');
  });
});
