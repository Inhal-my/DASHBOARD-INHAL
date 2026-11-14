import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const code = readFileSync(new URL('../0_code.gs', import.meta.url), 'utf8');
const gs = readFileSync(new URL('../1_business.gs', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../3_drive_bridge.gs', import.meta.url), 'utf8');

function schemaBlock(name) {
  const start = code.indexOf('    ' + name + ': [');
  assert.notEqual(start, -1, 'schema ' + name + ' tidak ditemukan');
  const end = code.indexOf('\n    ],', start);
  assert.notEqual(end, -1, 'akhir schema ' + name + ' tidak ditemukan');
  return code.slice(start, end);
}

function helperFactory() {
  const start = gs.indexOf('const MAX_DOSEN');
  const end = gs.indexOf('function registerPengajuan', start);
  assert.ok(start !== -1 && end > start, 'blok helper dosen tidak ditemukan');
  const block = gs.slice(start, end);
  return new Function(
    '_getRowsOptional',
    block + '\nreturn {' +
      '_normalizeDosenList, _splitLegacyDosen, _relationalDosenNames,' +
      '_loadJadwalDosenList, _loadBaDosenList, _loadBaSesiIds, _loadBaSesiMap' +
      '};'
  );
}

describe('parity data model GAS dengan CF', () => {
  it('menambah sheet relasi dosen dan sesi', () => {
    ['JadwalDosen', 'BaDosen', 'BeritaAcaraSesi'].forEach((name) => {
      assert.ok(code.includes('    ' + name + ': ['), 'schema ' + name + ' belum ada');
    });
    assert.match(schemaBlock('JadwalDosen'), /'Nama Key'/);
    assert.match(schemaBlock('JadwalDosen'), /'Urutan'/);
    assert.match(schemaBlock('BaDosen'), /'BA ID'/);
    assert.match(schemaBlock('BeritaAcaraSesi'), /'Jadwal ID'/);
  });

  it('menambah kolom Form Key pada Pengajuan', () => {
    assert.match(schemaBlock('Pengajuan'), /'Form Key'/);
  });

  it('menambah kolom Email admin untuk login Google', () => {
    assert.match(schemaBlock('Admin'), /'Email'/);
  });

  it('menambah Updated At dan Scope pada BA admin', () => {
    assert.match(schemaBlock('BeritaAcaraAdmin'), /'Updated At'/);
    assert.match(schemaBlock('BeritaAcaraAdminBerkas'), /'Scope'/);
  });

  it('menyediakan seed email admin tanpa menghapus password', () => {
    ['devisafriyani@umsu.ac.id', 'yudhasudira@umsu.ac.id', 'desiisnayanti@umsu.ac.id'].forEach((email) => {
      assert.ok(code.includes(email), 'email seed tidak ditemukan: ' + email);
    });
    assert.match(code, /function seedAdminEmails\(\)/);
    assert.match(code, /sheet\.getRange\(byName\[namaKey\], iEmail \+ 1\)\.setValue\(email\)/);
  });

  it('menyimpan Form Key saat membuat pengajuan', () => {
    assert.match(gs, /'Form Key': _buildPengajuanKey\(formData\)/);
  });

  it('memeriksa Form Key lebih dulu, lalu fallback baris lama', () => {
    assert.match(gs, /const storedKey = String\(pengajuans\[i\]\['Form Key'\] \|\| ''\)\.trim\(\)/);
    assert.match(gs, /if \(String\(p\['Form Key'\] \|\| ''\)\.trim\(\)\) continue;/);
  });
});

describe('helper relasi dosen dan sesi', () => {
  it('menormalkan daftar dosen, unik, maksimal 5', () => {
    const f = helperFactory()(() => []);
    const list = f._normalizeDosenList(['dr. Andi', ' DR. ANDI ', 'dr. Budi', 'Dr. Citra', 'dr. Ani', 'dr. Eka', 'dr. Fajar']);
    assert.deepEqual(list, ['dr. Andi', 'dr. Budi', 'Dr. Citra', 'dr. Ani', 'dr. Eka']);
  });

  it('membaca fallback dosen lama yang dipisah koma/titik koma', () => {
    const f = helperFactory()(() => []);
    assert.deepEqual(f._splitLegacyDosen('dr. Andi, dr. Budi; Dr. Citra'), ['dr. Andi', 'dr. Budi', 'Dr. Citra']);
  });

  it('mengutamakan tabel relasi dan mengurutkan berdasarkan Urutan', () => {
    const rows = [
      { 'Jadwal ID': 'JDW-1', Nama: 'dr. Budi', Urutan: 2 },
      { 'Jadwal ID': 'JDW-1', Nama: 'dr. Andi', Urutan: 1 },
      { 'Jadwal ID': 'JDW-2', Nama: 'dr. Citra', Urutan: 1 }
    ];
    const f = helperFactory()(() => []);
    assert.deepEqual(f._relationalDosenNames(rows, 'Jadwal ID', 'JDW-1', 'dr. Lama'), ['dr. Andi', 'dr. Budi']);
  });

  it('memakai fallback kolom lama bila tabel relasi kosong', () => {
    const f = helperFactory()(() => []);
    assert.deepEqual(f._relationalDosenNames([], 'BA ID', 'BA-1', 'dr. Andi, dr. Budi'), ['dr. Andi', 'dr. Budi']);
  });

  it('membaca sesi BA dari tabel relasi atau fallback Jadwal ID', () => {
    const withRows = helperFactory()((name) => {
      if (name !== 'BeritaAcaraSesi') return [];
      return [
        { 'BA ID': 'BA-1', 'Jadwal ID': 'JDW-2', Urutan: 2 },
        { 'BA ID': 'BA-1', 'Jadwal ID': 'JDW-1', Urutan: 1 },
        { 'BA ID': 'BA-1', 'Jadwal ID': 'JDW-1', Urutan: 3 }
      ];
    });
    assert.deepEqual(withRows._loadBaSesiIds('BA-1', 'JDW-LAMA'), ['JDW-1', 'JDW-2']);

    const withoutRows = helperFactory()(() => []);
    assert.deepEqual(withoutRows._loadBaSesiIds('BA-1', 'JDW-LAMA'), ['JDW-LAMA']);
  });

  it('mengelompokkan sesi per BA', () => {
    const f = helperFactory()((name) => {
      if (name !== 'BeritaAcaraSesi') return [];
      return [
        { 'BA ID': 'BA-1', 'Jadwal ID': 'JDW-1' },
        { 'BA ID': 'BA-1', 'Jadwal ID': 'JDW-2' },
        { 'BA ID': 'BA-2', 'Jadwal ID': 'JDW-3' }
      ];
    });
    assert.deepEqual(f._loadBaSesiMap(), { 'BA-1': ['JDW-1', 'JDW-2'], 'BA-2': ['JDW-3'] });
  });
});

describe('perlindungan bridge CF', () => {
  it('tetap menyediakan helper PDF dan Drive yang dipakai bridge', () => {
    assert.match(gs, /function _createPdfFromTemplate\(/);
    assert.match(gs, /function _saveBlobToDrive\(/);
    assert.match(gs, /function _renderPdfTemplateHtml\(/);
  });

  it('tetap menyediakan seluruh aksi bridge', () => {
    ['saveFile', 'trashFile', 'getFile', 'sendStatusEmail', 'sendFinalEmail', 'sendFinalToBagian', 'sendReceiptEmail']
      .forEach((action) => {
        assert.ok(bridge.includes("action === '" + action + "'"), 'aksi bridge hilang: ' + action);
      });
  });
});
