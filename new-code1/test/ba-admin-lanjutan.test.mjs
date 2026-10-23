import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const code = readFileSync(new URL('../0_code.gs', import.meta.url), 'utf8');
const business = readFileSync(new URL('../1_business.gs', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../pages/dashboard.html', import.meta.url), 'utf8');

describe('BA Pendukung lanjutan GAS', () => {
  it('menyimpan dokumen dasar, kebutuhan regenerate, dan berkas per peserta', () => {
    assert.match(code, /BeritaAcaraAdmin: \[[\s\S]*?'Kegiatan Key'[\s\S]*?'Base File URL'[\s\S]*?'Base File Name'[\s\S]*?'Needs Regen'/);
    assert.match(code, /BeritaAcaraAdminPeserta: \[[\s\S]*?'Urutan'[\s\S]*?'Active'/);
    assert.match(code, /BeritaAcaraAdminBerkas: \[/);
    assert.match(code, /'Page Index'/);
    assert.match(code, /'File URL'/);
  });

  it('menyediakan backend kelola peserta, dokumen dasar, dan PDF gabungan', () => {
    assert.match(business, /function getBaAdminDetail\(/);
    assert.match(business, /function setBaAdminBaseFile\(/);
    assert.match(business, /function removeBaAdminBaseFile\(/);
    assert.match(business, /function addBaAdminPesertaBerkas\(/);
    assert.match(business, /function removeBaAdminPeserta\(/);
    assert.match(business, /function getBaAdminFileBase64\(/);
    assert.match(business, /function saveBaAdminMergedPdf\(/);
  });

  it('upload BA lama menautkan kegiatan dan menghapus BA ikut membersihkan berkas', () => {
    assert.match(business, /'Kegiatan Key': _kegiatanKey\(/);
    assert.match(business, /deleteBeritaAcaraAdmin[\s\S]*?BeritaAcaraAdminBerkas/);
    assert.match(business, /_cleanupBaForPengajuan[\s\S]*?BeritaAcaraAdminBerkas/);
  });

  it('dashboard menyediakan modal kelola BA Pendukung dan perakit PDF di browser', () => {
    assert.match(dashboard, /pdf-lib/);
    assert.match(dashboard, /baManage\.open/);
    assert.match(dashboard, /function mergeBaPdfFiles\(/);
    assert.match(dashboard, /getBaAdminDetail/);
    assert.match(dashboard, /addBaAdminPesertaBerkas/);
    assert.match(dashboard, /saveBaAdminMergedPdf/);
    assert.match(dashboard, /saveBaManageInfo/);
    assert.match(dashboard, /updateBeritaAcaraAdmin/);
    assert.match(dashboard, /baManage\.edit\.tanggal/);
  });
});
