import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../pages/detail-laporan.html', import.meta.url), 'utf8');

describe('detail laporan tab pembayaran', () => {
  it('punya tab Data Pembayaran', () => {
    assert.match(html, /key: 'bayar', label: 'Data Pembayaran'/);
    assert.match(html, /activeTab === 'bayar'/);
    assert.match(html, /bayarFilter: \{ q: '', status: '', kelengkapan: '' \}/);
  });
  it('agregasi pembayaran per mahasiswa', () => {
    assert.match(html, /npmPembayaranMap\(\)/);
    assert.match(html, /pembayaranRows\(\)/);
    assert.match(html, /pembayaranFiltered\(\)/);
    assert.match(html, /pembayaranSummary\(\)/);
    assert.match(html, /bayarBuktiUrl\(m\)/);
    assert.match(html, /statusList\(m\)/);
  });
  it('kolom Bukti Bayar punya keterangan rasio', () => {
    assert.match(html, /Peserta yang sudah unggah bukti bayar \/ total peserta kegiatan/);
    assert.match(html, /sudah unggah bukti \/ total peserta kegiatan/);
  });
  it('export memuat sheet pembayaran', () => {
    assert.match(html, /'Pembayaran Mahasiswa'/);
    assert.match(html, /'Pembayaran Detail'/);
    assert.match(html, /'Link ACC INHAL': it\.linkAcc/);
  });
});

describe('detail laporan kejelasan tampilan', () => {
  it('sumbu matriks dijelaskan', () => {
    assert.match(html, /Dosen \\ Bagian/);
    assert.match(html, /Blok \\ Bagian/);
    assert.match(html, /Baris = Dosen, kolom = Bagian/);
    assert.match(html, /Baris = Blok, kolom = Bagian/);
  });
  it('istilah chip seragam', () => {
    assert.match(html, /\{\{ baGroupBaTotal \}\} BA total/);
    assert.match(html, /\{\{ baGroupRows\.length \}\} kegiatan/);
    assert.doesNotMatch(html, /kelompok kegiatan/);
  });
  it('filter rekap punya label dan Reset tidak menyisakan kolom kosong', () => {
    assert.match(html, /<label class="label">Jenis Kegiatan<\/label>/);
    assert.match(html, /<label class="label">Cari Mahasiswa<\/label>/);
    assert.match(html, /<div v-if="activeDosenCell" class="flex items-end md:col-span-6">/);
    assert.match(html, /<div v-if="activeMatrixCell" class="flex items-end md:col-span-2">/);
  });
});

describe('detail laporan shell CF', () => {
  const html = readFileSync(new URL('../pages/detail-laporan.html', import.meta.url), 'utf8');
  it('memakai wrapper app-shell di dalam #app', () => {
    assert.match(html, /<div id="app" v-cloak>\s*<div class="app-shell font-sans/);
    assert.doesNotMatch(html, /id="app"[^>]*class="[^"]*app-shell/);
    assert.match(html, /class="bg-sidebar sidebar-aside/);
    assert.match(html, /class="sidebar-toggle"/);
    assert.match(html, /class="main-wrap min-h-screen"/);
  });
  it('punya bottom nav dan sheet menu mobile', () => {
    assert.match(html, /class="bottom-nav lg:hidden"/);
    assert.match(html, /class="bottom-nav-track"/);
    assert.match(html, /class="bnav-btn"/);
    assert.match(html, /class="sheet-overlay"/);
    assert.match(html, /class="sheet-panel"/);
    assert.match(html, /mobileMenuOpen/);
  });
  it('sidebar memilih tab laporan', () => {
    assert.match(html, /@click\.prevent="switchTab\(n\.key\)"/);
    assert.match(html, /switchTab\(key\) \{/);
    assert.match(html, /this\.activeTab = key;/);
  });
});

describe('detail laporan mode halaman', () => {
  const html = readFileSync(new URL('../pages/detail-laporan.html', import.meta.url), 'utf8');
  it('punya mode ringkas dan analitis', () => {
    assert.match(html, /class="mode-head"/);
    assert.match(html, /class="mode-tabs"/);
    assert.match(html, /switchLaporanMode\('ringkas'\)/);
    assert.match(html, /switchLaporanMode\('analitis'\)/);
    assert.match(html, /laporanMode: 'ringkas'/);
  });
  it('judul mengikuti mode dan tab', () => {
    assert.match(html, /modeTitle\(\)/);
    assert.match(html, /modeSubtitle\(\)/);
    assert.match(html, /laporanMode === 'ringkas'/);
  });
  it('mendukung cetak lewat mode dan URL', () => {
    assert.match(html, /printLaporan\(\)/);
    assert.match(html, /pendingPrint/);
    assert.match(html, /searchParams\.get\('mode'\)/);
    assert.match(html, /window\.print\(\)/);
    assert.match(html, /@media print/);
  });
});

describe('detail laporan preview dan kolom BA', () => {
  const html = readFileSync(new URL('../pages/detail-laporan.html', import.meta.url), 'utf8');
  it('memakai partial preview bersama', () => {
    assert.match(html, /<\?!= include\('pages\/_app-common'\) \?>/);
    assert.match(html, /mixins: \[AppCommon\.buktiPreviewMixin\]/);
    assert.match(html, /ref="buktiPreview"/);
    assert.match(html, /class="bukti-preview"/);
  });
  it('kolom Berita Acara di tab pembayaran', () => {
    assert.match(html, /<th class="whitespace-nowrap px-3 py-2\.5 text-center">Berita Acara<\/th>/);
    assert.match(html, /class="ba-ic is-p"/);
    assert.match(html, /class="ba-ic is-l"/);
    assert.match(html, /m\.baPendukung/);
    assert.match(html, /m\.baPelaksanaan/);
    assert.match(html, /colspan="9"/);
  });
  it('popover daftar BA untuk lebih dari satu berkas', () => {
    assert.match(html, /baMenu: \{ open: false/);
    assert.match(html, /onBaEnter\(event, type, items\)/);
    assert.match(html, /openBaMenu\(anchor, type, items\)/);
    assert.match(html, /class="ba-menu"/);
  });
  it('preview pada bukti bayar dan berita acara', () => {
    assert.match(html, /onBuktiEnter\(\$event, bayarBuktiUrl\(m\), 'Bukti Bayar'\)/);
    assert.match(html, /onBuktiEnter\(\$event, b\['File URL'\], 'BA ' \+ \(b\.Label \|\| 'Kegiatan'\)\)/);
  });
  it('export menambah kolom BA', () => {
    assert.match(html, /'BA Pendukung': m\.baPendukung\.map\(b => b\.baId\)\.join\(', '\)/);
    assert.match(html, /'BA Pelaksanaan': m\.baPelaksanaan\.map\(b => b\.baId\)\.join\(', '\)/);
    assert.match(html, /'Link BA Pendukung'/);
    assert.match(html, /'Link BA Pelaksanaan'/);
  });
});
