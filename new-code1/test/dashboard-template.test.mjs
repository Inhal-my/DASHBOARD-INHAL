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
    assert.match(html, /master\.tab = m\.key/);
  });
  it('paginasi master 20', () => {
    assert.match(html, /masterPagedRows/);
  });
});
