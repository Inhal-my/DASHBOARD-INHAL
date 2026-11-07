import { requireAdmin } from '../session.js';
import { isVerifikator } from '../policy.js';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const HARD_CAP = 5000;

// Label tampilan untuk setiap kode jenis. Dipakai backend (agregasi chip) dan
// UI (badge) agar keduanya konsisten.
export const KIND_LABELS = {
  ACC: 'ACC',
  Tolak: 'Ditolak',
  Batal: 'Dibatalkan',
  Menunggu: 'Kembali Menunggu',
  UploadMahasiswa: 'Unggah (Mahasiswa)',
  UploadAdmin: 'Unggah (Admin)',
  VerifyBayar: 'Verifikasi Bayar',
  CorrectBayar: 'Koreksi Bayar',
  ResetUpload: 'Reset Unggahan',
  UpdatePengajuan: 'Ubah Pengajuan',
  DeletePengajuan: 'Hapus Pengajuan',
  BaCreate: 'Buat BA',
  BaUpdate: 'Ubah BA',
  BaDelete: 'Hapus BA',
  RenameMaster: 'Ganti Nama Master',
  FileAccess: 'Akses Berkas',
  Deny: 'Akses Ditolak',
  Lainnya: 'Lainnya'
};

const KRITIS = ['Deny', 'DeletePengajuan', 'BaDelete', 'CorrectBayar', 'ResetUpload'];

// Kelompok aksi untuk chip cepat di dashboard. Satu jenis bisa masuk beberapa
// kelompok (mis. VerifyBayar ada di "bayar" dan "unggahan" tidak).
export const GROUP_OF = {
  ACC: ['keputusan'],
  Tolak: ['keputusan'],
  Batal: ['keputusan'],
  Menunggu: ['keputusan'],
  UploadMahasiswa: ['unggahan'],
  UploadAdmin: ['unggahan'],
  ResetUpload: ['unggahan'],
  VerifyBayar: ['bayar'],
  CorrectBayar: ['bayar'],
  BaCreate: ['ba'],
  BaUpdate: ['ba'],
  BaDelete: ['ba'],
  Deny: ['deny'],
  DeletePengajuan: ['kritis'],
  RenameMaster: ['master'],
  FileAccess: ['berkas'],
  UpdatePengajuan: ['data']
};

export const GROUPS = [
  { key: '', label: 'Semua' },
  { key: 'keputusan', label: 'Keputusan' },
  { key: 'unggahan', label: 'Unggahan' },
  { key: 'bayar', label: 'Verifikasi Bayar' },
  { key: 'ba', label: 'Berita Acara' },
  { key: 'kritis', label: 'Kritis' },
  { key: 'deny', label: 'Akses Ditolak' }
];

export function jenisInGroup(jenis, grup) {
  const g = str(grup);
  if (!g) return true;
  return (GROUP_OF[jenis] || []).indexOf(g) !== -1;
}

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

function low(v) {
  return str(v).toLowerCase();
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function isoFromUtc(ms) {
  const d = new Date(ms);
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) +
    'T' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
}

// Tanggal "hari ini" menurut WIB (UTC+7) dalam bentuk YYYY-MM-DD.
export function wibToday(now) {
  const base = now instanceof Date && !isNaN(now.getTime()) ? now.getTime() : Date.now();
  const wib = new Date(base + WIB_OFFSET_MS);
  return wib.getUTCFullYear() + '-' + pad(wib.getUTCMonth() + 1) + '-' + pad(wib.getUTCDate());
}

// Tanggal kalender WIB (YYYY-MM-DD) dari timestamp UTC tersimpan.
export function wibDay(iso) {
  const ms = Date.parse(str(iso));
  if (isNaN(ms)) return str(iso).slice(0, 10);
  return isoFromUtc(ms + WIB_OFFSET_MS).slice(0, 10);
}

