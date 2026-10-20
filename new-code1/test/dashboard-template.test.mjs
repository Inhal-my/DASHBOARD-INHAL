import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../pages/dashboard.html', import.meta.url), 'utf8');

describe('dashboard template BA', () => {
  it('nav empat item tanpa Laporan Bagian / BA Bagian', () => {
    assert.match(html, /key: 'pengajuan'/);
    assert.match(html, /key: 'ba'/);
    assert.match(html, /key: 'master'/);
    assert.doesNotMatch(html, /label: 'Laporan Bagian'/);
    assert.doesNotMatch(html, /label: 'Berita Acara Bagian'/);
    assert.doesNotMatch(html, /tab==='bagian'/);
    assert.doesNotMatch(html, /tab==='baBagian'/);
  });
  it('header Pendukung dan Ekspor, tanpa Unggah Pelaksanaan di header', () => {
    assert.match(html, /Unggah BA Pendukung/);
    assert.match(html, /exportBagianExcel/);
    assert.doesNotMatch(html, /Unggah BA Pelaksanaan/);
  });
  it('aksi horizontal emerald Pelaksanaan', () => {
    assert.match(html, /btn-emerald/);
    assert.match(html, /openPelaksanaanPanel\(r\)/);
    assert.match(html, /flex flex-row flex-wrap/);
  });
  it('paginasi 20', () => {
    assert.match(html, /bagianPagedRows/);
    assert.match(html, /Menampilkan \{\{ bagianPageInfo.start \}\}/);
  });
  it('filter BA Zona 3 punya dropdown Blok dan Bagian', () => {
    assert.match(html, /<select v-model="bagian\.fBlok"/);
    assert.match(html, /<select v-model="bagian\.fBagian"/);
    assert.match(html, /bagianBlokOptions/);
    assert.match(html, /v-for="b in bagian\.options"/);
  });
  it('pager memakai pageInfo yang di-clamp', () => {
    assert.match(html, /const page = this\.bagianPageInfo\.page/);
    assert.match(html, /const page = this\.masterPageInfo\.page/);
  });
  it('tidak ada Download Database', () => {
    assert.doesNotMatch(html, /downloadDatabase/);
    assert.doesNotMatch(html, /Download Database/);
  });
  it('memuat SheetJS', () => {
    assert.match(html, /xlsx@0\.18\.5/);
  });
});

describe('dashboard template master', () => {
  it('kartu mahasiswa dan tanpa saveFn replace-all di cards', () => {
    assert.match(html, /key: 'mahasiswa'/);
    assert.match(html, /table: 'Mahasiswa'/);
    assert.match(html, /openMasterRow/);
    assert.match(html, /onMahasiswaCsv/);
    assert.doesNotMatch(html, /saveFn: 'saveMasterKegiatan'/);
  });
  it('chip picker horizontal bukan sidebar 280px', () => {
    assert.doesNotMatch(html, /lg:grid-cols-\[280px_1fr\]/);
    assert.match(html, /selectMasterCard\(m\.key\)/);
  });
  it('pemilih kartu master berbentuk grid chip', () => {
    assert.match(html, /grid grid-cols-2 gap-2 sm:grid-cols-4/);
    assert.match(html, /\.sm\\:grid-cols-4/);
    assert.match(html, /master-stat-label/);
    assert.doesNotMatch(html, /master-stat !w-auto/);
  });
  it('paginasi master 20', () => {
    assert.match(html, /masterPagedRows/);
  });
  it('overlay dialog konfirmasi di atas modal', () => {
    assert.match(html, /z-\[130\] modal-overlay/);
    assert.match(html, /\.z-\\\[130\\\] \{ z-index: 130; \}/);
    assert.match(html, /\.z-\\\[150\\\] \{ z-index: 150; \}/);
  });
  it('mahasiswa memakai paginasi + pencarian server', () => {
    assert.match(html, /getMasterMahasiswaPage/);
    assert.match(html, /async loadMahasiswaPage\(page\)/);
    assert.match(html, /onMasterSearch/);
    assert.match(html, /gotoMasterPage\(masterPageInfo\.page-1\)/);
    assert.match(html, /master\.mhsTotal/);
  });
});

