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
    expect(html).toContain('Kelengkapan per Blok');
    expect(html).not.toContain('Peta Kelengkapan Bagian × Blok');
    expect(html).toContain('Buat BA');
    expect(html).not.toContain('Unggah BA Pendukung');
    expect(html).toContain('Unggah BA Pelaksanaan');
    expect(html).toContain('Belum Pendukung');
    expect(html).toContain('Belum Pelaksanaan');
    expect(html).toContain('/vendor/xlsx.full.min.js');
    expect(html).toContain('_loadXlsx()');
    expect(html).not.toContain('<script src="/vendor/xlsx.full.min.js"></script>');
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

  it('menampilkan indikator BA Pendukung x/y peserta', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('pesertaDenganBa');
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

  it('token & definisi primitif mockup tersedia', async () => {
    const html = await loadDashboardHtml();
    for (const s of ['--line:#e7ebf3', '.in-chip {', '.in-badge.wait {', '.in-tbl thead th {', '.in-tbl thead th.text-right {', '.in-toolbar {', '.in-input {', '.in-progdots i.all {', '.in-bar-fill.g {', '.in-tabsw {', '.in-statrow {']) {
      expect(html).toContain(s);
    }
  });

  it('permukaan pengajuan memakai primitif in-*', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('in-chip is-active');
    expect(html).toContain('in-badge acc');
    expect(html).toContain('class="in-tbl"');
  });

  it('permukaan statistik, heat, dan master memakai primitif in-*', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('in-statrow');
    expect(html).toContain('bagianBlokCards');
    expect(html).not.toContain('heat-table in-heat');
  });

  it('statistik memakai primitif bar konsisten', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('in-bar-track');
    expect(html).toContain('in-statrow dash-stat flex-col');
    expect(html).toContain('in-bar-fill transition-all duration-500');
  });

  it('primitif in-* lanjutan mockup tersedia', async () => {
    const html = await loadDashboardHtml();
    for (const s of ['.in-pageintro {', '.in-avatar {', '.in-celluser {', '.in-docdot {',
      '.in-docdot.on.bukti {', '.in-cards {', '.in-mcard {', '.in-proc {',
      '.in-manual-note {']) {
      expect(html).toContain(s);
    }
  });

  it('pengajuan memakai avatar, docdot, kartu mobile tanpa kartu statistik', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('overflow-x-auto in-desktop-only');
    expect(html).not.toContain('pengajuanStatCards');
    expect(html).toContain("'m-'+r['ID Pengajuan']");
    expect(html).toContain('in-celluser');
  });

  it('kartu mobile pengajuan mempertahankan hapus, pilih, dan berkas', async () => {
    const html = await loadDashboardHtml();
    const start = html.indexOf('class="in-cards"');
    const end = html.indexOf('<!-- ============ TAB: MANUAL', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const cards = html.slice(start, end);
    expect(cards).toContain('deletePengajuanRow(r)');
    expect(cards).toContain('v-model="r.checked"');
    expect(cards).toContain('in-docdot on bukti');
    expect(cards).toContain('in-docdot on surat');
    expect(cards).toContain('isManual(r)');
  });

  it('manual memakai panel terpisah dan catatan email', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('in-manual-note');
    expect(html).toContain('Identitas Mahasiswa');
    expect(html).toContain('Notifikasi email tidak dikirim');
  });

  it('BA memakai banner proses dan kartu blok tanpa ringkasan basum', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('class="in-proc"');
    expect(html).not.toContain('ba-cards in-basum');
    expect(html).toContain('bagianBlokCards');
    expect(html).toContain('Kelengkapan per Blok');
    expect(html).toContain('BA Pendukung');
    expect(html).toContain('BA Pelaksanaan');
  });

  it('utilitas Tailwind khusus yang dipakai markup terdefinisi', async () => {
    const html = await loadDashboardHtml();
    for (const s of [
      '.lg\\:grid-cols-5', '.mb-\\[18px\\]', '.gap-\\[14px\\]', '.gap-\\[5px\\]', '.min-w-\\[220px\\]',
      '.ring-2 {', '.ring-brand-600', '.ring-brand-400', '.bg-brand-50\\/70',
      '.opacity-70', '.p-1\\.5', '.ml-1\\.5', '.px-1 ', '.\\!px-2',
      '.hover\\:bg-brand-50:hover', '.hover\\:underline:hover', '.disabled\\:opacity-30:disabled',
      '.left-1', '.right-1', '.top-1', '.object-cover', '.w-28',
      '.grid-cols-3', '.md\\:grid-cols-2', '.sm\\:w-60',
      '.ring-amber-100', '.bg-slate-900\\/60', '.bg-slate-900\\/70', '.bg-rose-600\\/90', '.text-amber-800',
      '.section-title', '.master-grid'
    ]) {
      expect(html).toContain(s);
    }
  });

  it('helper berargumen didefinisikan sebagai methods, bukan computed', async () => {
    const html = await loadDashboardHtml();
    const computedStart = html.indexOf('computed: {');
    const watchStart = html.indexOf('watch: {', computedStart);
    expect(computedStart).toBeGreaterThan(-1);
    expect(watchStart).toBeGreaterThan(computedStart);
    const computedBlock = html.slice(computedStart, watchStart);
    const parameterized = computedBlock.match(/\n {16}[A-Za-z_$][A-Za-z0-9_$]*\s*\([^)]/g) || [];
    expect(parameterized).toEqual([]);
    const methodsStart = html.indexOf('methods: {', watchStart);
    const methodsBlock = html.slice(methodsStart);
    expect(methodsBlock).toMatch(/\n\s+pengajuanInitials\s*\([^)]/);
    expect(methodsBlock).toMatch(/\n\s+pengajuanAvatarColor\s*\([^)]/);
  });
});

