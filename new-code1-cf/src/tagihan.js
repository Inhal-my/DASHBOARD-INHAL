import { getBiayaMap, getBiayaOverrideMap, resolveBiayaForPengajuan } from './read/common.js';

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

// Tagihan efektif untuk satu baris pengajuan. Dipakai bersama oleh verifikasi
// pembayaran dan keputusan admin (mis. deteksi pengajuan gratis).
export async function resolveTagihan(db, row) {
  const [biayaMap, overrideMap] = await Promise.all([getBiayaMap(db), getBiayaOverrideMap(db)]);
  const details = (await db.prepare('SELECT * FROM detail_kegiatan WHERE id_pengajuan = ?1').bind(str(row && row.id_pengajuan)).all()).results || [];
  return resolveBiayaForPengajuan({
    'ID Pengajuan': row && row.id_pengajuan,
    'Jenis Kegiatan': row && row.jenis_kegiatan
  }, biayaMap, overrideMap, details);
}
