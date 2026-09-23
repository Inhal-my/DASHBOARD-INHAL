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

describe('dashboard tab persistence', () => {
  it('tab aktif dibaca dari hash dan disinkronkan', () => {
    assert.match(html, /const TAB_KEYS = \['pengajuan', 'stats', 'ba', 'master'\]/);
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