describe('dashboard master chip picker', () => {
  it('memakai grid chip horizontal, bukan sidebar 280px', async () => {
    const html = await loadDashboardHtml();
    expect(html).not.toContain('lg:grid-cols-[280px_1fr]');
    expect(html).toContain('selectMasterCard(m.key)');
    expect(html).toContain('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 master-grid');
    expect(html).toContain('master-stat-label');
    expect(html).not.toContain('master-stat !w-auto');
  });
  it('master memakai grid kartu gaya mockup', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('master-grid');
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

  it('FAB (+) membuka sheet Buat BA', async () => {
    const html = await loadDashboardHtml();
    const m = html.match(/<button[^>]*class="fab-btn[^"]*"[^>]*>/);
    expect(m).not.toBeNull();
    expect(m[0]).toContain('@click="openBaSheet()"');
    expect(m[0]).toContain('Buat Berita Acara');
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

  it('konten dashboard melebar penuh di desktop', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('.content-wrap { width: 100%; max-width: none;');
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
    expect(html).not.toContain('Diterima');
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
  it('menyediakan pemilih status ACC pada panel keputusan', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('class="pd-statuspick"');
    expect(html).toContain('data-s="ACC"');
  });
  it('menyediakan tombol Jadikan ACC yang menerbitkan surat dan mengirim PDF', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain("@click=\"quickStatus('ACC')\"");
    expect(html).toContain('Jadikan ACC');
    expect(html).toContain("status === 'ACC'");
    expect(html).toContain('Surat keterangan final (PDF) dikirim');
  });
});

describe('dashboard unggah bukti bayar oleh admin', () => {
  it('menyediakan kartu unggah bukti bayar di detail pengajuan', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('Unggah Bukti Bayar (oleh Admin)');
    expect(html).toContain('uploadBuktiBayar()');
    expect(html).toContain('onBuktiFile($event)');
    expect(html).toContain('uploadBuktiAdmin');
    expect(html).toContain('detail.buktiFile');
  });
  it('menyediakan scan kamera seperti berita acara', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('ref="buktiCamera"');
    expect(html).toContain('accept="image/*" capture="environment"');
    expect(html).toContain("scanOnPhotos($event, 'bukti')");
    expect(html).toContain("scanBuildPdf('bukti')");
    expect(html).toContain("scanClear('bukti')");
    expect(html).toContain("if (which === 'bukti') return this.detail;");
    expect(html).toContain("Bukti-Bayar-Scan-");
  });
});

describe('dashboard biaya override per pengajuan', () => {
  it('menyediakan dropdown biaya di modal detail dengan opsi Master Biaya', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('v-model="detail.iForm.biaya"');
    expect(html).toContain('Default (Master Biaya)');
    expect(html).toContain('v-for="b in biayaOptions"');
  });
  it('mengisi dari BiayaOverride dan mengirim field biaya saat simpan', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain("biaya: p.BiayaOverride ? String(p.BiayaOverride) : ''");
    expect(html).toContain("biaya: (f.biaya || '').trim()");
  });
  it('menghitung opsi biaya unik dari Master Biaya', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('biayaOptions() {');
    expect(html).toContain('Object.keys(seen).map(Number).sort((a, b) => a - b)');
  });
});

describe('dashboard pensiun alur BA Pendukung lama', () => {
  it('tidak lagi memakai alur satu-file-per-kegiatan', async () => {
    const html = await loadDashboardHtml();
    expect(html).not.toContain('openBaUpload(');
    expect(html).not.toContain('submitBaAdmin(');
    expect(html).not.toContain('uploadBeritaAcaraAdmin');
  });
  it('menyediakan picker kegiatan via sheet dan tombol Kelola BA Pendukung di baris unit', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('baSheetOpenKegiatan(');
    expect(html).toContain('openKelolaBaForUnit(');
  });
});

