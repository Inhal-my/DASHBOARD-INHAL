import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const business = readFileSync(new URL('../1_business.gs', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../pages/dashboard.html', import.meta.url), 'utf8');

const rows = {
  Pengajuan: [
    { 'ID Pengajuan': 'INHAL-1', NPM: '2201010001', 'Nama Lengkap': 'Aisyah', Blok: 'A', Status: 'ACC' },
    { 'ID Pengajuan': 'INHAL-2', NPM: '2201010002', 'Nama Lengkap': 'Budi', Blok: 'A', Status: 'ACC' },
    { 'ID Pengajuan': 'INHAL-9', NPM: '2201010009', 'Nama Lengkap': 'Lain', Blok: 'A', Status: 'ACC' }
  ],
  DetailKegiatan: [
    { 'ID Pengajuan': 'INHAL-1', 'Jenis Kegiatan': 'SGD', Pilihan: 'SGD 1', Detail: '' },
    { 'ID Pengajuan': 'INHAL-2', 'Jenis Kegiatan': 'SGD', Pilihan: 'SGD 1', Detail: '' },
    { 'ID Pengajuan': 'INHAL-9', 'Jenis Kegiatan': 'SGD', Pilihan: 'SGD 2', Detail: '' }
  ]
};

function loadResolver() {
  const start = business.indexOf('function _resolveBaPesertaByIds');
  const end = business.indexOf('function updateBeritaAcaraBagian', start);
  assert.ok(start >= 0 && end > start, 'helper resolusi peserta BA harus tersedia');
  const factory = new Function(
    'getAllRows',
    'getMasterOptions',
    '_resolveBagian12',
    '_kegiatanKey',
    business.slice(start, end) + '\nreturn { _resolveBaPesertaByIds };'
  );
  return factory(
    (name) => rows[name] || [],
    () => [],
    (jenis) => String(jenis || ''),
    (bagian, blok, nama) => [bagian, blok, nama].map((v) => String(v || '').toLowerCase().replace(/\s+/g, ' ').trim()).join('|')
  );
}

const ba = { Bagian: 'SGD', Blok: 'A', 'Nama Kegiatan': 'SGD 1' };

describe('edit peserta BA Pelaksanaan GAS', () => {
  it('mengambil peserta sekegiatan dan menolak peserta kegiatan lain', () => {
    const { _resolveBaPesertaByIds } = loadResolver();
    const ok = _resolveBaPesertaByIds(['INHAL-1', 'INHAL-2', 'INHAL-1'], ba);
    assert.equal(ok.ids.length, 2);
    assert.equal(ok.peserta.length, 2);
    assert.equal(ok.problems.length, 0);

    const beda = _resolveBaPesertaByIds(['INHAL-9'], ba);
    assert.equal(beda.peserta.length, 0);
    assert.match(beda.problems[0], /kegiatan tidak sesuai/);

    const hilang = _resolveBaPesertaByIds(['INHAL-X'], ba);
    assert.deepEqual(hilang.missing, ['INHAL-X']);
  });

  it('memperbarui daftar peserta dan jumlah pada BA', () => {
    assert.match(business, /if \(p\.pesertaIds !== undefined\)/);
    assert.match(business, /_resolveBaPesertaByIds\(p\.pesertaIds, existing\)/);
    assert.match(business, /merged\['Jumlah Peserta'\] = pesertaBaru\.length/);
    assert.match(business, /deleteRowByKey\('BeritaAcaraPeserta', 'BA ID', id/);
    assert.match(business, /appendRowSafe\('BeritaAcaraPeserta'/);
    assert.match(business, /invalidateSheetCache\('BeritaAcaraPeserta'\)/);
  });

  it('menampilkan checklist peserta di modal Kelola BA dashboard', () => {
    assert.match(dashboard, /pesertaIds: \[\], pesertaOpsi: \[\]/);
    assert.match(dashboard, /pesertaOpsi: opsi/);
    assert.match(dashboard, /payload\.pesertaIds = k\.pesertaIds\.slice\(\)/);
    assert.match(dashboard, /Mengubah peserta tidak mengubah isi file PDF\./);
  });
});
