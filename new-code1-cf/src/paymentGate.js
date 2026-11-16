function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

// Pengajuan ACC boleh masuk alur akhir (tampil di Bagian, email final, dsb.)
// bila pembayarannya sudah valid/gratis. Baris lama yang sudah ACC sebelum
// aturan ini berlaku ditandai payment_gate_exempt agar tidak diperiksa ulang.
export function paymentGatePassed(row) {
  if (!row) return false;
  if (str(row.status) !== 'ACC') return false;
  if (Number(row.payment_gate_exempt || 0) === 1) return true;
  const pembayaran = str(row.status_pembayaran).toLowerCase();
  if (pembayaran === 'valid' || pembayaran === 'gratis') return true;
  return !!str(row.link_final);
}
