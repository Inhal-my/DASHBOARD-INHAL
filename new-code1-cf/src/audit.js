function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

function nowIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

export async function writeAuditLog(db, entry) {
  const e = entry || {};
  try {
    await db.prepare(
      'INSERT INTO audit_log (timestamp, actor_email, aksi, target, detail, alasan) VALUES (?1, ?2, ?3, ?4, ?5, ?6)'
    ).bind(
      nowIso(), str(e.actor), str(e.action), str(e.target), str(e.detail), str(e.alasan)
    ).run();
  } catch (err) {
    console.error('Gagal menulis AuditLog: ' + (err && err.message ? err.message : err));
  }
}

export async function writeLogUpload(db, entry) {
  const e = entry || {};
  try {
    await db.prepare(
      'INSERT INTO log_upload (timestamp, id_pengajuan, npm, nama_lengkap, blok, jenis_kegiatan, detail, tanggal, link_acc_inhal, link_bukti_bayar) ' +
      'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)'
    ).bind(
      nowIso(), str(e.idPengajuan), str(e.npm), str(e.namaLengkap), str(e.blok), str(e.jenisKegiatan),
      str(e.detail), str(e.tanggal), str(e.linkAcc), str(e.linkBukti)
    ).run();
  } catch (err) {
    console.error('Gagal menulis LogUpload: ' + (err && err.message ? err.message : err));
  }
}

export async function getUploadLogDetail(db, idPengajuan) {
  const { results } = await db.prepare(
    'SELECT pilihan, detail, tanggal_pelaksanaan FROM detail_kegiatan WHERE id_pengajuan = ?1 ORDER BY id'
  ).bind(str(idPengajuan)).all();
  const parts = [];
  let tanggal = '';
  for (const d of results || []) {
    const line = [str(d.pilihan), str(d.detail)].filter(Boolean).join(' - ');
    if (line) parts.push(line);
    if (!tanggal && str(d.tanggal_pelaksanaan)) tanggal = str(d.tanggal_pelaksanaan);
  }
  return { detail: parts.join('; '), tanggal: tanggal };
}