export function shiftDate(dateStr, days) {
  const m = str(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + (Number(days) || 0) * 86400000;
  return isoFromUtc(ms).slice(0, 10);
}

// Rentang filter tanggal WIB -> batas timestamp UTC (string ISO).
// Contoh: 2026-11-05 00:00 WIB = 2026-11-04T17:00:00Z dan
//         2026-11-05 23:59:59 WIB = 2026-11-05T16:59:59Z.
export function wibRange(dari, sampai) {
  const d = str(dari) || shiftDate(wibToday(), -6);
  const s = str(sampai) || wibToday();
  const dm = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const sm = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const startMs = dm ? Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3])) - WIB_OFFSET_MS : 0;
  const endMs = sm
    ? Date.UTC(Number(sm[1]), Number(sm[2]) - 1, Number(sm[3])) + 86400000 - WIB_OFFSET_MS - 1000
    : Date.now();
  return {
    dari: d,
    sampai: s,
    startUtc: isoFromUtc(startMs),
    endUtc: isoFromUtc(endMs)
  };
}

export function parseDetail(raw) {
  const s = str(raw);
  if (!s) return { value: null, json: false, text: '' };
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object') return { value: v, json: true, text: s };
    return { value: v, json: true, text: s };
  } catch (e) {
    return { value: null, json: false, text: s };
  }
}

export function initials(name) {
  const cleaned = str(name).replace(/[,;]/g, ' ');
  const words = cleaned.split(/\s+/).filter((w) => {
    const bare = w.replace(/\./g, '');
    if (!bare) return false;
    if (w.endsWith('.')) return false;
    if (/^(dr|drs|prof|hj|h)$/i.test(bare)) return false;
    return /[A-Za-z]/.test(bare);
  });
  const sig = words.length ? words : cleaned.split(/\s+/).filter(Boolean);
  if (!sig.length) return '?';
  if (sig.length === 1) return sig[0].replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
  return (sig[0][0] + sig[1][0]).toUpperCase();
}

function actorRole(name) {
  return isVerifikator({ nama: str(name) }) ? 'Verifikator' : 'Admin';
}

