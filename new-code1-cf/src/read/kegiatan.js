function stage(done, total) {
  if (!total || done <= 0) return 'none';
  return done >= total ? 'all' : 'partial';
}

function field(obj, lowerKey, clientKey) {
  if (!obj) return '';
  const v = obj[lowerKey] !== undefined ? obj[lowerKey] : obj[clientKey];
  return v == null ? '' : String(v).trim();
}

// Bentuk baris BA berbeda antar pemanggil: dashboard memakai kunci kecil
// (file_url/fileUrl), halaman Bagian memakai kunci klien ('File URL').
function baFile(obj) {
  if (!obj) return '';
  if (obj.file_url !== undefined) return String(obj.file_url || '').trim();
  if (obj.fileUrl !== undefined) return String(obj.fileUrl || '').trim();
  return String(obj['File URL'] || '').trim();
}

export function computeUnitProgress(unit) {
  const peserta = (unit && unit.peserta) || [];
  const baPendukung = (unit && unit.baPendukung) || [];
  const baPelaksanaan = (unit && unit.baPelaksanaan) || [];
  const total = peserta.length;
  const decided = peserta.filter((p) => {
    const s = String(p.statusPengajuan || '').trim();
    return s === 'ACC' || s === 'Ditolak';
  }).length;
  const finalCount = peserta.filter((p) => p.masukBa).length;
  // Tahap "selesai" menuntut berkas BA: tanpa berkas, BA hanya menyelesaikan
  // tahap pelaksanaan.
  const selesai = baPelaksanaan.some((b) =>
    field(b, 'dosen', 'Dosen') && field(b, 'tanggal', 'Tanggal Pelaksanaan') && field(b, 'jam', 'Jam')
    && baFile(b)
  );
  return {
    pendaftaran: total > 0 ? 'all' : 'none',
    pendukung: baPendukung.length ? 'all' : 'none',
    keputusan: stage(decided, total),
    final: stage(finalCount, total),
    pelaksanaan: baPelaksanaan.length ? 'all' : 'none',
    selesai: selesai ? 'all' : 'none',
    counts: { peserta: total, keputusan: decided, final: finalCount }
  };
}
