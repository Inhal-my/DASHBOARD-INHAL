import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const business = readFileSync(new URL('../1_business.gs', import.meta.url), 'utf8');

describe('status pembayaran saat unggah bukti GAS', () => {
  it('menyediakan helper status unggah', () => {
    assert.match(business, /function _paymentUploadStatus\(currentStatus, hasBukti\)/);
    assert.match(business, /const current = _paymentStr\(currentStatus\) \|\| 'belum';/);
    assert.match(business, /if \(current === 'gratis'\) return 'gratis';/);
    assert.match(business, /return 'menunggu';/);
  });

  it('menulis Status Pembayaran pada unggah bukti peserta', () => {
    assert.match(business, /'Status Pembayaran': statusPembayaranBaru/);
    assert.equal((business.match(/'Status Pembayaran': statusPembayaranBaru/g) || []).length, 1);
  });

  it('menulis Status Pembayaran pada unggah bukti admin', () => {
    assert.match(business, /'Status Pembayaran': _paymentUploadStatus\(pengajuan\['Status Pembayaran'\], true\)/);
  });

  it('menolak unggah bukti saat pembayaran sudah valid', () => {
    assert.match(business, /Pembayaran sudah valid\. Hubungi admin Keuangan untuk koreksi buka kembali\./);
    assert.match(business, /Pembayaran sudah valid\. Gunakan koreksi buka kembali untuk mengunggah ulang bukti\./);
  });

  it('mengembalikan Status Pembayaran ke belum saat unggahan direset', () => {
    assert.match(business, /Pembayaran sudah valid\. Gunakan koreksi buka kembali sebelum mereset unggahan\./);
    assert.match(
      business,
      /'Status Pembayaran': \(bukti && _paymentStr\(existing\['Status Pembayaran'\]\) !== 'gratis'\) \? 'belum' : _paymentStr\(existing\['Status Pembayaran'\]\)/
    );
  });
});