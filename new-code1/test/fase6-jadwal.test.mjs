import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const code = read('../0_code.gs');
const business = read('../1_business.gs');

describe('fase 6 jadwal dan normalisasi status', () => {
  it('menormalkan jam menjadi HH:mm agar tidak tampil 1899-12-30', () => {
    assert.match(code, /function _clientTime/);
    assert.match(code, /Utilities\.formatDate/);
    assert.match(business, /Jam: _clientTime\(j\.Jam\)/);
    assert.match(business, /Jam: _clientTime\(r\.Jam\)/);
  });

  it('menyiapkan schema jadwal dan kolom Jadwal ID pada berita acara', () => {
    assert.match(code, /JadwalPelaksanaan:/);
    assert.match(code, /JadwalPeserta:/);
    assert.match(code, /'Jadwal ID'/);
  });

  it('menghapus status Diterima dari konstanta STATUS', () => {
    assert.doesNotMatch(code, /DITERIMA:/);
    assert.match(code, /ACC:\s*'ACC'/);
  });

  it('menyediakan backend simpan, ubah, batal, dan daftar jadwal', () => {
    assert.match(business, /function getJadwalList/);
    assert.match(business, /function saveJadwalPelaksanaan/);
    assert.match(business, /function updateJadwalPelaksanaan/);
    assert.match(business, /function cancelJadwalPelaksanaan/);
    assert.match(business, /function generateJadwalId/);
  });

  it('mengaitkan berita acara ke jadwal dan mengunci jadwal yang sudah punya BA', () => {
    assert.match(business, /payload\.jadwalId/);
    assert.match(business, /_jadwalHasBa/);
    assert.match(business, /'Jadwal ID': jadwalId/);
  });

  it('menyediakan migrasi manual normalisasi Diterima ke ACC', () => {
    assert.match(business, /function migrateFase6StatusDanJadwal/);
    assert.match(business, /MIGRATE_FASE6/);
    assert.match(business, /=== 'Diterima'/);
  });

  it('halaman tidak lagi memakai status Diterima', () => {
    ['../pages/bagian.html', '../pages/portal.html', '../pages/dashboard.html', '../pages/detail-laporan.html'].forEach((p) => {
      const html = read(p).split('Nominal Diterima').join('');
      assert.doesNotMatch(html, /Diterima/);
    });
  });
});
