import { requireAdmin } from '../session.js';
import { writeAuditLog } from '../audit.js';
import { sendFinalPdfEmails } from './email.js';
import { formatRupiah } from '../read/common.js';
import { resolveTagihan } from '../tagihan.js';
import { upsertBiayaCheckData } from './pengajuanAdmin.js';

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

function nowIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function actorName(ctx) {
  return str(ctx && ctx.session && ctx.session.nama) || 'Admin';
}

function toAmount(v) {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(String(v).replace(/[^\d-]/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function status(row) {
  return str(row && row.status_pembayaran) || 'belum';
}

function pengajuanStatus(row) {
  return str(row && row.status);
}

function revisionOf(row) {
  const n = Number(row && row.payment_revision);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function expectedKesesuaian(nominal, tagihan) {
  if (nominal === tagihan) return 'pas';
  return nominal < tagihan ? 'kurang' : 'lebih';
}

function kesesuaianLabel(value) {
  if (value === 'kurang') return 'Kurang';
  if (value === 'lebih') return 'Lebih';
  if (value === 'pas') return 'Pas';
  return '-';
}

function sameRevision(expected, row) {
  return Number(expected) === revisionOf(row);
}

async function loadRow(db, id) {
  return db.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind(id).first();
}

function revisionInsert(db, data) {
  return db.prepare(
    'INSERT INTO pembayaran_revisi ' +
    '(id_pengajuan, revision, mode, status_lama, status_baru, kesesuaian_lama, kesesuaian_baru, ' +
    'nominal_lama, nominal_baru, tanggal_lama, tanggal_baru, metode_lama, metode_baru, ' +
    'alasan, catatan, actor, created_at, before_json, after_json) ' +
    'SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19 ' +
    'WHERE EXISTS (SELECT 1 FROM pengajuan WHERE id_pengajuan = ?1 AND payment_revision = ?2)'
  ).bind(
    data.idPengajuan, data.revision, data.mode, data.statusLama, data.statusBaru,
    data.kesesuaianLama, data.kesesuaianBaru, data.nominalLama, data.nominalBaru,
    data.tanggalLama, data.tanggalBaru, data.metodeLama, data.metodeBaru,
    data.alasan, data.catatan, data.actor, data.createdAt,
    JSON.stringify(data.before || {}), JSON.stringify(data.after || {})
  );
}

export async function verifyPembayaran(db, payload, ctx) {
  const session = await requireAdmin(db, ctx && ctx.token, ctx && ctx.session);
  const p = payload || {};
  const id = str(p.idPengajuan);
  if (!id) return { success: false, message: 'ID Pengajuan tidak tersedia.' };

  const row = await loadRow(db, id);
  if (!row) return { success: false, message: 'Pengajuan tidak ditemukan.' };
  const prevPengajuanStatus = pengajuanStatus(row);
  if (prevPengajuanStatus !== 'Disetujui' && prevPengajuanStatus !== 'ACC') {
    return { success: false, message: 'Pembayaran hanya dapat diverifikasi untuk pengajuan berstatus Disetujui atau ACC.' };
  }
  if (status(row) === 'valid') return { success: false, message: 'Pembayaran sudah valid. Gunakan koreksi.' };
  if (status(row) === 'gratis') return { success: false, message: 'Pembayaran gratis tidak perlu diverifikasi.' };
  if (!str(row.link_bukti_bayar)) return { success: false, message: 'Belum ada bukti bayar untuk diverifikasi.' };
  if (!sameRevision(p.expectedRevision, row)) return { success: false, message: 'Data sudah diubah admin lain. Muat ulang.' };

  const tagihan = await resolveTagihan(db, row);
  const nominal = toAmount(p.nominal);
  if (tagihan <= 0) return { success: false, message: 'Pembayaran gratis tidak perlu diverifikasi.' };
  if (nominal <= 0) return { success: false, message: 'Nominal diterima harus lebih dari nol.' };

  const cocok = expectedKesesuaian(nominal, tagihan);
  const kesesuaian = str(p.kesesuaian).toLowerCase() || cocok;
  if (kesesuaian !== cocok) {
    return {
      success: false,
      message: 'Nominal ' + formatRupiah(nominal) + ' ' + (nominal < tagihan ? 'kurang dari' : 'lebih dari') +
        ' tagihan ' + formatRupiah(tagihan) + '. Pilih kesesuaian ' + kesesuaianLabel(cocok) + '.'
    };
  }

  const tanggal = str(p.tanggal) || nowIso().slice(0, 10);
  const metode = str(p.metode);
  const catatan = str(p.catatan);
  const actor = actorName({ session });
  const ts = nowIso();
  const revision = revisionOf(row) + 1;

  const update = db.prepare(
    'UPDATE pengajuan SET status = \'ACC\', status_pembayaran = \'valid\', kesesuaian_pembayaran = ?1, nominal_dibayar = ?2, ' +
    'tanggal_bayar = ?3, metode_bayar = ?4, catatan_verifikasi = ?5, verified_at = ?6, verified_by = ?7, ' +
    'payment_revision = ?8, updated_at = ?9 WHERE id_pengajuan = ?10 AND payment_revision = ?11'
  ).bind(kesesuaian, nominal, tanggal, metode, catatan, ts, actor, revision, ts, id, revisionOf(row));

  const rev = revisionInsert(db, {
    idPengajuan: id, revision, mode: 'verifikasi',
    statusLama: status(row), statusBaru: 'valid',
    kesesuaianLama: str(row.kesesuaian_pembayaran), kesesuaianBaru: kesesuaian,
    nominalLama: row.nominal_dibayar === null || row.nominal_dibayar === undefined ? null : toAmount(row.nominal_dibayar),
    nominalBaru: nominal,
    tanggalLama: str(row.tanggal_bayar), tanggalBaru: tanggal,
    metodeLama: str(row.metode_bayar), metodeBaru: metode,
    alasan: '', catatan, actor, createdAt: ts,
    before: { status: status(row), kesesuaian: str(row.kesesuaian_pembayaran), nominal: row.nominal_dibayar || null },
    after: { status: 'valid', kesesuaian, nominal }
  });

  const statements = [update, rev];
  if (prevPengajuanStatus !== 'ACC') {
    statements.push(db.prepare(
      'INSERT INTO status_history (timestamp, id_pengajuan, status, catatan, actor_email) VALUES (?1, ?2, ?3, ?4, ?5)'
    ).bind(ts, id, 'ACC', 'Pembayaran divalidasi', actor));
    statements.push(
      db.prepare('UPDATE berita_acara_peserta SET status_pengajuan = ?1 WHERE id_pengajuan = ?2').bind('ACC', id),
      db.prepare('UPDATE berita_acara_admin_peserta SET status_pengajuan = ?1 WHERE id_pengajuan = ?2').bind('ACC', id),
      db.prepare('UPDATE jadwal_peserta SET status_pengajuan = ?1 WHERE id_pengajuan = ?2').bind('ACC', id)
    );
  }
  const results = await db.batch(statements);
  const changed = results && results[0] && results[0].meta && results[0].meta.changes;
  if (changed === 0) return { success: false, message: 'Data sudah diubah admin lain. Muat ulang.' };

  await writeAuditLog(db, {
    actor, action: 'VERIFY', target: 'Pembayaran',
    detail: JSON.stringify({ idPengajuan: id, nominal, kesesuaian, tanggal }),
    alasan: ''
  });

  let notification = null;
  if (!str(row.link_final)) {
    try {
      const final = await sendFinalPdfEmails(db, id, ctx && ctx.env, actor);
      notification = final.ok
        ? { ok: true, pdfUrl: final.pdfUrl }
        : { ok: false, error: (final.notes && final.notes.join(' ')) || 'Gagal mengirim email final.' };
    } catch (e) {
      notification = { ok: false, error: (e && e.message) ? e.message : String(e) };
    }
  }

  let message = 'Pembayaran divalidasi. Status pengajuan menjadi ACC.';
  if (notification) {
    message += notification.ok
      ? ' Surat final dikirim ke mahasiswa dan Bagian.'
      : ' Pengiriman surat final gagal: ' + notification.error;
  }

  return { success: true, status: 'valid', pengajuanStatus: 'ACC', revision, message, notification };
}

export async function gratiskanPembayaran(db, payload, ctx) {
  const session = await requireAdmin(db, ctx && ctx.token, ctx && ctx.session);
  const p = payload || {};
  const id = str(p.idPengajuan);
  if (!id) return { success: false, message: 'ID Pengajuan tidak tersedia.' };

  const row = await loadRow(db, id);
  if (!row) return { success: false, message: 'Pengajuan tidak ditemukan.' };
  const prevPengajuanStatus = pengajuanStatus(row);
  if (prevPengajuanStatus !== 'Disetujui' && prevPengajuanStatus !== 'ACC') {
    return { success: false, message: 'Gratis hanya dapat ditetapkan untuk pengajuan berstatus Disetujui atau ACC.' };
  }
  if (status(row) === 'valid') {
    return { success: false, message: 'Pembayaran sudah valid. Gunakan koreksi bila perlu membebaskan biaya.' };
  }
  if (status(row) === 'gratis') {
    return { success: false, message: 'Pembayaran sudah ditandai gratis.' };
  }
  if (!sameRevision(p.expectedRevision, row)) return { success: false, message: 'Data sudah diubah admin lain. Muat ulang.' };

  const catatan = str(p.catatan) || str(row.catatan_verifikasi);
  const actor = actorName({ session });
  const ts = nowIso();
  const revision = revisionOf(row) + 1;

  const biayaRes = await upsertBiayaCheckData(db, id, '0', row);
  if (!biayaRes.success) return biayaRes;

  const update = db.prepare(
    'UPDATE pengajuan SET status = \'ACC\', status_pembayaran = \'gratis\', kesesuaian_pembayaran = \'gratis\', ' +
    'nominal_dibayar = 0, catatan_verifikasi = ?1, verified_at = ?2, verified_by = ?3, ' +
    'payment_revision = ?4, updated_at = ?5 WHERE id_pengajuan = ?6 AND payment_revision = ?7 ' +
    "AND status_pembayaran != 'gratis' AND status_pembayaran != 'valid'"
  ).bind(catatan, ts, actor, revision, ts, id, revisionOf(row));

  const rev = revisionInsert(db, {
    idPengajuan: id, revision, mode: 'gratis',
    statusLama: status(row), statusBaru: 'gratis',
    kesesuaianLama: str(row.kesesuaian_pembayaran), kesesuaianBaru: 'gratis',
    nominalLama: row.nominal_dibayar === null || row.nominal_dibayar === undefined ? null : toAmount(row.nominal_dibayar),
    nominalBaru: 0,
    tanggalLama: str(row.tanggal_bayar), tanggalBaru: str(row.tanggal_bayar),
    metodeLama: str(row.metode_bayar), metodeBaru: str(row.metode_bayar),
    alasan: '', catatan, actor, createdAt: ts,
    before: { status: status(row), kesesuaian: str(row.kesesuaian_pembayaran), nominal: row.nominal_dibayar || null },
    after: { status: 'gratis', kesesuaian: 'gratis', nominal: 0 }
  });

  const statements = [update, rev];
  if (prevPengajuanStatus !== 'ACC') {
    statements.push(db.prepare(
      'INSERT INTO status_history (timestamp, id_pengajuan, status, catatan, actor_email) VALUES (?1, ?2, ?3, ?4, ?5)'
    ).bind(ts, id, 'ACC', 'Pembayaran gratis', actor));
    statements.push(
      db.prepare('UPDATE berita_acara_peserta SET status_pengajuan = ?1 WHERE id_pengajuan = ?2').bind('ACC', id),
      db.prepare('UPDATE berita_acara_admin_peserta SET status_pengajuan = ?1 WHERE id_pengajuan = ?2').bind('ACC', id),
      db.prepare('UPDATE jadwal_peserta SET status_pengajuan = ?1 WHERE id_pengajuan = ?2').bind('ACC', id)
    );
  }
  const results = await db.batch(statements);
  const changed = results && results[0] && results[0].meta && results[0].meta.changes;
  if (changed === 0) return { success: false, message: 'Data sudah diubah admin lain. Muat ulang.' };

  await writeAuditLog(db, {
    actor, action: 'GRATIS', target: 'Pembayaran',
    detail: JSON.stringify({ idPengajuan: id, kesesuaian: 'gratis', nominal: 0 }),
    alasan: catatan
  });

  let notification = null;
  if (!str(row.link_final) && str(row.sumber) !== 'Manual') {
    try {
      const final = await sendFinalPdfEmails(db, id, ctx && ctx.env, actor);
      notification = final.ok
        ? { ok: true, pdfUrl: final.pdfUrl }
        : { ok: false, error: (final.notes && final.notes.join(' ')) || 'Gagal mengirim email final.' };
    } catch (e) {
      notification = { ok: false, error: (e && e.message) ? e.message : String(e) };
    }
  }

  let message = 'Pengajuan ditandai gratis: status ACC dan biaya Rp 0.';
  if (notification) {
    message += notification.ok
      ? ' Surat final dikirim ke mahasiswa dan Bagian.'
      : ' Pengiriman surat final gagal: ' + notification.error;
  }

  return { success: true, status: 'gratis', pengajuanStatus: 'ACC', revision, message, notification };
}

export async function correctPembayaran(db, payload, ctx) {
  const session = await requireAdmin(db, ctx && ctx.token, ctx && ctx.session);
  const p = payload || {};
  const id = str(p.idPengajuan);
  if (!id) return { success: false, message: 'ID Pengajuan tidak tersedia.' };

  const row = await loadRow(db, id);
  if (!row) return { success: false, message: 'Pengajuan tidak ditemukan.' };
  if (pengajuanStatus(row) !== 'ACC') {
    return { success: false, message: 'Pembayaran hanya dapat dikoreksi untuk pengajuan berstatus ACC.' };
  }
  const currentPayment = status(row);
  const isGratis = currentPayment === 'gratis';
  if (!isGratis && currentPayment !== 'valid') {
    return { success: false, message: 'Hanya pembayaran valid atau gratis yang bisa dikoreksi.' };
  }
  if (!sameRevision(p.expectedRevision, row)) return { success: false, message: 'Data sudah diubah admin lain. Muat ulang.' };

  const mode = str(p.mode);
  const allowedModes = isGratis ? ['batal_gratis'] : ['administratif', 'buka_kembali'];
  if (allowedModes.indexOf(mode) === -1) {
    return { success: false, message: isGratis ? 'Gunakan Batalkan Gratis untuk membatalkan status gratis.' : 'Jenis koreksi tidak dikenal.' };
  }
  const alasan = str(p.alasan);
  if (alasan.length < 5) return { success: false, message: 'Alasan koreksi wajib diisi minimal 5 karakter.' };

  if (mode === 'administratif') {
    if (p.nominal !== undefined && toAmount(p.nominal) !== toAmount(row.nominal_dibayar)) {
      return { success: false, message: 'Nominal berubah. Gunakan buka kembali.' };
    }
    if (p.kesesuaian !== undefined && str(p.kesesuaian) !== str(row.kesesuaian_pembayaran)) {
      return { success: false, message: 'Kesesuaian berubah. Gunakan buka kembali.' };
    }
  }

  if (mode === 'buka_kembali') {
    const used = await db.prepare(
      'SELECT ' +
      '(SELECT COUNT(*) FROM jadwal_peserta WHERE id_pengajuan = ?1) + ' +
      '(SELECT COUNT(*) FROM berita_acara_peserta WHERE id_pengajuan = ?1) + ' +
      '(SELECT COUNT(*) FROM berita_acara_admin_peserta WHERE id_pengajuan = ?1) AS total'
    ).bind(id).first();
    if (Number(used && used.total) > 0) {
      return { success: false, message: 'Pembayaran tidak dapat dibuka kembali karena peserta sudah masuk jadwal atau Berita Acara. Keluarkan peserta dari jadwal/BA terlebih dahulu.' };
    }
  }

  const actor = actorName({ session });
  const ts = nowIso();
  const revision = revisionOf(row) + 1;

  if (isGratis) {
    const cleared = await upsertBiayaCheckData(db, id, '', row);
    if (!cleared.success) return cleared;
  }

  const nextStatus = isGratis
    ? (str(row.link_bukti_bayar) ? 'menunggu' : 'belum')
    : (mode === 'buka_kembali' ? 'menunggu' : 'valid');
  const nextPengajuanStatus = (mode === 'buka_kembali' || mode === 'batal_gratis') ? 'Disetujui' : 'ACC';
  const nextKesesuaian = isGratis ? '' : str(row.kesesuaian_pembayaran);
  const nextNominal = isGratis
    ? null
    : (row.nominal_dibayar === null || row.nominal_dibayar === undefined ? null : toAmount(row.nominal_dibayar));
  const isRevert = mode === 'buka_kembali' || mode === 'batal_gratis';
  const tanggal = mode === 'administratif' && p.tanggal !== undefined ? str(p.tanggal) : (isGratis ? '' : str(row.tanggal_bayar));
  const metode = mode === 'administratif' && p.metode !== undefined ? str(p.metode) : (isGratis ? '' : str(row.metode_bayar));
  const catatan = mode === 'administratif' && p.catatan !== undefined ? str(p.catatan) : str(row.catatan_verifikasi);
  const verifiedAt = isRevert ? '' : str(row.verified_at);
  const verifiedBy = isRevert ? '' : str(row.verified_by);

  const sets = [];
  const vals = [];
  const setVal = (col, val) => { sets.push(col + ' = ?' + (vals.length + 1)); vals.push(val); };
  setVal('status_pembayaran', nextStatus);
  setVal('kesesuaian_pembayaran', nextKesesuaian);
  setVal('nominal_dibayar', nextNominal);
  setVal('tanggal_bayar', tanggal);
  setVal('metode_bayar', metode);
  setVal('catatan_verifikasi', catatan);
  setVal('verified_at', verifiedAt);
  setVal('verified_by', verifiedBy);
  if (isRevert) {
    setVal('status', 'Disetujui');
    setVal('link_final', '');
  }
  setVal('payment_revision', revision);
  setVal('updated_at', ts);

  const expectedPayment = isGratis ? 'gratis' : 'valid';
  const update = db.prepare(
    'UPDATE pengajuan SET ' + sets.join(', ') + ' WHERE id_pengajuan = ?' + (vals.length + 1) +
    ' AND payment_revision = ?' + (vals.length + 2) + " AND status_pembayaran = '" + expectedPayment + "'"
  ).bind(...vals, id, revisionOf(row));

  const rev = revisionInsert(db, {
    idPengajuan: id, revision, mode,
    statusLama: currentPayment, statusBaru: nextStatus,
    kesesuaianLama: str(row.kesesuaian_pembayaran), kesesuaianBaru: nextKesesuaian,
    nominalLama: row.nominal_dibayar === null || row.nominal_dibayar === undefined ? null : toAmount(row.nominal_dibayar),
    nominalBaru: nextNominal,
    tanggalLama: str(row.tanggal_bayar), tanggalBaru: tanggal,
    metodeLama: str(row.metode_bayar), metodeBaru: metode,
    alasan, catatan, actor, createdAt: ts,
    before: { status: currentPayment, kesesuaian: str(row.kesesuaian_pembayaran), tanggal: str(row.tanggal_bayar), metode: str(row.metode_bayar), catatan: str(row.catatan_verifikasi) },
    after: { status: nextStatus, kesesuaian: nextKesesuaian, tanggal, metode, catatan }
  });

  const statements = [update, rev];
  if (isRevert) {
    statements.push(db.prepare(
      'INSERT INTO status_history (timestamp, id_pengajuan, status, catatan, actor_email) VALUES (?1, ?2, ?3, ?4, ?5)'
    ).bind(ts, id, 'Disetujui', mode === 'batal_gratis' ? 'Gratis dibatalkan' : 'Pembayaran dibuka kembali', actor));
    statements.push(
      db.prepare('UPDATE berita_acara_peserta SET status_pengajuan = ?1 WHERE id_pengajuan = ?2').bind('Disetujui', id),
      db.prepare('UPDATE berita_acara_admin_peserta SET status_pengajuan = ?1 WHERE id_pengajuan = ?2').bind('Disetujui', id),
      db.prepare('UPDATE jadwal_peserta SET status_pengajuan = ?1 WHERE id_pengajuan = ?2').bind('Disetujui', id)
    );
  }
  const results = await db.batch(statements);
  const changed = results && results[0] && results[0].meta && results[0].meta.changes;
  if (changed === 0) return { success: false, message: 'Data sudah diubah admin lain. Muat ulang.' };

  await writeAuditLog(db, {
    actor, action: 'CORRECT', target: 'Pembayaran',
    detail: JSON.stringify({ idPengajuan: id, mode, statusBaru: nextStatus, pengajuanStatus: nextPengajuanStatus }),
    alasan
  });
  let message;
  if (mode === 'batal_gratis') message = 'Gratis dibatalkan. Status pengajuan kembali Disetujui dan biaya kembali ke MasterBiaya.';
  else if (mode === 'buka_kembali') message = 'Pembayaran dikembalikan ke antrean. Status pengajuan menjadi Disetujui.';
  else message = 'Koreksi administratif disimpan.';
  return {
    success: true,
    status: nextStatus,
    pengajuanStatus: nextPengajuanStatus,
    revision,
    message
  };
}
