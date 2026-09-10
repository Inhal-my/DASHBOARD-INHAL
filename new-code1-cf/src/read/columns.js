export const TABLE_COLUMNS = {
  mahasiswa: { npm: 'NPM', nama_lengkap: 'Nama Lengkap', email: 'Email', blok: 'Blok', keterangan: 'Keterangan' },
  master_kegiatan: { kategori: 'Kategori', nilai: 'Nilai' },
  master_bagian: { lab: 'Lab', kegiatan_lab: 'Kegiatan Lab', bagian: 'Bagian', email: 'Email' },
  master_biaya: { kegiatan: 'Kegiatan', biaya: 'Biaya' },
  config: { key: 'Key', value: 'Value' },
  admin: { password: 'Password', nama: 'Nama' },
  bagian_staff: { email: 'Email', kategori: 'Kategori', nama: 'Nama', pass: 'Pass' },
  pengajuan: {
    timestamp: 'Timestamp', id_pengajuan: 'ID Pengajuan', npm: 'NPM', nama_lengkap: 'Nama Lengkap',
    email: 'Email', no_hp_wa: 'No. HP/WA', blok: 'Blok', jenis_kegiatan: 'Jenis Kegiatan',
    keterangan: 'Keterangan', link_surat_keterangan: 'Link Surat Keterangan', status: 'Status',
    catatan_admin: 'Catatan Admin', notifikasi_terkirim_pada: 'Notifikasi Terkirim Pada',
    status_notifikasi_email: 'Status Notifikasi Email', error_notifikasi_email: 'Error Notifikasi Email',
    nomor_surat: 'Nomor Surat', link_acc_inhal: 'Link ACC INHAL', link_bukti_bayar: 'Link Bukti Bayar',
    link_final: 'Link Final', status_info_bagian: 'Status Info Bagian', waktu_info_bagian: 'Waktu Info Bagian',
    email_bagian: 'Email Bagian', catatan_info_bagian: 'Catatan Info Bagian', updated_at: 'UpdatedAt',
    dosen: 'Dosen', tanggal_pelaksanaan: 'Tanggal Pelaksanaan', lampiran_email: 'Lampiran Email'
  },
  detail_kegiatan: {
    timestamp: 'Timestamp', id_pengajuan: 'ID Pengajuan', jenis_kegiatan: 'Jenis Kegiatan',
    pilihan: 'Pilihan', detail: 'Detail', tanggal_pelaksanaan: 'Tanggal Pelaksanaan', bagian: 'Bagian'
  },
  berita_acara: {
    timestamp: 'Timestamp', ba_id: 'BA ID', bagian: 'Bagian', blok: 'Blok',
    nama_kegiatan: 'Nama Kegiatan', tanggal_pelaksanaan: 'Tanggal Pelaksanaan',
    jumlah_peserta: 'Jumlah Peserta', file_name: 'File Name', file_url: 'File URL',
    catatan: 'Catatan', sumber: 'Sumber'
  },
  berita_acara_peserta: {
    timestamp: 'Timestamp', ba_id: 'BA ID', npm: 'NPM', nama_lengkap: 'Nama Lengkap',
    blok: 'Blok', bagian: 'Bagian', status_pengajuan: 'Status Pengajuan'
  },
  berita_acara_admin: {
    timestamp: 'Timestamp', ba_id: 'BA ID', bagian: 'Bagian', blok: 'Blok',
    nama_kegiatan: 'Nama Kegiatan', tanggal_pelaksanaan: 'Tanggal Pelaksanaan',
    jumlah_peserta: 'Jumlah Peserta', file_name: 'File Name', file_url: 'File URL',
    catatan: 'Catatan', sumber: 'Sumber'
  },
  berita_acara_admin_peserta: {
    timestamp: 'Timestamp', ba_id: 'BA ID', npm: 'NPM', nama_lengkap: 'Nama Lengkap',
    blok: 'Blok', bagian: 'Bagian', status_pengajuan: 'Status Pengajuan'
  },
  check_data: {
    timestamp: 'Timestamp', check_id: 'Check ID', id_pengajuan: 'ID Pengajuan', npm: 'NPM',
    nama_lengkap: 'Nama Lengkap', blok: 'Blok', jenis_kegiatan: 'Jenis Kegiatan', pilihan: 'Pilihan',
    detail: 'Detail', tanggal_pelaksanaan: 'Tanggal Pelaksanaan', bagian: 'Bagian', dosen: 'Dosen',
    hadir: 'Hadir', catatan: 'Catatan', updated_at: 'UpdatedAt', biaya: 'Biaya'
  },
  status_history: {
    timestamp: 'Timestamp', id_pengajuan: 'ID Pengajuan', status: 'Status', catatan: 'Catatan', actor_email: 'Actor Email'
  },
  nomor_surat: { type: 'Type', tahun: 'Tahun', last_number: 'LastNumber', updated_at: 'UpdatedAt' }
};

export function toClientRow(table, dbRow) {
  const map = TABLE_COLUMNS[table] || {};
  const out = {};
  for (const [key, value] of Object.entries(dbRow || {})) {
    out[map[key] || key] = value == null ? '' : value;
  }
  return out;
}

export function toClientRows(table, dbRows) {
  return (dbRows || []).map((r) => toClientRow(table, r));
}
