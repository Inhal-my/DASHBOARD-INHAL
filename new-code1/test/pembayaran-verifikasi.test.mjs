import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const code = readFileSync(new URL('../0_code.gs', import.meta.url), 'utf8');
const business = readFileSync(new URL('../1_business.gs', import.meta.url), 'utf8');

describe('skema pembayaran', () => {
  it('menyimpan kolom status dan audit pembayaran', () => {
    for (const header of [
      'Status Pembayaran', 'Kesesuaian Pembayaran', 'Nominal Dibayar',
      'Tanggal Bayar', 'Metode Bayar', 'Catatan Verifikasi',
      'Verified At', 'Verified By', 'Payment Revision'
    ]) {
      assert.match(code, new RegExp("'" + header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'"));
    }
  });
  it('menyediakan sheet riwayat revisi pembayaran', () => {
    assert.match(code, /PembayaranRevisi:\s*\[/);
    assert.match(code, /'Before JSON'/);
    assert.match(code, /'After JSON'/);
  });
});

describe('backend verifikasi pembayaran', () => {
  it('memvalidasi nominal, revisi, dan bukti sebelum menyimpan', () => {
    assert.match(business, /function verifyPembayaran\(/);
    assert.match(business, /expectedRevision/);
    assert.match(business, /Nominal diterima harus lebih dari nol/);
    assert.match(business, /Belum ada bukti bayar untuk diverifikasi/);
    assert.match(business, /Data sudah diubah admin lain/);
    assert.match(business, /Pembayaran divalidasi/);
  });
  it('mendukung koreksi administratif dan buka kembali', () => {
    assert.match(business, /function correctPembayaran\(/);
    assert.match(business, /mode === 'administratif'/);
    assert.match(business, /mode === 'buka_kembali'/);
    assert.match(business, /Alasan koreksi wajib diisi minimal 5 karakter/);
    assert.match(business, /Pembayaran dikembalikan ke antrean/);
  });
  it('mencatat revisi dan audit pada setiap perubahan', () => {
    assert.match(business, /_appendPembayaranRevisi\(/);
    assert.match(business, /target: 'Pembayaran'/);
    assert.match(business, /action: 'VERIFY'/);
    assert.match(business, /action: 'CORRECT'/);
  });
  it('mengirim riwayat revisi pada bootstrap laporan', () => {
    assert.match(business, /pembayaranRevisi/);
  });
});
