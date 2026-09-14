function stage(done, total) {
  if (!total || done <= 0) return 'none';
  return done >= total ? 'all' : 'partial';
}

export function computeUnitProgress(unit) {
  const peserta = (unit && unit.peserta) || [];
  const baPendukung = (unit && unit.baPendukung) || [];
  const baPelaksanaan = (unit && unit.baPelaksanaan) || [];
  const total = peserta.length;
  const decided = peserta.filter((p) => p.statusPengajuan === 'Diterima' || p.statusPengajuan === 'Ditolak').length;
  const finalCount = peserta.filter((p) => p.linkFinal).length;
  const selesai = baPelaksanaan.some((b) => b.dosen && b.tanggal && b.jam);
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
