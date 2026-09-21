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
  it('tidak ada Download Database', () => {
    assert.doesNotMatch(html, /downloadDatabase/);
    assert.doesNotMatch(html, /Download Database/);
  });
  it('memuat SheetJS', () => {
    assert.match(html, /xlsx@0\.18\.5/);
  });
});
