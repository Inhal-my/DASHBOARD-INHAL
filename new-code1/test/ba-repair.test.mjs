import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const business = readFileSync(new URL('../1_business.gs', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../pages/dashboard.html', import.meta.url), 'utf8');

describe('RPC perbaikan jadwal/BA GAS', () => {
  it('menyediakan RPC baca, simpan, dan buat jadwal dari BA', () => {
    assert.match(business, /function getBaRepairData\(payload\) \{/);
    assert.match(business, /function applyBaRepair\(payload\) \{/);
    assert.match(business, /function createJadwalFromBa\(payload\) \{/);
    assert.match(business, /requireAuthorized\(arguments\[arguments\.length - 1\]\);/);
  });

  it('mengelompokkan kegiatan dari jadwal dan BA dengan kunci kegiatan', () => {
    assert.match(business, /_baRepairText\(j\.kegiatan_key\) \|\| _kegiatanKey\(j\.Bagian, j\.Blok, j\.NamaKegiatan\)/);
    assert.match(business, /const key = _baRowKey\(r\);/);
    assert.match(business, /jadwalCount: 0/);
    assert.match(business, /archivedCount: 0/);
  });

  it('membangun kandidat peserta dari pengajuan yang sesuai kegiatan', () => {
    assert.match(business, /allowedStatuses\.indexOf\(status\) === -1/);
    assert.match(business, /_resolveBagian12\(jenis, pilihan, kegiatan, labs\)/);
    assert.match(business, /sourceJadwal: sourceJadwal/);
    assert.match(business, /baIds: \(baIdsByPid\[pid\] \|\| \[\]\)\.slice\(\)/);
  });

  it('menolak BA arsip serta memeriksa revisi optimistis', () => {
    assert.match(business, /BA ini berada di arsip\. Pulihkan dulu sebelum diperbaiki\./);
    assert.match(business, /_baRevisionOk\(existing, p\.expectedRevision\)/);
    assert.match(business, /Data BA sudah berubah\. Muat ulang lalu ulangi\./);
  });

  it('memvalidasi peserta pengganti dengan helper BA yang sudah ada', () => {
    assert.match(business, /_resolveBaPesertaByIds\(addIds, existing\)/);
    assert.match(business, /_validateBaPesertaStatus\(resolved\.peserta\)/);
    assert.match(business, /_baRepairOtherBaMap\(baId, key\)/);
    assert.match(business, /sudah tercatat di BA/);
  });

  it('mencegah dua BA aktif memakai jadwal yang sama', () => {
    assert.match(business, /Jadwal ' \+ linkJadwalId \+ ' sudah ditautkan ke BA lain\./);
    assert.match(business, /_baRepairText\(r\['BA ID'\]\) === baId/);
  });

  it('memindahkan peserta antar jadwal dan memperbarui pengajuan', () => {
    assert.match(business, /_deleteRowsByMatch\('JadwalPeserta'/);
    assert.match(business, /appendRowSafe\('JadwalPeserta'/);
    assert.match(business, /updateRowByKey\('Pengajuan', 'ID Pengajuan', pid/);
  });

  it('menyimpan perubahan ke BeritaAcara dan menulis audit', () => {
    assert.match(business, /appendRowSafe\('BeritaAcaraPeserta'/);
    assert.match(business, /_baWriteColumns\(baId, patch\);/);
    assert.match(business, /action: 'BA_REPAIR'/);
    assert.match(business, /Perbaikan peserta dan sesi BA/);
  });

  it('membuat jadwal baru dari BA yang belum punya sesi', () => {
    assert.match(business, /BA ini sudah memiliki sesi jadwal\./);
    assert.match(business, /generateJadwalId\(ss\.getSheetByName\('JadwalPelaksanaan'\)\)/);
    assert.match(business, /ensureSheetWithHeaders\(ss, 'JadwalPeserta', SCHEMAS\.JadwalPeserta\)/);
    assert.match(business, /Jadwal ' \+ jadwalId \+ ' dibuat dan ditautkan ke BA/);
  });
});

describe('Panel admin Edit Jadwal/BA GAS', () => {
  it('mendaftarkan kartu dan state panel', () => {
    assert.match(dashboard, /\{ key: 'editJadwalBa', title: 'Edit Jadwal\/BA'/);
    assert.match(dashboard, /repair: \{ groups: \[\], bagianOptions: \[\]/);
    assert.match(dashboard, /activeMasterCard\.key === 'editJadwalBa'/);
  });

  it('memuat data saat kartu dipilih dan menyediakan metode aksi', () => {
    assert.match(dashboard, /if \(key === 'editJadwalBa' && !this\.master\.repair\.loaded\) this\.loadBaRepair\(\);/);
    assert.match(dashboard, /async loadBaRepair\(force\)/);
    assert.match(dashboard, /async saveBaRepair\(\)/);
    assert.match(dashboard, /async submitCreateJadwalFromBa\(\)/);
    assert.match(dashboard, /async submitBaRepairAction\(\)/);
  });

  it('memanggil RPC perbaikan yang tepat', () => {
    assert.match(dashboard, /this\.run\('getBaRepairData'/);
    assert.match(dashboard, /this\.run\('applyBaRepair'/);
    assert.match(dashboard, /this\.run\('createJadwalFromBa'/);
    assert.match(dashboard, /this\.run\('mergeBeritaAcara'/);
    assert.match(dashboard, /this\.run\('archiveBeritaAcara'/);
    assert.match(dashboard, /this\.run\('restoreBeritaAcara'/);
  });

  it('menampilkan filter, daftar BA, dan kandidat peserta', () => {
    assert.match(dashboard, /Tampilkan BA arsip/);
    assert.match(dashboard, /v-for="g in master\.repair\.groups"/);
    assert.match(dashboard, /v-for="b in master\.repair\.workspace\.ba"/);
    assert.match(dashboard, /v-for="c in baRepairCandidates"/);
    assert.match(dashboard, /Tambah peserta dari pengajuan\/jadwal lain/);
  });

  it('menggunakan satu sesi jadwal per BA sesuai model GAS', () => {
    assert.match(dashboard, /<option value="">Tanpa sesi jadwal<\/option>/);
    assert.match(dashboard, /Sesi jadwal BA/);
    assert.match(dashboard, /Satu BA tertaut ke satu sesi jadwal\./);
  });

  it('menyediakan tindakan arsip, gabung, dan pulihkan', () => {
    assert.match(dashboard, /Arsipkan BA/);
    assert.match(dashboard, /Gabungkan BA/);
    assert.match(dashboard, /Pulihkan BA/);
    assert.match(dashboard, /Alasan minimal 10 karakter/);
    assert.match(dashboard, /Centang konfirmasi hardcopy terlebih dahulu\./);
  });
});
