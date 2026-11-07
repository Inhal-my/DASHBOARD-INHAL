/* Data dummy untuk mockup Riwayat / Log Aktivitas.
   Bentuknya meniru hasil normalisasi dari 3 sumber:
   - audit_log (aksi admin: UPDATE, DELETE, VERIFY, CORRECT, BA_CREATE, BA_UPDATE, BA_DELETE, DENY, RENAME_MASTER, FILE_ACCESS, RESET_UPLOAD, UPLOAD_BUKTI_ADMIN)
   - status_history (keputusan pengajuan: Menunggu/ACC/Ditolak/Dibatalkan)
   - log_upload (unggahan ACC & bukti bayar dari portal mahasiswa / admin)
   Hanya 3 tabel ini yang dibaca modul (keputusan review); login/logout dari tabel sessions tidak termasuk.
   Setiap entri punya field seragam: waktu, aktor, aksi, target, ringkasan, meta, alasan.
*/
window.ACT = { events: [] };

window.ACT_ACTORS = [
  { nama: 'Devi', role: 'Admin', inisial: 'DV' },
  { nama: 'Yudha', role: 'Admin IT', inisial: 'YD' },
  { nama: 'dr. Desi Isnayanti,M.Pd.Ked', role: 'Verifikator', inisial: 'DS' },
  { nama: 'Nurfitri Apriani Lubis, S.Si', role: 'Staf Bagian', inisial: 'NA' },
  { nama: 'Kiki Dian Pratiwi, S.Si', role: 'Staf Bagian', inisial: 'KP' },
  { nama: 'Sistem', role: 'Otomatis', inisial: 'SY' }
];

/* jenis aksi -> { label, badge class, dot class } */
window.ACT_KINDS = {
  ACC:            { label: 'ACC', badge: 'acc', dot: 'acc', grup: 'Keputusan' },
  Tolak:          { label: 'Ditolak', badge: 'reject', dot: 'reject', grup: 'Keputusan' },
  Batal:          { label: 'Dibatalkan', badge: 'slate', dot: 'reject', grup: 'Keputusan' },
  Menunggu:       { label: 'Kembali Menunggu', badge: 'amber', dot: 'amber', grup: 'Keputusan' },
  UploadMahasiswa:{ label: 'Unggah (Mahasiswa)', badge: 'pay', dot: 'pay', grup: 'Berkas' },
  UploadAdmin:    { label: 'Unggah (Admin)', badge: 'pay', dot: 'pay', grup: 'Berkas' },
  VerifyBayar:    { label: 'Verifikasi Bayar', badge: 'pay', dot: 'pay', grup: 'Pembayaran' },
  CorrectBayar:   { label: 'Koreksi Bayar', badge: 'amber', dot: 'amber', grup: 'Pembayaran' },
  ResetUpload:    { label: 'Reset Unggahan', badge: 'amber', dot: 'amber', grup: 'Berkas' },
  UpdatePengajuan:{ label: 'Ubah Pengajuan', badge: 'act', dot: 'act', grup: 'Data' },
  DeletePengajuan:{ label: 'Hapus Pengajuan', badge: 'reject', dot: 'reject', grup: 'Data' },
  BaCreate:       { label: 'Buat BA', badge: 'ba', dot: 'ba', grup: 'Berita Acara' },
  BaUpdate:       { label: 'Ubah BA', badge: 'ba', dot: 'ba', grup: 'Berita Acara' },
  RenameMaster:   { label: 'Ganti Nama Master', badge: 'master', dot: 'master', grup: 'Master Data' },
  FileAccess:     { label: 'Akses Berkas', badge: 'file', dot: 'file', grup: 'Berkas' },
  Deny:           { label: 'Akses Ditolak', badge: 'deny', dot: 'deny', grup: 'Keamanan' },
  BaDelete:       { label: 'Hapus BA', badge: 'reject', dot: 'reject', grup: 'Berita Acara' }
};

