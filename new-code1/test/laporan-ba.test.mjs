import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const gs = readFileSync(new URL('../1_business.gs', import.meta.url), 'utf8');
const code = readFileSync(new URL('../0_code.gs', import.meta.url), 'utf8');

describe('laporan bootstrap melampirkan BA per baris', () => {
  it('membangun unit dari rows dan memakai matcher BA yang sama', () => {
    assert.match(gs, /function _attachBaToLaporanRows\(rows, baList, labs\)/);
    assert.match(gs, /_attachBaToUnits\(units, baList/);
    assert.match(gs, /row\.baPendukung = pendukung;/);
    assert.match(gs, /row\.baPelaksanaan = pelaksanaan;/);
  });
  it('tidak gagal bila sheet BA Admin belum dimigrasi', () => {
    assert.match(gs, /function _getRowsOptional\(sheetName\)/);
    assert.match(gs, /function _getRowsCachedOptional\(sheetName\)/);
    assert.match(gs, /_getRowsCachedOptional\('BeritaAcaraAdminPeserta'\)/);
  });
  it('kegagalan lampiran BA tidak mengosongkan seluruh laporan', () => {
    assert.match(gs, /catch \(baError\) \{/);
    assert.match(gs, /row\.baPendukung = \[\];/);
    assert.match(gs, /row\.baPelaksanaan = \[\];/);
  });
  it('menggabungkan BA Bagian dan BA Admin', () => {
    assert.match(gs, /const baAdmin = _getRowsOptional\('BeritaAcaraAdmin'\);/);
    assert.match(gs, /toBaRef\(r, 'Bagian', baPesertaMap\)/);
    assert.match(gs, /toBaRef\(r, 'Admin', baAdminPesertaMap\)/);
    assert.match(gs, /_attachBaToLaporanRows\(rows, baRefs, getMasterOptions\('Lab'\)\);/);
  });
});

import { readFileSync as readBusiness } from 'node:fs';
const business = readBusiness(new URL('../1_business.gs', import.meta.url), 'utf8');
describe('bootstrap daftar BA dan jadwal', () => {
  it('mengirim BA pendukung dan jadwal terpisah', () => {
    assert.match(business, /const beritaAcaraAdmin = baAdmin/);
    assert.match(business, /beritaAcaraAdmin: beritaAcaraAdmin/);
    assert.match(business, /jadwal: jadwal/);
    assert.match(business, /dosenOptions: getMasterOptions\('Dosen'\)/);
  });
});

describe('hapus pengajuan membersihkan peserta BA', () => {
  it('menyimpan ID Pengajuan pada peserta BA', () => {
    assert.match(code, /BeritaAcaraPeserta: \[[\s\S]*?'ID Pengajuan'/);
    assert.match(code, /BeritaAcaraAdminPeserta: \[[\s\S]*?'ID Pengajuan'/);
  });
  it('deletePengajuanAdmin menghapus peserta BA dan BA kosong', () => {
    assert.match(gs, /function _cleanupBaForPengajuan\(/);
    assert.match(gs, /deletePengajuanAdmin[\s\S]*?_cleanupBaForPengajuan\(/);
    assert.match(gs, /'BeritaAcaraAdminPeserta'/);
    assert.match(gs, /'BeritaAcaraPeserta'/);
  });
});
