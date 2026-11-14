import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const code = read('../0_code.gs');
const business = read('../1_business.gs');
const parity = read('../4_parity.gs');

describe('parity backend GAS dengan CF', () => {
  it('menyediakan login admin Google dan verifikasi ulang email pada sesi', () => {
    assert.match(parity, /function authenticateAdminGoogle/);
    assert.match(parity, /auth: 'google'/);
    assert.match(code, /s\.auth === 'google'/);
    assert.match(code, /getCurrentUserEmail\(\)/);
    assert.match(code, /email !== sessionEmail/);
  });

  it('memvalidasi daftar dosen terhadap Master Dosen dan batas lima dosen', () => {
    assert.match(parity, /function _resolveDosenForWrite/);
    assert.match(parity, /MAX_DOSEN/);
    assert.match(parity, /Master Dosen/);
    assert.match(parity, /function _masterDosenCanonicalMap/);
  });

  it('menulis relasi JadwalDosen dan BaDosen saat menyimpan jadwal/BA', () => {
    assert.match(business, /_writeDosenRelation\('JadwalDosen', 'Jadwal ID', jadwalId/);
    assert.match(business, /_writeDosenRelation\('JadwalDosen', 'Jadwal ID', id/);
    assert.match(business, /_writeDosenRelation\('BaDosen', 'BA ID', baId/);
    assert.match(business, /_writeDosenRelation\('BaDosen', 'BA ID', id/);
  });

  it('mendukung multi sesi BA lewat BeritaAcaraSesi dan fallback Jadwal ID', () => {
    assert.match(parity, /function _resolveBaSesiForWrite/);
    assert.match(parity, /function _writeBaSesiRelation/);
    assert.match(business, /_writeBaSesiRelation\(baId, jadwalIds/);
    assert.match(business, /_writeBaSesiRelation\(id, sesiRes\.ids/);
    assert.match(business, /BeritaAcaraSesi/);
  });

  it('mengunci jadwal yang sudah terhubung ke BA baik langsung maupun sesi', () => {
    assert.match(business, /function _jadwalHasBa/);
    assert.match(business, /getAllRows\('BeritaAcaraSesi'\)/);
    assert.match(parity, /function _jadwalBaId/);
  });

  it('menyimpan PDF BA bersama dengan scope shared dan menonaktifkan versi lama', () => {
    assert.match(parity, /function setBaAdminSharedFile/);
    assert.match(parity, /function removeBaAdminSharedFile/);
    assert.match(parity, /'Scope': 'shared'/);
    assert.match(business, /'Scope': 'peserta'/);
    assert.match(business, /sharedFiles: sharedFiles/);
  });

  it('mengirim notifikasi ACC pada bootstrap bagian', () => {
    assert.match(business, /notifikasiList: \[\]/);
    assert.match(business, /out\.notifikasiList = _computeBagianNotifikasi/);
    assert.match(parity, /function _computeBagianNotifikasi/);
  });

  it('menyediakan kalender lintas bagian dengan penanda bentrok', () => {
    assert.match(parity, /function getKalenderBagianPelaksanaan/);
    assert.match(parity, /function _kalenderMarkBentrok/);
    assert.match(parity, /pesertaBentrok/);
  });

  it('menyediakan activity log admin dengan filter dan pagination', () => {
    assert.match(parity, /function getActivityLog/);
    assert.match(parity, /AuditLog/);
    assert.match(parity, /perPage/);
    assert.match(parity, /_activityKind/);
  });

  it('menyediakan preview dan rename master Blok beserta propagasi data', () => {
    assert.match(parity, /function previewMasterRename/);
    assert.match(parity, /function renameMasterValue/);
    assert.match(parity, /PARITY_BLOK_REF_SHEETS/);
    assert.match(parity, /PARITY_KEGIATAN_KEY_SHEETS/);
    assert.match(parity, /RENAME_MASTER/);
  });

  it('menyediakan hapus draft BA bagian dan pelengkapan BA', () => {
    assert.match(parity, /function deleteDraftBeritaAcaraBagian/);
    assert.match(parity, /hanya dapat dihapus oleh admin dashboard/);
    assert.match(parity, /function lengkapiBeritaAcaraBagian/);
    assert.match(parity, /_saveFileToDrive/);
  });

  it('menyediakan ekspor database tanpa kolom sensitif', () => {
    assert.match(parity, /function getDatabaseExport/);
    assert.match(parity, /PARITY_SENSITIVE_COLUMNS/);
    assert.match(parity, /Password: true/);
    assert.match(parity, /Pass: true/);
  });

  it('menyediakan alias RPC BA admin yang dipakai UI CF', () => {
    ['baAdminUploadBerkas', 'baAdminAddPesertaBerkas', 'baAdminRemovePeserta', 'baAdminDetail', 'baAdminSaveMergedPdf', 'baAdminGetFileBase64'].forEach((fn) => {
      assert.match(parity, new RegExp('function ' + fn + '\\('));
    });
  });
});
