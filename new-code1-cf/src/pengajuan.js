import {
  buildPengajuanKey, buildDetailKegiatanRows, normalizeFormText,
  isValidEmail, isValidPhone, nowLocalIso, newIdPengajuan
} from './lib.js';
import { getBagianMap, findDuplicatePengajuan } from './repo.js';
import { prepareUpload, buildUploadStatement } from './uploads.js';

const PENGAJUAN_COLUMNS = [
  'timestamp', 'id_pengajuan', 'form_key', 'npm', 'nama_lengkap', 'email', 'no_hp_wa', 'blok',
  'jenis_kegiatan', 'dosen', 'tanggal_pelaksanaan', 'keterangan', 'link_surat_keterangan',
  'status', 'catatan_admin', 'notifikasi_terkirim_pada', 'status_notifikasi_email',
  'error_notifikasi_email', 'lampiran_email', 'nomor_surat', 'link_acc_inhal',
  'link_bukti_bayar', 'link_final', 'status_info_bagian', 'waktu_info_bagian',
  'email_bagian', 'catatan_info_bagian', 'updated_at'
];

export async function registerPengajuan(db, formData) {
  const npm = normalizeFormText(formData.npm);
  const nama = normalizeFormText(formData.namaLengkap);
  const email = normalizeFormText(formData.email);
  const noHp = normalizeFormText(formData.noHp);
  if (!npm || !nama) {
    return { success: false, message: 'NPM dan Nama Lengkap wajib diisi.' };
  }
  if (!email || !isValidEmail(email)) {
    return { success: false, message: 'Email aktif wajib diisi dengan format yang benar.' };
  }
  if (!noHp || !isValidPhone(noHp)) {
    return { success: false, message: 'No. HP/WhatsApp wajib diisi dengan format yang benar.' };
  }

  const formKey = buildPengajuanKey(formData);
  if (formKey && await findDuplicatePengajuan(db, formKey)) {
    return { success: false, message: 'Data identik sudah pernah diajukan. Silakan cek status pengajuan Anda.' };
  }

  const idPengajuan = newIdPengajuan();
  const nowIso = nowLocalIso();
  const bagianMap = await getBagianMap(db);
  const detailRows = buildDetailKegiatanRows(formData, idPengajuan, bagianMap, nowIso);
  if (detailRows.length === 0) {
    return { success: false, message: 'Detail kegiatan tidak valid.' };
  }

  let surat = null;
  if (formData.fileSurat) {
    surat = prepareUpload(formData.fileSurat, {
      pengajuanId: idPengajuan, kind: 'surat', createdBy: 'mahasiswa', createdAt: nowIso
    });
    if (!surat.ok) return { success: false, message: surat.message };
  }

  const values = {
    timestamp: nowIso, id_pengajuan: idPengajuan, form_key: formKey, npm, nama_lengkap: nama, email,
    no_hp_wa: noHp, blok: normalizeFormText(formData.blok),
    jenis_kegiatan: normalizeFormText(formData.jenisKegiatan), dosen: '',
    tanggal_pelaksanaan: '', keterangan: normalizeFormText(formData.keterangan),
    link_surat_keterangan: surat ? surat.url : '', status: 'Menunggu', catatan_admin: '',
    notifikasi_terkirim_pada: '', status_notifikasi_email: '', error_notifikasi_email: '',
    lampiran_email: '', nomor_surat: '', link_acc_inhal: '', link_bukti_bayar: '',
    link_final: '', status_info_bagian: '', waktu_info_bagian: '', email_bagian: '',
    catatan_info_bagian: '', updated_at: nowIso
  };
  const placeholders = PENGAJUAN_COLUMNS.map((_, i) => '?' + (i + 1)).join(', ');
  const stmts = [
    db.prepare('INSERT INTO pengajuan (' + PENGAJUAN_COLUMNS.join(', ') + ') VALUES (' + placeholders + ')')
      .bind(...PENGAJUAN_COLUMNS.map((col) => values[col]))
  ];
  for (const d of detailRows) {
    stmts.push(
      db.prepare('INSERT INTO detail_kegiatan (timestamp, id_pengajuan, jenis_kegiatan, pilihan, detail, tanggal_pelaksanaan, bagian) VALUES (?1,?2,?3,?4,?5,?6,?7)')
        .bind(d.timestamp, d.id_pengajuan, d.jenis_kegiatan, d.pilihan, d.detail, d.tanggal_pelaksanaan, d.bagian)
    );
  }
  stmts.push(
    db.prepare('INSERT INTO status_history (timestamp, id_pengajuan, status, catatan, actor_email) VALUES (?1,?2,?3,?4,?5)')
      .bind(nowIso, idPengajuan, 'Menunggu', 'Pengajuan dibuat.', '')
  );
  if (surat) stmts.push(buildUploadStatement(db, surat.row));

  try {
    await db.batch(stmts);
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    if (/UNIQUE/i.test(msg) && /form_key/i.test(msg)) {
      return { success: false, message: 'Data identik sudah pernah diajukan. Silakan cek status pengajuan Anda.' };
    }
    return { success: false, message: 'Gagal menyimpan pengajuan: ' + msg };
  }
  return { success: true, idPengajuan, message: 'Pengajuan berhasil didaftarkan.' };
}