function fileLabel(url) {
  const s = str(url);
  if (!s) return '';
  const drive = s.match(/\/file\/d\/([^/?#]+)/);
  if (drive) return drive[1];
  const clean = s.split('?')[0].split('#')[0];
  const parts = clean.split('/').filter(Boolean);
  const last = parts.length ? parts[parts.length - 1] : '';
  try {
    return decodeURIComponent(last);
  } catch (e) {
    return last;
  }
}

function baseEvent(row, source, jenis, targetJenis, targetId, ringkasan, extra) {
  const e = {
    id: source + ':' + str(row.id),
    waktu: str(row.timestamp),
    aktor: str(extra && extra.aktor) || 'Sistem',
    aktorRole: str(extra && extra.aktorRole) || 'Admin',
    inisial: initials((extra && extra.aktor) || 'Sistem'),
    jenis: jenis,
    sumber: source,
    targetJenis: targetJenis,
    targetId: str(targetId),
    ringkasan: ringkasan,
    meta: (extra && extra.meta) || {},
    alasan: str(extra && extra.alasan),
    raw: str(row.detail)
  };
  if (extra && extra.sebelum) e.sebelum = extra.sebelum;
  if (extra && extra.sesudah) e.sesudah = extra.sesudah;
  return e;
}

function detailFields(detail, skip) {
  const out = {};
  Object.keys(detail || {}).forEach((k) => {
    if (skip && skip.indexOf(k) !== -1) return;
    out[k] = detail[k];
  });
  return out;
}

export function normalizeAudit(row) {
  const action = str(row.aksi).toUpperCase();
  const target = str(row.target);
  const targetLow = low(target);
  const d = parseDetail(row.detail);
  const detail = d.value && typeof d.value === 'object' ? d.value : null;
  const idPengajuan = detail ? str(detail.idPengajuan) : '';
  const aktor = str(row.actor_email) || 'Sistem';
  const extra = { aktor: aktor, aktorRole: actorRole(aktor), alasan: str(row.alasan) };

  if (action === 'UPDATE' && targetLow === 'pengajuan') {
    const fields = detail ? Object.keys(detail).filter((k) => k !== 'idPengajuan') : [];
    extra.meta = { perubahan: fields.join(', ') };
    extra.sesudah = detail ? detailFields(detail, ['idPengajuan']) : undefined;
    return baseEvent(row, 'audit_log', 'UpdatePengajuan', 'Pengajuan', idPengajuan,
      fields.length ? 'Memperbarui data pengajuan (' + fields.join(', ') + ')' : 'Memperbarui data pengajuan', extra);
  }

  if (action === 'UPDATE' && targetLow === 'detailkegiatan') {
    const fields = detail ? Object.keys(detail).filter((k) => k !== 'idPengajuan' && k !== 'index') : [];
    extra.meta = detail ? { perubahan: fields.join(', '), index: detail.index } : {};
    return baseEvent(row, 'audit_log', 'UpdatePengajuan', 'DetailKegiatan', idPengajuan,
      'Mengubah detail kegiatan', extra);
  }

  if (targetLow === 'checkdata') {
    const cleared = !!(detail && detail.cleared);
    extra.meta = detail ? { biaya: detail.biaya, cleared: cleared } : {};
    return baseEvent(row, 'audit_log', 'UpdatePengajuan', 'CheckData', idPengajuan,
      cleared ? 'Mengembalikan biaya pengajuan ke MasterBiaya' : 'Mengoreksi biaya pengajuan', extra);
  }

  if (action === 'DELETE' && targetLow === 'pengajuan') {
    const n = detail ? Number(detail.deleted) || 0 : 0;
    extra.meta = detail ? { deleted: n, baDiperiksa: detail.baDiperiksa } : {};
    return baseEvent(row, 'audit_log', 'DeletePengajuan', 'Pengajuan', idPengajuan,
      'Menghapus pengajuan beserta ' + n + ' baris terkait', extra);
  }

  if (action === 'DELETE' && targetLow === 'detailkegiatan') {
    extra.meta = detail ? detailFields(detail, ['idPengajuan']) : {};
    extra.sebelum = detail ? detailFields(detail, ['idPengajuan', 'index']) : undefined;
    return baseEvent(row, 'audit_log', 'DeletePengajuan', 'DetailKegiatan', idPengajuan,
      'Menghapus detail kegiatan', extra);
  }

  if (action === 'UPLOAD_BUKTI_ADMIN') {
    extra.meta = detail ? { sumber: detail.sumber, berkas: fileLabel(detail.linkBukti) } : {};
    return baseEvent(row, 'audit_log', 'UploadAdmin', 'Pengajuan', idPengajuan,
      'Admin mengunggah bukti bayar', extra);
  }

  if (action === 'RESET_UPLOAD') {
    extra.meta = detail ? { berkas: fileLabel(detail.linkBukti) } : {};
    extra.sebelum = detail ? { linkBukti: str(detail.linkBukti) } : undefined;
    extra.sesudah = { linkBukti: '' };
    return baseEvent(row, 'audit_log', 'ResetUpload', 'Pengajuan', idPengajuan,
      'Mereset unggahan mahasiswa', extra);
  }

  if (action === 'VERIFY') {
    const nominal = detail ? Number(detail.nominal) || 0 : 0;
    const kesesuaian = detail ? str(detail.kesesuaian) : '';
    extra.meta = detail ? { nominal: nominal, kesesuaian: kesesuaian, tanggalBayar: detail.tanggal } : {};
    extra.sebelum = { status: 'menunggu' };
    extra.sesudah = { status: 'valid', nominal: nominal };
    return baseEvent(row, 'audit_log', 'VerifyBayar', 'Pembayaran', idPengajuan,
      'Memvalidasi pembayaran' + (nominal ? ' Rp' + nominal.toLocaleString('id-ID') : '') +
      (kesesuaian ? ' (' + kesesuaian + ')' : ''), extra);
  }

  if (action === 'CORRECT') {
    const mode = detail ? str(detail.mode) : '';
    const statusBaru = detail ? str(detail.statusBaru) : '';
    extra.meta = { mode: mode, statusBaru: statusBaru };
    extra.sebelum = { status: 'valid' };
    extra.sesudah = { status: statusBaru };
    return baseEvent(row, 'audit_log', 'CorrectBayar', 'Pembayaran', idPengajuan,
      mode === 'buka_kembali' ? 'Membuka kembali pembayaran ke antrean' : 'Koreksi administratif pembayaran', extra);
  }

  if (action === 'DENY') {
    extra.meta = {};
    extra.sebelum = detail ? { status: detail.dari } : undefined;
    extra.sesudah = detail ? { status: detail.ke } : undefined;
    return baseEvent(row, 'audit_log', 'Deny', 'Pengajuan', idPengajuan,
      'Percobaan mengubah keputusan ditolak sistem', extra);
  }

  if (action === 'BA_CREATE' || action === 'BA_UPDATE' || action === 'BA_DELETE') {
    const jenisBa = detail ? str(detail.jenis) : '';
    const peserta = detail && detail.jumlahPeserta !== undefined ? detail.jumlahPeserta : '';
    const map = { BA_CREATE: 'BaCreate', BA_UPDATE: 'BaUpdate', BA_DELETE: 'BaDelete' };
    const verb = { BA_CREATE: 'Membuat', BA_UPDATE: 'Memperbarui', BA_DELETE: 'Menghapus' };
    const label = jenisBa ? 'BA ' + jenisBa : 'BA';
    const ringkas = verb[action] + ' ' + label +
      (action === 'BA_CREATE' && peserta !== '' ? ' (' + peserta + ' peserta)' : '');
    extra.meta = detailFields(detail, []);
    return baseEvent(row, 'audit_log', map[action], 'Berita Acara', target, ringkas, extra);
  }

  if (action === 'FILE_ACCESS') {
    const text = d.json ? d.text : str(row.detail);
    extra.meta = { berkas: text.replace(/^Akses berkas\s*/i, '') };
    return baseEvent(row, 'audit_log', 'FileAccess', 'Berkas', target,
      text || 'Membuka berkas', extra);
  }

  if (action === 'RENAME_MASTER') {
    const parts = target.split('->');
    const dari = parts.length > 1 ? parts[0].replace(/^Blok:\s*/i, '').trim() : target;
    const ke = parts.length > 1 ? parts[1].trim() : '';
    extra.meta = detailFields(detail || {}, []);
    extra.sebelum = { nilai: dari };
    extra.sesudah = ke ? { nilai: ke } : undefined;
    return baseEvent(row, 'audit_log', 'RenameMaster', 'Master Data', target,
      'Mengganti nama master: ' + dari + (ke ? ' -> ' + ke : ''), extra);
  }

  const fallbackText = d.json ? d.text : str(row.detail);
  extra.meta = fallbackText ? { detail: fallbackText } : {};
  return baseEvent(row, 'audit_log', 'Lainnya', target || 'Lainnya', '',
    (action || 'AKSI') + (fallbackText ? ': ' + fallbackText.slice(0, 120) : ''), extra);
}

const STATUS_JENIS = { ACC: 'ACC', Ditolak: 'Tolak', Dibatalkan: 'Batal', Menunggu: 'Menunggu' };
const STATUS_RINGKAS = {
  ACC: 'ACC pengajuan',
  Ditolak: 'Menolak pengajuan',
  Dibatalkan: 'Membatalkan pengajuan',
  Menunggu: 'Mengembalikan ke Menunggu'
};

export function normalizeStatus(row, prevStatus) {
  const status = str(row.status);
  const aktor = str(row.actor_email) || 'Admin';
  const jenis = STATUS_JENIS[status] || 'Lainnya';
  const extra = {
    aktor: aktor,
    aktorRole: actorRole(aktor),
    alasan: str(row.catatan),
    meta: { statusLama: str(prevStatus), statusBaru: status },
    sebelum: prevStatus ? { status: str(prevStatus) } : undefined,
    sesudah: { status: status }
  };
  const ringkas = (STATUS_RINGKAS[status] || ('Status menjadi ' + status)) +
    (str(row.id_pengajuan) ? ' ' + str(row.id_pengajuan) : '');
  return baseEvent(row, 'status_history', jenis, 'Pengajuan', str(row.id_pengajuan), ringkas, extra);
}

export function normalizeUpload(row, adminAudit) {
  const detail = str(row.detail);
  const isAdmin = /unggah bukti bayar oleh admin/i.test(detail) || !!adminAudit;
  const aktor = isAdmin
    ? (adminAudit ? str(adminAudit.actor_email) || 'Admin' : 'Admin')
    : (str(row.nama_lengkap) || 'Mahasiswa');
  const jenis = isAdmin ? 'UploadAdmin' : 'UploadMahasiswa';
  const extra = {
    aktor: aktor,
    aktorRole: isAdmin ? 'Admin' : 'Mahasiswa',
    meta: {
      namaMahasiswa: str(row.nama_lengkap),
      npm: str(row.npm),
      blok: str(row.blok),
      jenisKegiatan: str(row.jenis_kegiatan),
      berkas: fileLabel(row.link_bukti_bayar),
      tanggal: str(row.tanggal)
    }
  };
  const ringkas = isAdmin
    ? 'Admin mengunggah bukti bayar atas nama ' + (str(row.nama_lengkap) || str(row.npm) || '-')
    : 'Mahasiswa mengunggah bukti bayar' + (str(row.jenis_kegiatan) ? ' (' + str(row.jenis_kegiatan) + ')' : '');
  return baseEvent(row, 'log_upload', jenis, 'Pengajuan', str(row.id_pengajuan), ringkas, extra);
}

// Buang baris log_upload yang merupakan duplikat dari audit_log
// UPLOAD_BUKTI_ADMIN / RESET_UPLOAD untuk pengajuan yang sama dalam 10 detik.
export function dedupeUploadRows(uploadRows, auditRows) {
  const watches = (auditRows || [])
    .filter((r) => {
      const a = str(r.aksi).toUpperCase();
      return a === 'UPLOAD_BUKTI_ADMIN' || a === 'RESET_UPLOAD';
    })
    .map((r) => {
      const d = parseDetail(r.detail);
      const id = d.value && typeof d.value === 'object' ? str(d.value.idPengajuan) : '';
      return { id: id, ts: Date.parse(str(r.timestamp)) };
    })
    .filter((w) => w.id && !isNaN(w.ts));

  return (uploadRows || []).filter((u) => {
    if (watches.length === 0) return true;
    const id = str(u.id_pengajuan);
    if (!id) return true;
    const ts = Date.parse(str(u.timestamp));
    if (isNaN(ts)) return true;
    return !watches.some((w) => w.id === id && Math.abs(w.ts - ts) <= 10000);
  });
}

export function mergeAndSort(events) {
  const seen = new Set();
  const out = [];
  for (const e of events || []) {
    if (!e || !e.id) continue;
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  out.sort((a, b) => {
    const wa = str(a.waktu);
    const wb = str(b.waktu);
    if (wa !== wb) return wb < wa ? -1 : 1;
    return str(b.id) < str(a.id) ? -1 : 1;
  });
  return out;
}

export function kindLabel(jenis) {
  return KIND_LABELS[jenis] || str(jenis) || 'Lainnya';
}

export function filterEvents(events, filters) {
  const f = filters || {};
  const jenis = str(f.jenis);
  const grup = str(f.grup);
  const aktor = str(f.aktor);
  const target = str(f.target);
  const q = low(f.q);
  const dari = str(f.dari);
  const sampai = str(f.sampai);
  return (events || []).filter((e) => {
    if (jenis && e.jenis !== jenis) return false;
    if (!jenisInGroup(e.jenis, grup)) return false;
    if (aktor && e.aktor !== aktor) return false;
    if (target && e.targetJenis !== target) return false;
    const day = wibDay(e.waktu);
    // Batas tanggal mengikuti hari kalender WIB agar entri dini hari tidak
    // hilang/geser dibanding filter yang dipilih user.
    if (dari && day < dari) return false;
    if (sampai && day > sampai) return false;
    if (q) {
      const hay = [e.aktor, e.aktorRole, e.targetId, e.targetJenis, e.ringkasan, e.alasan, kindLabel(e.jenis)]
        .join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });
}

export function summarize(events, today) {
  const list = events || [];
  const hariIni = wibToday();
  const targetDay = str(today) || hariIni;
  const out = { hariIni: 0, keputusan: 0, unggahan: 0, kritis: 0, total: list.length };
  for (const e of list) {
    if (wibDay(e.waktu) === targetDay) out.hariIni += 1;
    if (['ACC', 'Tolak', 'Batal', 'Menunggu'].indexOf(e.jenis) !== -1) out.keputusan += 1;
    if (e.jenis === 'UploadMahasiswa' || e.jenis === 'UploadAdmin') out.unggahan += 1;
    if (KRITIS.indexOf(e.jenis) !== -1) out.kritis += 1;
  }
  return out;
}

function actorSummary(events) {
  const map = new Map();
  for (const e of events || []) {
    const key = e.aktor + '|' + e.aktorRole;
    const item = map.get(key) || { nama: e.aktor, role: e.aktorRole, jumlah: 0 };
    item.jumlah += 1;
    map.set(key, item);
  }
  return Array.from(map.values()).sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama));
}

function kindSummary(events) {
  const map = new Map();
  for (const e of events || []) {
    const item = map.get(e.jenis) || { jenis: e.jenis, label: kindLabel(e.jenis), jumlah: 0 };
    item.jumlah += 1;
    map.set(e.jenis, item);
  }
  return Array.from(map.values()).sort((a, b) => b.jumlah - a.jumlah);
}

export function groupSummaries(events) {
  return GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    jumlah: (events || []).filter((e) => jenisInGroup(e.jenis, g.key)).length
  }));
}

