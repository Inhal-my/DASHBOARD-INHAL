import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const code = readFileSync(new URL('../0_code.gs', import.meta.url), 'utf8');
const business = readFileSync(new URL('../1_business.gs', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../pages/dashboard.html', import.meta.url), 'utf8');

describe('status Disetujui dan payment gate GAS', () => {
  it('menambahkan status Disetujui dan kolom Payment Gate Exempt', () => {
    assert.match(code, /DISETUJUI:\s*'Disetujui'/);
    assert.match(code, /'Payment Gate Exempt'/);
  });

  it('menyediakan helper gate pembayaran', () => {
    assert.match(business, /function _paymentSettled\(row\)/);
    assert.match(business, /function _paymentGatePassed\(row\)/);
    assert.match(business, /function _isManualAccEnabled\(\)/);
    assert.match(business, /if \(_paymentSettled\(row\)\) return true;/);
    assert.match(business, /return !!_paymentStr\(row\['Link Final'\]\);/);
  });

  it('menolak ACC manual saat gate pembayaran belum lolos', () => {
    assert.match(business, /ACC manual dinonaktifkan\. Setujui pengajuan lalu validasi pembayaran/);
    assert.match(business, /_getConfigValue\('allow_manual_acc', '0'\) === '1'/);
  });

  it('promosi otomatis Disetujui menjadi ACC saat pembayaran lunas/gratis', () => {
    assert.match(business, /newStatus === STATUS\.DISETUJUI && \(paymentSettled \|\| autoGratis\)/);
    assert.match(business, /effectiveStatus = STATUS\.ACC/);
    assert.match(business, /update\['Status Pembayaran'\] = 'gratis'/);
  });

  it('verifikasi pembayaran hanya untuk Disetujui/ACC dan menaikkan ke ACC', () => {
    assert.match(business, /Pembayaran hanya dapat diverifikasi untuk pengajuan berstatus Disetujui atau ACC\./);
    assert.match(business, /'Status': STATUS\.ACC,/);
    assert.match(business, /'Catatan': 'Pembayaran divalidasi'/);
    assert.match(business, /Status pengajuan menjadi ACC/);
  });

  it('surat final tidak boleh menaikkan status secara diam-diam', () => {
    assert.match(business, /Pengajuan belum berstatus ACC\. Setujui lalu validasi pembayaran terlebih dahulu\./);
  });

  it('buka kembali pembayaran mengembalikan status ke Disetujui', () => {
    assert.match(business, /nextPengajuanStatus = mode === 'buka_kembali' \? STATUS\.DISETUJUI/);
    assert.match(business, /Status pengajuan menjadi Disetujui/);
  });

  it('menyediakan migrasi idempoten ACC lama', () => {
    assert.match(business, /function migratePaymentGateExempt\(\)/);
    assert.match(business, /PAYMENT_GATE_MIGRATED/);
    assert.match(business, /Migrasi: pengecualian payment gate untuk ACC lama/);
    assert.match(business, /_ensurePaymentGateMigration\(\)/);
  });
});

describe('dashboard status Disetujui dan ACC manual', () => {
  it('dropdown status punya opsi Disetujui', () => {
    assert.match(dashboard, /<select v-model="detail\.status"[^>]*>[\s\S]*<option>Disetujui<\/option>[\s\S]*<option>ACC<\/option>[\s\S]*<\/select>/);
  });

  it('tombol cepat Setujui tersedia', () => {
    assert.match(dashboard, /quickStatus\('Disetujui'\)/);
    assert.match(dashboard, />Setujui</);
  });

  it('badge Disetujui memakai warna emerald', () => {
    assert.match(dashboard, /'Disetujui': 'bg-emerald-50 text-emerald-700 ring-emerald-600\/20'/);
  });

  it('pengaturan allow_manual_acc bisa diubah dari Master Data', () => {
    assert.match(dashboard, /master\.rowModal\.fields\.Key \|\| ''\)\.trim\(\) === 'allow_manual_acc'/);
    assert.match(dashboard, /Aktif \(ACC manual diizinkan\)/);
    assert.match(dashboard, /Nonaktif \(ACC lewat validasi bayar\)/);
    assert.match(dashboard, /r\.Key\) \|\| ''\)\.trim\(\) === 'allow_manual_acc'/);
  });
});
