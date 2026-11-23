import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const business = readFileSync(new URL('../1_business.gs', import.meta.url), 'utf8');
const bagianHtml = readFileSync(new URL('../pages/bagian.html', import.meta.url), 'utf8');

describe('grouping kegiatan lintas tanggal GAS', () => {
  it('mengelompokkan peserta tanpa memecah per tanggal', () => {
    assert.match(bagianHtml, /const key = \[r\.jenis, r\.pilihan, r\.detail, r\.blok\]\.join\('\|'\);/);
    assert.match(bagianHtml, /tanggalList: \[\]/);
    assert.match(bagianHtml, /tanggalLabel: ''/);
  });

  it('menandai NPM ganda tanpa menggabungkan pengajuan', () => {
    assert.match(bagianHtml, /npmCounts: \{\}/);
    assert.match(bagianHtml, /adaNpmGanda: false/);
    assert.match(bagianHtml, /p\.npmGanda = true;/);
    assert.match(bagianHtml, /g\.adaNpmGanda = true;/);
    assert.match(bagianHtml, /Tanggal belum diisi/);
  });
});

describe('form BA menampilkan peserta belum dijadwalkan', () => {
  it('menyediakan daftar peserta belum dijadwalkan dan sesi target', () => {
    assert.match(bagianHtml, /baUnscheduled\(\) \{/);
    assert.match(bagianHtml, /baUnscheduledSelected\(\) \{/);
    assert.match(bagianHtml, /baTargetSesi\(\) \{/);
    assert.match(bagianHtml, /baPesertaTerjadwal\(\) \{/);
    assert.match(bagianHtml, /v-for="p in baPesertaTerjadwal"/);
    assert.match(bagianHtml, /v-for="p in baUnscheduled"/);
  });

  it('mengirim flag auto-jadwal saat ada peserta belum dijadwalkan dipilih', () => {
    assert.match(bagianHtml, /autoJadwalkanBelumDijadwalkan: this\.baUnscheduledSelected\.length > 0/);
  });
});

describe('backend auto-jadwal peserta belum dijadwalkan', () => {
  it('menyediakan helper id peserta terjadwal per kegiatan', () => {
    assert.match(business, /function _jadwalScheduledIdsForKegiatan\(kegiatanKey\)/);
    assert.match(business, /_kegiatanKey\(j\.Bagian, j\.Blok, j\['Nama Kegiatan'\]\)/);
  });

  it('menyisipkan peserta belum dijadwalkan ke jadwal terpilih saat buat BA', () => {
    assert.match(business, /payload\.autoJadwalkanBelumDijadwalkan === true \|\| payload\.autoJadwalkanBelumDijadwalkan === 'true'/);
    assert.match(business, /appendRowSafe\('JadwalPeserta', \{/);
    assert.match(business, /'Jadwal ID': jadwalId/);
    assert.match(business, /peserta otomatis dijadwalkan/);
  });
});
