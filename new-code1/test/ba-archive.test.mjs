import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const code = readFileSync(new URL('../0_code.gs', import.meta.url), 'utf8');
const business = readFileSync(new URL('../1_business.gs', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../pages/dashboard.html', import.meta.url), 'utf8');

describe('skema & migrasi arsip BA GAS', () => {
  it('menambah kolom arsip dan revisi pada skema BeritaAcara', () => {
    assert.match(code, /'Archived At',\s*'Archived By',\s*'Archive Reason',\s*'Merged Into',\s*'Updated At',\s*'Revision'/);
  });

  it('menyediakan migrasi idempotent dan memanggilnya saat bootstrap', () => {
    assert.match(business, /function _ensureBaArchiveMigration\(\)/);
    assert.match(business, /_getConfigValue\('BA_ARCHIVE_MIGRATED', ''\) === '1'/);
    assert.match(business, /_setConfigValue\('BA_ARCHIVE_MIGRATED', '1'\)/);
    assert.match(business, /_ensurePaymentGateMigration\(\);\s*_ensureBaArchiveMigration\(\);/);
  });
});

describe('RPC arsip/gabung/pulihkan BA GAS', () => {
  it('archiveBeritaAcara memvalidasi alasan, hardcopy, dan revisi', () => {
    assert.match(business, /function archiveBeritaAcara\(payload\)/);
    assert.match(business, /Alasan arsip minimal 10 karakter\./);
    assert.match(business, /Centang konfirmasi hardcopy sebelum mengarsipkan BA\./);
    assert.match(business, /Data BA sudah berubah\. Muat ulang lalu ulangi\./);
    assert.match(business, /action: 'BA_ARCHIVE'/);
  });

  it('mergeBeritaAcara hanya untuk kegiatan sama dan memindahkan peserta', () => {
    assert.match(business, /function mergeBeritaAcara\(payload\)/);
    assert.match(business, /Penggabungan hanya boleh untuk BA dengan kegiatan yang sama\./);
    assert.match(business, /BA tujuan berada di arsip dan tidak bisa menerima peserta\./);
    assert.match(business, /action: 'BA_MERGE'/);
    assert.match(business, /'Merged Into': targetId/);
  });

  it('restoreBeritaAcara mendeteksi bentrok peserta/sesi', () => {
    assert.match(business, /function restoreBeritaAcara\(payload\)/);
    assert.match(business, /BA tidak bisa dipulihkan karena bentrok: /);
    assert.match(business, /action: 'BA_RESTORE'/);
  });

  it('getBaArchiveList hanya mengembalikan BA Bagian yang diarsipkan', () => {
    assert.match(business, /function getBaArchiveList\(\)/);
    assert.match(business, /_baSumber\(r\) === 'Bagian' && _baIsArchived\(r\)/);
  });
});

describe('pembacaan aktif menyembunyikan BA arsip', () => {
  it('daftar BA, jadwal, statistik, laporan, dan agregasi memfilter arsip', () => {
    assert.match(business, /return _baSumber\(r\) === 'Bagian' && !_baIsArchived\(r\);/);
    assert.match(business, /if \(_baIsArchived\(b\)\) return;\s*const jid = String\(b\['Jadwal ID'\]/);
    assert.match(business, /if \(_baIsArchived\(r\)\) return false;\s*return String\(r\['Jadwal ID'\]/);
    assert.match(business, /if \(_baIsArchived\(b\)\) return;\s*const bagian = _normBagianAggregateWithLabs/);
    assert.match(business, /_baSumber\(r\) === 'Bagian' && !_baIsArchived\(r\)/);
    assert.match(business, /return sumber !== 'Bagian' \|\| !_baIsArchived\(r\);/);
  });

  it('agregasi BA membawa revisi dan status arsip', () => {
    assert.match(business, /revision: _baRevisionOf\(r\),/);
    assert.match(business, /archived: _baIsArchived\(r\),/);
    assert.match(business, /mergedInto: String\(c\['Merged Into'\] \|\| ''\)\.trim\(\),/);
  });
});

describe('UI arsip BA GAS', () => {
  it('kelola BA punya state tindakan arsip/gabung', () => {
    assert.match(dashboard, /revision: 0, mergeTargets: \[\]/);
    assert.match(dashboard, /openKelolaAction\(mode\)/);
    assert.match(dashboard, /submitKelolaAction\(\)/);
    assert.match(dashboard, /mergeBeritaAcara/);
    assert.match(dashboard, /archiveBeritaAcara/);
  });

  it('tombol hapus BA Bagian dialihkan ke arsip, bukan hapus permanen', () => {
    assert.match(dashboard, /if \(!isAdminBa\) \{\s*await this\.archiveBaRecord\(baId\);\s*return;/);
    assert.match(dashboard, /this\.run\('deleteBeritaAcaraAdmin', baId\)/);
    assert.doesNotMatch(dashboard, /this\.run\(isAdminBa \? 'deleteBeritaAcaraAdmin' : 'deleteBeritaAcaraBagian'/);
  });

  it('panel BA Terarsip memuat dan memulihkan BA', () => {
    assert.match(dashboard, /baArchive: \{ open: false, loading: false, busy: false, rows: \[\] \}/);
    assert.match(dashboard, /toggleBaArchive\(\)/);
    assert.match(dashboard, /this\.run\('getBaArchiveList'\)/);
    assert.match(dashboard, /this\.run\('restoreBeritaAcara'/);
    assert.match(dashboard, /BA Terarsip/);
  });
});
