import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../pages/index.html', import.meta.url), 'utf8');
const business = readFileSync(new URL('../1_business.gs', import.meta.url), 'utf8');

describe('form praktikum satu kegiatan', () => {
  it('tidak ada tombol tambah lab', () => {
    assert.doesNotMatch(html, /addLab/);
    assert.doesNotMatch(html, /Tambah Lab/);
    assert.doesNotMatch(html, /maxLab/);
  });
  it('tidak ada tombol hapus baris lab', () => {
    assert.doesNotMatch(html, /removeLab/);
    assert.doesNotMatch(html, /bi-trash/);
  });
  it('hanya satu baris lab dan grid tanggal melebar', () => {
    assert.match(html, /labs: \[\{ lab: '', kegiatanLab: '', tanggal: '' \}\]/);
    assert.doesNotMatch(html, /sm:col-span-1/);
    assert.doesNotMatch(html, /sm:col-span-3/);
  });
});

describe('penjaga server praktikum', () => {
  it('_buildDetailKegiatanRows memakai baris praktikum pertama', () => {
    assert.doesNotMatch(business, /formData\.praktikum\.forEach\(/);
    assert.match(business, /formData\.praktikum\.find\(/);
  });
  it('_buildPengajuanKey memakai baris praktikum pertama', () => {
    assert.doesNotMatch(business, /formData\.praktikum\.map\(/);
    const finds = business.match(/formData\.praktikum\.find\(/g) || [];
    assert.equal(finds.length, 2);
  });
});
