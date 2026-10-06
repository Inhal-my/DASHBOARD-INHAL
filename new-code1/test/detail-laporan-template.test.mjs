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
