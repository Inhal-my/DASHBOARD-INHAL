import { requireAdmin } from '../session.js';
import { writeAuditLog } from '../audit.js';
import { formatRupiah, getBiayaMap, getBiayaOverrideMap, resolveBiayaForPengajuan } from '../read/common.js';

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

async function resolveTagihan(db, row) {
  const [biayaMap, overrideMap] = await Promise.all([getBiayaMap(db), getBiayaOverrideMap(db)]);
  return resolveBiayaForPengajuan({
    'ID Pengajuan': row.id_pengajuan,
    'Jenis Kegiatan': row.jenis_kegiatan
  }, biayaMap, overrideMap);
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
    'UPDATE pengajuan SET status_pembayaran = \'valid\', kesesuaian_pembayaran = ?1, nominal_dibayar = ?2, ' +
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

  const results = await db.batch([update, rev]);
  const changed = results && results[0] && results[0].meta && results[0].meta.changes;
  if (changed === 0) return { success: false, message: 'Data sudah diubah admin lain. Muat ulang.' };

  await writeAuditLog(db, {
    actor, action: 'VERIFY', target: 'Pembayaran',
    detail: JSON.stringify({ idPengajuan: id, nominal, kesesuaian, tanggal }),
    alasan: ''
  });
  return { success: true, status: 'valid', revision, message: 'Pembayaran divalidasi.' };
}

export async function correctPembayaran(db, payload, ctx) {
  const session = await requireAdmin(db, ctx && ctx.token, ctx && ctx.session);
  const p = payload || {};
  const id = str(p.idPengajuan);
  if (!id) return { success: false, message: 'ID Pengajuan tidak tersedia.' };

  const row = await loadRow(db, id);
  if (!row) return { success: false, message: 'Pengajuan tidak ditemukan.' };
  if (status(row) !== 'valid') return { success: false, message: 'Hanya pembayaran valid yang bisa dikoreksi.' };
  if (!sameRevision(p.expectedRevision, row)) return { success: false, message: 'Data sudah diubah admin lain. Muat ulang.' };

  const mode = str(p.mode);
  if (mode !== 'administratif' && mode !== 'buka_kembali') return { success: false, message: 'Jenis koreksi tidak dikenal.' };
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

  const actor = actorName({ session });
  const ts = nowIso();
  const revision = revisionOf(row) + 1;
  const nextStatus = mode === 'buka_kembali' ? 'menunggu' : 'valid';
  const tanggal = mode === 'administratif' && p.tanggal !== undefined ? str(p.tanggal) : str(row.tanggal_bayar);
  const metode = mode === 'administratif' && p.metode !== undefined ? str(p.metode) : str(row.metode_bayar);
  const catatan = mode === 'administratif' && p.catatan !== undefined ? str(p.catatan) : str(row.catatan_verifikasi);
  const verifiedAt = mode === 'buka_kembali' ? '' : str(row.verified_at);
  const verifiedBy = mode === 'buka_kembali' ? '' : str(row.verified_by);

  const update = db.prepare(
    'UPDATE pengajuan SET status_pembayaran = ?1, tanggal_bayar = ?2, metode_bayar = ?3, catatan_verifikasi = ?4, ' +
    'verified_at = ?5, verified_by = ?6, payment_revision = ?7, updated_at = ?8 ' +
    'WHERE id_pengajuan = ?9 AND payment_revision = ?10 AND status_pembayaran = \'valid\''
  ).bind(nextStatus, tanggal, metode, catatan, verifiedAt, verifiedBy, revision, ts, id, revisionOf(row));

  const rev = revisionInsert(db, {
    idPengajuan: id, revision, mode,
    statusLama: 'valid', statusBaru: nextStatus,
    kesesuaianLama: str(row.kesesuaian_pembayaran), kesesuaianBaru: str(row.kesesuaian_pembayaran),
    nominalLama: row.nominal_dibayar === null || row.nominal_dibayar === undefined ? null : toAmount(row.nominal_dibayar),
    nominalBaru: row.nominal_dibayar === null || row.nominal_dibayar === undefined ? null : toAmount(row.nominal_dibayar),
    tanggalLama: str(row.tanggal_bayar), tanggalBaru: tanggal,
    metodeLama: str(row.metode_bayar), metodeBaru: metode,
    alasan, catatan, actor, createdAt: ts,
    before: { status: 'valid', tanggal: str(row.tanggal_bayar), metode: str(row.metode_bayar), catatan: str(row.catatan_verifikasi) },
    after: { status: nextStatus, tanggal, metode, catatan }
  });

  const results = await db.batch([update, rev]);
  const changed = results && results[0] && results[0].meta && results[0].meta.changes;
  if (changed === 0) return { success: false, message: 'Data sudah diubah admin lain. Muat ulang.' };

  await writeAuditLog(db, {
    actor, action: 'CORRECT', target: 'Pembayaran',
    detail: JSON.stringify({ idPengajuan: id, mode, statusBaru: nextStatus }),
    alasan
  });
  return {
    success: true,
    status: nextStatus,
    revision,
    message: mode === 'buka_kembali' ? 'Pembayaran dikembalikan ke antrean.' : 'Koreksi administratif disimpan.'
  };
}