describe('dashboard input manual', () => {
  it('punya tab Manual di navigasi', () => {
    assert.match(html, /key: 'manual', icon: 'bi-pencil-square', label: 'Manual'/);
    assert.match(html, /<section v-if="tab==='manual'">/);
    assert.match(html, /Input Pengajuan Manual/);
  });
  it('form manual tanpa field Email dan No. HP', () => {
    assert.match(html, /registerManualPengajuan/);
    assert.match(html, /submitManual\(\)/);
    assert.match(html, /manual\.form\.status/);
    assert.doesNotMatch(html, /manual\.form\.email/);
    assert.doesNotMatch(html, /manual\.form\.noHp/);
  });
  it('kolom Sumber dan badge Manual', () => {
    assert.match(html, /isManual\(r\)/);
    assert.match(html, />Sumber</);
    assert.match(html, /Pengajuan manual tanpa email/);
  });
});

describe('dashboard opsi status ACC', () => {
  it('dropdown status punya opsi ACC', () => {
    assert.match(html, /<select v-model="detail\.status" class="input">[\s\S]*<option>ACC<\/option>[\s\S]*<\/select>/);
  });
  it('tombol cepat Jadikan ACC', () => {
    assert.match(html, /quickStatus\('ACC'\)/);
    assert.match(html, /Jadikan ACC/);
  });
  it('quickStatus ACC memakai konfirmasi tanpa email', () => {
    assert.match(html, /status === 'ACC'/);
    assert.match(html, /Tidak ada email yang dikirim/);
  });
});

describe('dashboard unggah bukti bayar oleh admin', () => {
  it('menyediakan kartu unggah bukti bayar di detail', () => {
    assert.match(html, /Unggah Bukti Bayar \(oleh Admin\)/);
    assert.match(html, /uploadBuktiBayar\(\)/);
    assert.match(html, /onBuktiFile\(\$event\)/);
    assert.match(html, /uploadBuktiAdmin/);
    assert.match(html, /detail\.buktiFile/);
  });
});

describe('dashboard scan kamera', () => {
  it('menyisipkan ScanPdf dan kontrol scan kamera untuk bukti, BA pendukung, dan pelaksanaan', () => {
    assert.match(html, /window\.ScanPdf = \{ buildPdf: buildPdf, compressToJpeg: compressToJpeg \}/);
    assert.match(html, /scanBuildPdf\('bukti'\)/);
    assert.match(html, /scanBuildPdf\('pendukung'\)/);
    assert.match(html, /scanBuildPdf\('pelaksanaan'\)/);
    assert.match(html, /ref="buktiCamera"/);
    assert.match(html, /ref="pendukungCamera"/);
    assert.match(html, /ref="pelaksanaanCamera"/);
    assert.match(html, /scanOnPhotos\(\$event, 'bukti'\)/);
    assert.match(html, /scanTarget\(which\)/);
    assert.match(html, /Bukti-Bayar-Scan-/);
    assert.match(html, /BA-Pendukung-Scan-/);
    assert.match(html, /BA-Pelaksanaan-Scan-/);
  });
});

describe('dashboard tab persistence', () => {
  it('tab aktif dibaca dari hash dan disinkronkan', () => {
    assert.match(html, /const TAB_KEYS = \['pengajuan', 'manual', 'stats', 'ba', 'master'\]/);
    assert.match(html, /hashTab\(\)/);
    assert.match(html, /history\.replaceState\(null, '', h\)/);
    assert.match(html, /this\.tab = this\.hashTab\(\)/);
  });
  it('stale-while-revalidate per tab', () => {
    assert.match(html, /isTabStale\(key\)/);
    assert.match(html, /TAB_TTL_MS/);
    assert.match(html, /loadPengajuan\(\{ silent: this\.loaded\.pengajuan \}\)/);
    assert.match(html, /async loadBa\(opts\)/);
  });
  it('tab BA memakai satu panggilan gabungan', () => {
    assert.match(html, /run\('getBaTabData'\)/);
    assert.match(html, /async loadBaTab\(opts\)/);
    assert.match(html, /this\.isTabStale\('bagian'\) \|\| this\.isTabStale\('ba'\)/);
  });
});

