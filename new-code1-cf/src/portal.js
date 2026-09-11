import { getBuktiMode, getStudentNameByNpm } from './repo.js';
import { parseFileInput } from './uploads.js';
import { saveDriveFile, ALLOWED_BA_MIME, MAX_BA_UPLOAD_BYTES } from './drive.js';

const PORTAL_MIME = ALLOWED_BA_MIME;
const PORTAL_MAX_BYTES = MAX_BA_UPLOAD_BYTES;

export function normalizeNpm(value) {
  return String(value == null ? '' : value).replace(/[^0-9]/g, '');
}

function str(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

function nowIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function startsWithPdf(base64) {
  const clean = String(base64 || '').replace(/[^A-Za-z0-9+/=]/g, '');
  if (clean.length < 8) return false;
  try {
    return atob(clean.slice(0, 8)).slice(0, 4) === '%PDF';
  } catch (e) {
    return false;
  }
}

export async function uploadBuktiFiles(db, payload, env) {
  const idPengajuan = str(payload && payload.idPengajuan);
  if (!idPengajuan) return { success: false, message: 'ID Pengajuan tidak tersedia.' };
  const existing = await db.prepare('SELECT id, link_acc_inhal, link_bukti_bayar FROM pengajuan WHERE id_pengajuan = ?1').bind(idPengajuan).first();
  if (!existing) return { success: false, message: 'Pengajuan tidak ditemukan.' };

  const bukti = parseFileInput(payload && payload.buktiFile);
  const buktiMode = await getBuktiMode(db);
  if (bukti && buktiMode === 'strict' && !startsWithPdf(bukti.data)) {
    return { success: false, message: 'Maaf, bukti bayar bukan PDF portal. Gunakan PDF asli.' };
  }

  let accUrl = '';
  if (payload && payload.accFile && payload.accFile.data) {
    const up = await saveDriveFile(env, payload.accFile, 'acc-' + idPengajuan, { allowedMime: PORTAL_MIME, maxBytes: PORTAL_MAX_BYTES, label: 'ACC INHAL' });
    if (!up.ok) return { success: false, message: up.message };
    accUrl = up.url;
  }
  let buktiUrl = '';
  if (payload && payload.buktiFile && payload.buktiFile.data) {
    const up = await saveDriveFile(env, payload.buktiFile, 'bukti-' + idPengajuan, { allowedMime: PORTAL_MIME, maxBytes: PORTAL_MAX_BYTES, label: 'bukti bayar' });
    if (!up.ok) return { success: false, message: up.message };
    buktiUrl = up.url;
  }
  if (!accUrl && !buktiUrl) {
    return { success: false, message: 'Tidak ada file yang diunggah.' };
  }

  await db.prepare('UPDATE pengajuan SET link_acc_inhal = ?1, link_bukti_bayar = ?2, updated_at = ?3 WHERE id_pengajuan = ?4')
    .bind(accUrl, buktiUrl, nowIso(), idPengajuan).run();

  return { success: true, message: 'Bukti berhasil disimpan.', linkAcc: accUrl, linkBukti: buktiUrl };
}

export async function getStudentPortalData(db, npm) {
  const npmRaw = String(npm == null ? '' : npm).trim();
  const npmKey = normalizeNpm(npmRaw);
  if (!npmKey) {
    return { error: 'NPM tidak boleh kosong' };
  }

  const { results: all } = await db.prepare('SELECT * FROM pengajuan').all();
  const { results: details } = await db.prepare('SELECT * FROM detail_kegiatan').all();
  const detailById = new Map();
  for (const d of details || []) {
    if (!detailById.has(d.id_pengajuan)) detailById.set(d.id_pengajuan, []);
    detailById.get(d.id_pengajuan).push(d);
  }

  const rows = (all || []).filter((p) => normalizeNpm(p.npm) === npmKey);
  let namaLengkap = '';
  const history = [];

  rows.forEach((p) => {
    if (!namaLengkap && p.nama_lengkap) namaLengkap = String(p.nama_lengkap).trim();
    const id = String(p.id_pengajuan || '').trim();
    const pDetails = detailById.get(id) || [];
    const detailText = pDetails
      .map((d) => [d.pilihan || '', d.detail || ''].filter(Boolean).join(' - '))
      .filter(Boolean)
      .join('; ');
    const tanggalKegiatan = pDetails.length
      ? (pDetails[0].tanggal_pelaksanaan || '')
      : (p.tanggal_pelaksanaan || '');
    const hasUpload = !!(p.link_acc_inhal || p.link_bukti_bayar);
    history.push({
      id: id,
      idPengajuan: id,
      tanggalAjuan: p.timestamp || '',
      blok: p.blok || '',
      jenis: String(p.jenis_kegiatan || '').trim(),
      detail: detailText,
      tanggalKegiatan: tanggalKegiatan,
      status: p.status || 'Menunggu',
      reason: p.catatan_admin || '',
      hasUpload: hasUpload,
      linkFinal: p.link_final || '',
      uploadTimestamp: hasUpload ? (p.updated_at || 'Uploaded') : ''
    });
  });

  if (!namaLengkap) {
    namaLengkap = await getStudentNameByNpm(db, npmKey);
  }
  if (!namaLengkap && history.length === 0) {
    return { error: 'Data pengajuan tidak ditemukan untuk NPM ' + npmRaw + '.' };
  }

  history.sort((a, b) => String(b.tanggalAjuan || '').localeCompare(String(a.tanggalAjuan || '')));

  let latestEmail = '';
  let latestNoHp = '';
  const sortedRows = rows.slice().sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  for (const r of sortedRows) {
    if (!latestEmail && r.email) latestEmail = String(r.email).trim();
    if (!latestNoHp && r.no_hp_wa) latestNoHp = String(r.no_hp_wa).trim();
    if (latestEmail && latestNoHp) break;
  }

  const buktiMode = await getBuktiMode(db);

  return {
    nama: namaLengkap || 'Mahasiswa',
    npm: npmRaw,
    email: latestEmail,
    noHp: latestNoHp,
    buktiMode: buktiMode,
    history: history
  };
}