function clampPerPage(v) {
  const n = parseInt(v, 10);
  if (!n || n < 1) return 25;
  return Math.min(n, HARD_CAP);
}

export async function getActivityLog(db, args, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const p = args || {};
  const range = wibRange(p.dari, p.sampai);

  const auditRows = (await db.prepare(
    'SELECT * FROM audit_log WHERE timestamp >= ?1 AND timestamp <= ?2 ORDER BY timestamp DESC'
  ).bind(range.startUtc, range.endUtc).all()).results || [];

  const uploadRowsAll = (await db.prepare(
    'SELECT * FROM log_upload WHERE timestamp >= ?1 AND timestamp <= ?2 ORDER BY timestamp DESC'
  ).bind(range.startUtc, range.endUtc).all()).results || [];

  // status_history dimuat seluruhnya karena "status sebelumnya" bisa berada di
  // luar rentang filter. Tabel ini kecil (ratusan baris) dan diurutkan id naik.
  const statusRowsAll = (await db.prepare(
    'SELECT * FROM status_history ORDER BY id ASC'
  ).all()).results || [];

  const prevStatus = new Map();
  const statusEvents = [];
  for (const row of statusRowsAll) {
    const id = str(row.id_pengajuan);
    const prev = prevStatus.get(id);
    statusEvents.push(normalizeStatus(row, prev));
    if (str(row.status)) prevStatus.set(id, str(row.status));
  }
  const statusRows = statusEvents.filter((e) => e.waktu >= range.startUtc && e.waktu <= range.endUtc);

  const uploads = dedupeUploadRows(uploadRowsAll, auditRows);
  const auditOfUpload = new Map();
  for (const r of auditRows) {
    const a = str(r.aksi).toUpperCase();
    if (a !== 'UPLOAD_BUKTI_ADMIN') continue;
    const d = parseDetail(r.detail);
    const id = d.value && typeof d.value === 'object' ? str(d.value.idPengajuan) : '';
    if (id && !auditOfUpload.has(id)) auditOfUpload.set(id, r);
  }

  const events = mergeAndSort([
    ...auditRows.map(normalizeAudit),
    ...statusRows,
    ...uploads.map((r) => normalizeUpload(r, auditOfUpload.get(str(r.id_pengajuan))))
  ]);

  const truncated = events.length > HARD_CAP;
  const capped = truncated ? events.slice(0, HARD_CAP) : events;
  // Daftar dalam rentang tanggal (belum dipersempit jenis/aktor/q) dipakai untuk
  // angka chip, legenda, dan kartu ringkas agar angkanya stabil saat filter aktif.
  const ranged = filterEvents(capped, { dari: range.dari, sampai: range.sampai });
  const filtered = filterEvents(ranged, {
    jenis: p.jenis,
    grup: p.grup,
    aktor: p.aktor,
    target: p.target,
    q: p.q
  });

  const perPage = clampPerPage(p.perPage);
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  let page = parseInt(p.page, 10) || 1;
  if (page < 1) page = 1;
  if (page > pages) page = pages;
  const start = (page - 1) * perPage;

  return {
    rows: filtered.slice(start, start + perPage),
    total: filtered.length,
    page: page,
    perPage: perPage,
    pages: pages,
    truncated: truncated,
    range: { dari: range.dari, sampai: range.sampai },
    actors: actorSummary(ranged),
    kinds: kindSummary(ranged),
    groups: groupSummaries(ranged),
    summary: summarize(ranged, wibToday())
  };
}
