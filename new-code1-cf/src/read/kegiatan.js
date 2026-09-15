function stage(done, total) {
  if (!total || done <= 0) return 'none';
  return done >= total ? 'all' : 'partial';
}

function field(obj, lowerKey, clientKey) {
  if (!obj) return '';
  const v = obj[lowerKey] !== undefined ? obj[lowerKey] : obj[clientKey];
  return v == null ? '' : String(v).trim();
}

export function computeUnitProgress(unit) {
  const peserta = (unit && unit.peserta) || [];
  const baPendukung = (unit && unit.baPendukung) || [];
  const baPelaksanaan = (unit && unit.baPelaksanaan) || [];
  const total = peserta.length;
  const decided = peserta.filter((p) => {
    const s = String(p.statusPengajuan || '').trim();
    return s === 'Diterima' || s === 'ACC' || s === 'Ditolak';
  }).length;
  const finalCount = peserta.filter((p) => p.linkFinal).length;
  const selesai = baPelaksanaan.some((b) =>
    field(b, 'dosen', 'Dosen') && field(b, 'tanggal', 'Tanggal Pelaksanaan') && field(b, 'jam', 'Jam')
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