describe('guard alur status dashboard', () => {
  it('tidak lagi menyediakan status atau aksi Diterima/notifikasi lama', async () => {
    const html = await loadDashboardHtml();
    expect(html).not.toContain('<option>Diterima</option>');
    expect(html).not.toContain('>Diterima<');
    expect(html).not.toContain('Kirim Ulang Email Notifikasi');
    expect(html).toContain('data-s="Menunggu"');
  });
});

describe('dashboard detail drawer primitives', () => {
  it('mendefinisikan primitif CSS pd-* dan helper stepper', async () => {
    const html = await loadDashboardHtml();
    const selectors = cssSelectors(html);
    for (const sel of ['.pd-overlay', '.pd-drawer', '.pd-head', '.pd-head-top', '.pd-avatar',
      '.pd-id', '.pd-close', '.pd-steps', '.pd-step', '.pd-step.active', '.pd-step.done',
      '.pd-body', '.pd-foot', '.pd-card', '.pd-card-head', '.pd-card-body', '.pd-grid2',
      '.pd-grid3', '.pd-keg', '.pd-mini-ic', '.pd-doc-row', '.pd-doc-ic', '.pd-doc-info',
      '.pd-pill-ok', '.pd-pill-no', '.pd-upzone', '.pd-statuspick', '.pd-manual-note',
      '.pd-progress', '.pd-email-box', '.pd-scan-grid', '.pd-scan-item']) {
      expect(selectors.has(sel)).toBe(true);
    }
    expect(html).toContain('setDetailStep(n) {');
    expect(html).toContain('this.detail.step = Math.max(0, Math.min(2, n));');
    expect(html).toContain('step: 0,');
    expect(html).toContain('this.detail.step = 0;');
  });
});

describe('dashboard detail drawer', () => {
  it('memakai drawer pd-* dengan stepper 3 langkah', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('class="pd-drawer"');
    expect(html).toContain('class="pd-overlay"');
    expect(html).toContain('class="pd-steps"');
    expect(html).toContain('data-step="0"');
    expect(html).toContain('data-step="1"');
    expect(html).toContain('data-step="2"');
    expect(html).toContain('>Identitas<');
    expect(html).toContain('>Berkas<');
    expect(html).toContain('>Keputusan<');
    expect(html).toContain('Lanjut ke Berkas');
    expect(html).toContain('Lanjut ke Keputusan');
    expect(html).not.toContain('modal-panel max-w-4xl');
  });

  it('mempertahankan kemampuan produksi di langkah-langkah', async () => {
    const html = await loadDashboardHtml();
    for (const s of [
      'uploadBuktiBayar()', 'onBuktiFile($event)', 'ref="buktiCamera"',
      "scanOnPhotos($event, 'bukti')", "scanBuildPdf('bukti')", "scanClear('bukti')",
      'updateStatus()', "quickStatus('ACC')", "quickStatus('Ditolak')",
      'sendFinalEmail()', 'sendAccFinalToBagian()', 'deletePengajuan()',
      'Unggah Bukti Bayar (oleh Admin)', 'uploadSurat', 'onSuratFile',
      'startEditDetail(i)', 'deleteDetailRow(i)', 'startEditInduk()', 'saveIndukFields()',
      'cancelEditDetail()', 'berkasProgress'
    ]) {
      expect(html).toContain(s);
    }
    expect(html).not.toContain('Kelola peserta dan berkas BA Pendukung untuk kegiatan pengajuan ini.');
  });

  it('tidak memuat status Diterima di panel keputusan', async () => {
    const html = await loadDashboardHtml();
    expect(html).not.toContain('data-s="Diterima"');
    expect(html).not.toContain('>Diterima<');
  });

  it('mereset langkah drawer ke 0 dan menyediakan progres berkas', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain('this.detail.step = 0;');
    expect(html).toContain('berkasProgress() {');
    expect(html).toContain("p['Link Surat Keterangan'], p['Link ACC INHAL'], p['Link Bukti Bayar']");
    expect(html).toContain(':style="{ width: (berkasProgress / 3 * 100) + \'%\' }"');
    expect(html).toContain('detailBaPendukung');
    expect(html).toContain('baPendukungByPengajuan');
    const iBa = html.indexOf('detailBaPendukung.fileUrl');
    const iAcc = html.indexOf('<div class="t">ACC INHAL</div>');
    expect(iBa).toBeGreaterThan(-1);
    expect(iAcc).toBeGreaterThan(-1);
    expect(iBa).toBeLessThan(iAcc);
  });
});