window.ACT.events = [
  // ---- 5 Nov 2026 ----
  {
    id: 'a-1001', waktu: '2026-11-05T08:17:06', aktor: 'Devi', aktorRole: 'Admin', inisial: 'DV',
    jenis: 'VerifyBayar', sumber: 'audit_log',
    targetJenis: 'Pembayaran', targetId: 'INHAL-388dd8de',
    ringkasan: 'Memvalidasi pembayaran Rp250.000 (sesuai tagihan)',
    meta: { nominal: 250000, kesesuaian: 'pas', tanggalBayar: '2026-11-05', metode: 'Transfer BSI' },
    alasan: '', sebelum: { status: 'menunggu', nominal: 0 }, sesudah: { status: 'valid', nominal: 250000 }
  },
  {
    id: 'a-1002', waktu: '2026-11-05T07:52:41', aktor: 'dr. Desi Isnayanti,M.Pd.Ked', aktorRole: 'Verifikator', inisial: 'DS',
    jenis: 'ACC', sumber: 'status_history',
    targetJenis: 'Pengajuan', targetId: 'INHAL-9c1f7a02',
    ringkasan: 'ACC pengajuan SGD 1 — Blok A (Aisyah Putri / 2201010001)',
    meta: { statusLama: 'Menunggu', statusBaru: 'ACC', nomorSurat: 'INHAL/2026/0142' },
    alasan: 'Berkas lengkap, bukti bayar sesuai.', sebelum: { status: 'Menunggu' }, sesudah: { status: 'ACC' }
  },
  {
    id: 'a-1003', waktu: '2026-11-05T06:03:39', aktor: 'Kiki Dian Pratiwi, S.Si', aktorRole: 'Staf Bagian', inisial: 'KP',
    jenis: 'BaCreate', sumber: 'audit_log',
    targetJenis: 'Berita Acara', targetId: 'BA-PEL-2026-0029',
    ringkasan: 'Membuat BA Pelaksanaan Fisiologi (1 sesi, 1 peserta)',
    meta: { jenisBa: 'Pelaksanaan', bagian: 'Fisiologi', jumlahPeserta: 1, jumlahSesi: 1, jadwalIds: ['JDW-2026-0026'] },
    alasan: ''
  },
  {
    id: 'a-1004', waktu: '2026-11-05T04:38:18', aktor: 'Yudha', aktorRole: 'Admin IT', inisial: 'YD',
    jenis: 'UpdatePengajuan', sumber: 'audit_log',
    targetJenis: 'Pengajuan', targetId: 'INHAL-59a7ad20',
    ringkasan: 'Memperbarui data pengajuan (email, nomor WA, blok)',
    meta: { perubahan: 'Email, No. HP/WA, Blok, Tanggal Pelaksanaan, Jenis Kegiatan' },
    alasan: 'Pemeliharaan data admin',
    sebelum: { Email: 'aryadipamora2021@gmail.com', 'No. HP/WA': '081534112796', Blok: 'Kidney and Urinary Tract' },
    sesudah: { Email: 'aryadipamora2021@gmail.com', 'No. HP/WA': '081534119900', Blok: 'Kidney and Urinary Tract' }
  },
  {
    id: 'a-1005', waktu: '2026-11-05T03:41:23', aktor: 'Yudha', aktorRole: 'Admin IT', inisial: 'YD',
    jenis: 'DeletePengajuan', sumber: 'audit_log',
    targetJenis: 'Pengajuan', targetId: 'INHAL-be000bdb',
    ringkasan: 'Menghapus pengajuan beserta 5 baris data terkait',
    meta: { deleted: 5, baDiperiksa: 1 },
    alasan: 'Pengajuan ulang - konfirmasi IT'
  },
  {
    id: 'a-1006', waktu: '2026-11-05T02:42:40', aktor: 'Devi', aktorRole: 'Admin', inisial: 'DV',
    jenis: 'UpdatePengajuan', sumber: 'audit_log',
    targetJenis: 'CheckData', targetId: 'INHAL-21c0f414',
    ringkasan: 'Mengoreksi biaya pengajuan menjadi Rp250.000',
    meta: { biayaLama: '', biayaBaru: '250000' },
    alasan: 'Pemeliharaan biaya pengajuan',
    sebelum: { Biaya: '(kosong)' }, sesudah: { Biaya: 'Rp250.000' }
  },
  {
    id: 'a-1007', waktu: '2026-11-05T01:30:12', aktor: 'Sistem', aktorRole: 'Otomatis', inisial: 'SY',
    jenis: 'UploadMahasiswa', sumber: 'log_upload',
    targetJenis: 'Pengajuan', targetId: 'INHAL-8077991e',
    ringkasan: 'Mahasiswa mengunggah bukti bayar (Mikrobiologi - Praktikum)',
    meta: { namaMahasiswa: 'AMELLIA NUR RIZKI BR SEMBIRING', blok: 'A', berkas: 'bukti-transfer-amelia.pdf' },
    alasan: ''
  },

  // ---- 4 Nov 2026 ----
  {
    id: 'a-2001', waktu: '2026-11-04T14:12:55', aktor: 'dr. Desi Isnayanti,M.Pd.Ked', aktorRole: 'Verifikator', inisial: 'DS',
    jenis: 'Tolak', sumber: 'status_history',
    targetJenis: 'Pengajuan', targetId: 'INHAL-77aa10bc',
    ringkasan: 'Menolak pengajuan KKD 2 — Blok B (Budi Santoso / 2201010002)',
    meta: { statusLama: 'Menunggu', statusBaru: 'Ditolak' },
    alasan: 'Bukti kegiatan tidak sesuai dengan jadwal yang diajukan.',
    sebelum: { status: 'Menunggu' }, sesudah: { status: 'Ditolak' }
  },
  {
    id: 'a-2002', waktu: '2026-11-04T10:09:14', aktor: 'Sistem', aktorRole: 'Otomatis', inisial: 'SY',
    jenis: 'UploadMahasiswa', sumber: 'log_upload',
    targetJenis: 'Pengajuan', targetId: 'INHAL-8077991e',
    ringkasan: 'Mahasiswa mengunggah bukti bayar (Mikrobiologi - Praktikum)',
    meta: { namaMahasiswa: 'AMELLIA NUR RIZKI BR SEMBIRING', berkas: 'transfer-bsi.jpg' }, alasan: ''
  },
  {
    id: 'a-2003', waktu: '2026-11-04T09:28:03', aktor: 'Devi', aktorRole: 'Admin', inisial: 'DV',
    jenis: 'CorrectBayar', sumber: 'audit_log',
    targetJenis: 'Pembayaran', targetId: 'INHAL-5ab01c77',
    ringkasan: 'Koreksi administratif pembayaran (nominal dikoreksi)',
    meta: { mode: 'administratif', statusBaru: 'valid', nominalLama: 200000, nominalBaru: 250000 },
    alasan: 'Salah input nominal saat verifikasi awal',
    sebelum: { nominal: 200000, status: 'valid' }, sesudah: { nominal: 250000, status: 'valid' }
  },
  {
    id: 'a-2004', waktu: '2026-11-04T08:15:20', aktor: 'Yudha', aktorRole: 'Admin IT', inisial: 'YD',
    jenis: 'ResetUpload', sumber: 'audit_log',
    targetJenis: 'Pengajuan', targetId: 'INHAL-2d9e44f1',
    ringkasan: 'Mereset unggahan mahasiswa agar dapat mengunggah ulang',
    meta: { linkAcc: '(dihapus)', linkBukti: '(dihapus)', linkFinal: '(dihapus)' },
    alasan: 'Berkas bukti tidak terbaca, minta unggah ulang'
  },
  {
    id: 'a-2005', waktu: '2026-11-04T06:26:50', aktor: 'Sistem', aktorRole: 'Otomatis', inisial: 'SY',
    jenis: 'UploadMahasiswa', sumber: 'log_upload',
    targetJenis: 'Pengajuan', targetId: 'INHAL-752bf0b6',
    ringkasan: 'Mahasiswa mengunggah bukti bayar (Fisiologi - Praktikum)',
    meta: { namaMahasiswa: 'HABIBI', berkas: 'bukti-transfer.pdf' }, alasan: ''
  },
  {
    id: 'a-2006', waktu: '2026-11-04T03:05:11', aktor: 'dr. Desi Isnayanti,M.Pd.Ked', aktorRole: 'Verifikator', inisial: 'DS',
    jenis: 'Menunggu', sumber: 'status_history',
    targetJenis: 'Pengajuan', targetId: 'INHAL-c19a1bee',
    ringkasan: 'Menarik kembali ACC ke Menunggu (revisi berkas)',
    meta: { statusLama: 'ACC', statusBaru: 'Menunggu' },
    alasan: 'Berkas final perlu diperbaiki sebelum diproses lanjut.',
    sebelum: { status: 'ACC' }, sesudah: { status: 'Menunggu' }
  },

  // ---- 3 Nov 2026 ----
  {
    id: 'a-3001', waktu: '2026-11-03T17:25:58', aktor: 'Devi', aktorRole: 'Admin', inisial: 'DV',
    jenis: 'UploadAdmin', sumber: 'log_upload',
    targetJenis: 'Pengajuan', targetId: 'INHAL-c19a1bee',
    ringkasan: 'Admin mengunggah bukti bayar atas nama mahasiswa (DAFFA MALIKI RAMBE)',
    meta: { namaMahasiswa: 'DAFFA MALIKI RAMBE', sumber: 'Manual', berkas: 'bukti-daffa.pdf' }, alasan: ''
  },
  {
    id: 'a-3002', waktu: '2026-11-03T15:40:02', aktor: 'Kiki Dian Pratiwi, S.Si', aktorRole: 'Staf Bagian', inisial: 'KP',
    jenis: 'BaUpdate', sumber: 'audit_log',
    targetJenis: 'Berita Acara', targetId: 'BA-PEL-2026-0009',
    ringkasan: 'Memperbarui BA Pelaksanaan KKD (4 peserta)',
    meta: { jenisBa: 'Pelaksanaan', jumlahPeserta: 4 }, alasan: ''
  },
  {
    id: 'a-3003', waktu: '2026-11-03T11:02:36', aktor: 'Nurfitri Apriani Lubis, S.Si', aktorRole: 'Staf Bagian', inisial: 'NA',
    jenis: 'BaCreate', sumber: 'audit_log',
    targetJenis: 'Berita Acara', targetId: 'BA-PEL-2026-0011',
    ringkasan: 'Membuat BA Pelaksanaan KKD (1 peserta)',
    meta: { jenisBa: 'Pelaksanaan', bagian: 'KKD', jumlahPeserta: 1 }, alasan: ''
  },
  {
    id: 'a-3004', waktu: '2026-11-03T09:14:47', aktor: 'Devi', aktorRole: 'Admin', inisial: 'DV',
    jenis: 'VerifyBayar', sumber: 'audit_log',
    targetJenis: 'Pembayaran', targetId: 'INHAL-1a2b3c4d',
    ringkasan: 'Memvalidasi pembayaran Rp300.000 (kurang Rp50.000 dari tagihan)',
    meta: { nominal: 300000, tagihan: 350000, kesesuaian: 'kurang' },
    alasan: 'Kekurangan disetujui atasan', sebelum: { status: 'menunggu' }, sesudah: { status: 'valid' }
  },
  {
    id: 'a-3005', waktu: '2026-11-03T07:20:05', aktor: 'dr. Desi Isnayanti,M.Pd.Ked', aktorRole: 'Verifikator', inisial: 'DS',
    jenis: 'ACC', sumber: 'status_history',
    targetJenis: 'Pengajuan', targetId: 'INHAL-3f4e5d6c',
    ringkasan: 'ACC pengajuan SGD 2 — Blok C (Citra Dewi / 2201010003)',
    meta: { statusLama: 'Menunggu', statusBaru: 'ACC', nomorSurat: 'INHAL/2026/0141' },
    alasan: 'Lengkap.', sebelum: { status: 'Menunggu' }, sesudah: { status: 'ACC' }
  },

  // ---- 2 Nov 2026 ----
  {
    id: 'a-4001', waktu: '2026-11-02T16:48:13', aktor: 'Yudha', aktorRole: 'Admin IT', inisial: 'YD',
    jenis: 'Deny', sumber: 'audit_log',
    targetJenis: 'Pengajuan', targetId: 'INHAL-8c9d0e1f',
    ringkasan: 'Percobaan mengubah keputusan ditolak sistem (bukan verifikator)',
    meta: { dari: 'Menunggu', ke: 'Ditolak' },
    alasan: 'Akses ditolak. Hanya verifikator yang dapat mengubah keputusan pengajuan (ACC, Ditolak, Dibatalkan).'
  },
  {
    id: 'a-4002', waktu: '2026-11-02T14:30:01', aktor: 'Devi', aktorRole: 'Admin', inisial: 'DV',
    jenis: 'FileAccess', sumber: 'audit_log',
    targetJenis: 'Berkas', targetId: 'file-88213',
    ringkasan: 'Membuka berkas bukti bayar mahasiswa',
    meta: { berkas: 'bukti-transfer-budi.pdf', pemilik: 'Budi Santoso' }, alasan: ''
  },
  {
    id: 'a-4003', waktu: '2026-11-02T11:11:11', aktor: 'dr. Desi Isnayanti,M.Pd.Ked', aktorRole: 'Verifikator', inisial: 'DS',
    jenis: 'Batal', sumber: 'status_history',
    targetJenis: 'Pengajuan', targetId: 'INHAL-0a1b2c3d',
    ringkasan: 'Membatalkan pengajuan KKD 1 (mahasiswa mengundurkan diri)',
    meta: { statusLama: 'Menunggu', statusBaru: 'Dibatalkan' },
    alasan: 'Mahasiswa mengundurkan diri via WhatsApp.',
    sebelum: { status: 'Menunggu' }, sesudah: { status: 'Dibatalkan' }
  },
  {
    id: 'a-4004', waktu: '2026-11-02T08:05:44', aktor: 'Yudha', aktorRole: 'Admin IT', inisial: 'YD',
    jenis: 'RenameMaster', sumber: 'audit_log',
    targetJenis: 'Master Data', targetId: 'Blok',
    ringkasan: 'Mengganti nama blok "Gastrointestinal, hepatobilier, and pancreas" menjadi "Gastro"',
    meta: { kategori: 'Blok', dari: 'Gastrointestinal, hepatobilier, and pancreas', ke: 'Gastro' },
    alasan: 'Migrasi data lama ke nama blok Gastro.'
  },

  // ---- 1 Nov 2026 ----
  {
    id: 'a-5001', waktu: '2026-11-01T19:22:37', aktor: 'Nurfitri Apriani Lubis, S.Si', aktorRole: 'Staf Bagian', inisial: 'NA',
    jenis: 'BaCreate', sumber: 'audit_log',
    targetJenis: 'Berita Acara', targetId: 'BA-PEL-2026-0012',
    ringkasan: 'Membuat BA Pelaksanaan (2 peserta)',
    meta: { jenisBa: 'Pelaksanaan', jumlahPeserta: 2 }, alasan: ''
  },
  {
    id: 'a-5002', waktu: '2026-11-01T13:45:09', aktor: 'Devi', aktorRole: 'Admin', inisial: 'DV',
    jenis: 'CorrectBayar', sumber: 'audit_log',
    targetJenis: 'Pembayaran', targetId: 'INHAL-4e5f6a7b',
    ringkasan: 'Membuka kembali verifikasi pembayaran ke antrean',
    meta: { mode: 'buka_kembali', statusBaru: 'menunggu' },
    alasan: 'Bukti bayar ganda, perlu diperiksa ulang',
    sebelum: { status: 'valid' }, sesudah: { status: 'menunggu' }
  },
  {
    id: 'a-5003', waktu: '2026-11-01T09:10:52', aktor: 'Sistem', aktorRole: 'Otomatis', inisial: 'SY',
    jenis: 'UploadMahasiswa', sumber: 'log_upload',
    targetJenis: 'Pengajuan', targetId: 'INHAL-e856016b',
    ringkasan: 'Mahasiswa mengunggah bukti bayar',
    meta: { namaMahasiswa: 'DEWANDRA HENGGAR DEVADITHAMA', berkas: 'IMG_20261101.jpg' }, alasan: ''
  },
  {
    id: 'a-5004', waktu: '2026-11-01T08:02:18', aktor: 'dr. Desi Isnayanti,M.Pd.Ked', aktorRole: 'Verifikator', inisial: 'DS',
    jenis: 'ACC', sumber: 'status_history',
    targetJenis: 'Pengajuan', targetId: 'INHAL-1b2c3d4e',
    ringkasan: 'ACC pengajuan Lab Anatomi (3 peserta)',
    meta: { statusLama: 'Menunggu', statusBaru: 'ACC', nomorSurat: 'INHAL/2026/0140' },
    alasan: 'Lengkap.', sebelum: { status: 'Menunggu' }, sesudah: { status: 'ACC' }
  },

  // ---- 31 Okt 2026 ----
  {
    id: 'a-6002', waktu: '2026-10-31T15:01:04', aktor: 'Devi', aktorRole: 'Admin', inisial: 'DV',
    jenis: 'DeletePengajuan', sumber: 'audit_log',
    targetJenis: 'Pengajuan', targetId: 'INHAL-216b60e1',
    ringkasan: 'Menghapus pengajuan beserta 4 baris data terkait',
    meta: { deleted: 4 }, alasan: 'Data uji coba (duplikat)'
  },
  {
    id: 'a-6003', waktu: '2026-10-31T10:20:38', aktor: 'Kiki Dian Pratiwi, S.Si', aktorRole: 'Staf Bagian', inisial: 'KP',
    jenis: 'BaUpdate', sumber: 'audit_log',
    targetJenis: 'Berita Acara', targetId: 'BA-PEL-2026-0008',
    ringkasan: 'Memperbarui catatan BA Pelaksanaan', meta: { field: 'catatan' }, alasan: ''
  },

  // ---- 30 Okt 2026 ----
  {
    id: 'a-7001', waktu: '2026-10-30T14:05:12', aktor: 'Yudha', aktorRole: 'Admin IT', inisial: 'YD',
    jenis: 'UpdatePengajuan', sumber: 'audit_log',
    targetJenis: 'DetailKegiatan', targetId: 'INHAL-7a8b9c0d',
    ringkasan: 'Mengubah detail kegiatan (tanggal pelaksanaan)',
    meta: { field: 'Tanggal Pelaksanaan', lama: '2026-10-28', baru: '2026-10-30' },
    alasan: 'Penyesuaian jadwal', sebelum: { 'Tanggal Pelaksanaan': '2026-10-28' }, sesudah: { 'Tanggal Pelaksanaan': '2026-10-30' }
  },
  {
    id: 'a-7002', waktu: '2026-10-30T09:41:22', aktor: 'Devi', aktorRole: 'Admin', inisial: 'DV',
    jenis: 'VerifyBayar', sumber: 'audit_log',
    targetJenis: 'Pembayaran', targetId: 'INHAL-2c3d4e5f',
    ringkasan: 'Memvalidasi pembayaran Rp150.000 (sesuai tagihan)',
    meta: { nominal: 150000, kesesuaian: 'pas' }, alasan: ''
  },
  {
    id: 'a-7003', waktu: '2026-10-30T08:00:00', aktor: 'dr. Desi Isnayanti,M.Pd.Ked', aktorRole: 'Verifikator', inisial: 'DS',
    jenis: 'Menunggu', sumber: 'status_history',
    targetJenis: 'Pengajuan', targetId: 'INHAL-6f7g8h9i',
    ringkasan: 'Menarik kembali status Ditolak ke Menunggu (banding mahasiswa)',
    meta: { statusLama: 'Ditolak', statusBaru: 'Menunggu' },
    alasan: 'Mahasiswa mengajukan banding dengan bukti tambahan.',
    sebelum: { status: 'Ditolak' }, sesudah: { status: 'Menunggu' }
  }
];

/* ringkasan angka untuk kartu di halaman */
window.ACT_SUMMARY = {
  hariIni: 7,
  mingguIni: 31,
  keputusanMingguIni: 7,
  unggahanMingguIni: 5,
  kritisMingguIni: 7,
  totalSemua: 591
};

/* staf/aktor untuk filter dummy */
window.ACT_FILTER_AKTOR = ['Devi', 'Yudha', 'dr. Desi Isnayanti,M.Pd.Ked', 'Nurfitri Apriani Lubis, S.Si', 'Kiki Dian Pratiwi, S.Si', 'Sistem'];