describe('dashboard shell CF', () => {
  it('sidebar bisa dilipat dan memakai app-shell', () => {
    assert.match(html, /class="app-shell font-sans/);
    assert.match(html, /sidebarCollapsed: false/);
    assert.match(html, /class="sidebar-toggle"/);
    assert.match(html, /sb-hide/);
    assert.match(html, /\.app-shell\.sidebar-collapsed \{ --sidebar-w: 84px; \}/);
  });
  it('topbar punya pencarian dan notifikasi menunggu', () => {
    assert.match(html, /class="topbar-search"/);
    assert.match(html, /class="topbar-bell"/);
    assert.match(html, /goMenunggu\(\)/);
    assert.match(html, /runTopbarSearch\(\)/);
    assert.match(html, /menungguCount\(\)/);
  });
  it('navigasi bawah mobile empat tombol dan menu sheet', () => {
    assert.match(html, /class="bottom-nav lg:hidden"/);
    assert.match(html, /bottom-nav-track/);
    assert.match(html, /mobileMenuOpen = true/);
    assert.match(html, /class="sheet-panel lg:hidden"/);
    assert.match(html, /tab==='pengajuan' \? 'active' : ''/);
    assert.match(html, /tab==='ba' \? 'active' : ''/);
    assert.match(html, /tab==='master' \? 'active' : ''/);
  });
});

describe('dashboard drawer detail CF', () => {
  it('detail memakai pd-drawer bukan modal lebar', () => {
    assert.match(html, /class="pd-overlay"/);
    assert.match(html, /class="pd-drawer"/);
    assert.match(html, /class="pd-foot"/);
    assert.doesNotMatch(html, /modal-panel max-w-4xl/);
  });
  it('tiga langkah detail dan reset ke identitas', () => {
    assert.match(html, /data-step="0"/);
    assert.match(html, /data-step="1"/);
    assert.match(html, /data-step="2"/);
    assert.match(html, /setDetailStep\(n\)/);
    assert.match(html, /this\.detail\.step = Math\.max\(0, Math\.min\(2, n\)\)/);
    assert.match(html, /this\.detail\.step = 0;\s*\n\s*this\.detail\.open = true;/);
  });
  it('identitas memakai kartu pd-card dan avatar inisial', () => {
    assert.match(html, /class="pd-card"/);
    assert.match(html, /pengajuanInitials\(/);
    assert.match(html, /pengajuanAvatarColor\(/);
    assert.match(html, /detail\.step===0/);
    assert.match(html, /detail\.step===1/);
  });
});

describe('dashboard preview BA', () => {
  const html = readFileSync(new URL('../pages/dashboard.html', import.meta.url), 'utf8');
  it('memakai partial preview bersama', () => {
    assert.match(html, /<\?!= include\('pages\/_app-common'\) \?>/);
    assert.match(html, /mixins: \[AppCommon\.buktiPreviewMixin\]/);
    assert.match(html, /ref="buktiPreview"/);
  });
  it('hover BA ID menampilkan pratinjau', () => {
    assert.match(html, /onBuktiEnter\(\$event, b\.fileUrl, 'BA Pendukung'\)/);
    assert.match(html, /onBuktiEnter\(\$event, b\.fileUrl, 'BA Pelaksanaan'\)/);
    assert.match(html, /onBuktiEnter\(\$event, r\['File URL'\], 'BA Pelaksanaan'\)/);
  });
  it('tombol BA di modal detail punya pratinjau', () => {
    assert.match(html, /onBuktiEnter\(\$event, b\['File URL'\], 'BA Pendukung'\)/);
  });
  it('preview ditutup saat pindah tab', () => {
    assert.match(html, /tab\(\) \{ this\.closeBuktiPreview\(\); \}/);
  });
});
