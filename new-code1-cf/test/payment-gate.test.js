import { describe, it, expect } from 'vitest';
import { paymentGatePassed } from '../src/paymentGate.js';

describe('paymentGatePassed', () => {
  it('hanya berlaku untuk pengajuan ACC', () => {
    expect(paymentGatePassed({ status: 'Menunggu', status_pembayaran: 'valid' })).toBe(false);
    expect(paymentGatePassed({ status: 'Ditolak', payment_gate_exempt: 1 })).toBe(false);
  });

  it('lolos bila pembayaran valid atau gratis', () => {
    expect(paymentGatePassed({ status: 'ACC', status_pembayaran: 'valid' })).toBe(true);
    expect(paymentGatePassed({ status: 'ACC', status_pembayaran: 'gratis' })).toBe(true);
  });

  it('lolos untuk data lama yang ditandai exempt atau sudah punya link final', () => {
    expect(paymentGatePassed({ status: 'ACC', status_pembayaran: 'belum', payment_gate_exempt: 1 })).toBe(true);
    expect(paymentGatePassed({ status: 'ACC', status_pembayaran: 'belum', link_final: 'https://drive/final.pdf' })).toBe(true);
  });

  it('menolak ACC baru yang belum membayar', () => {
    expect(paymentGatePassed({ status: 'ACC', status_pembayaran: 'belum', payment_gate_exempt: 0 })).toBe(false);
    expect(paymentGatePassed({ status: 'ACC', status_pembayaran: 'menunggu' })).toBe(false);
  });
});
