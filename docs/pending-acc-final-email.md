# Pending: Email ACC Final dan Penghapusan Template Status

Tanggal dicatat: 2026-10-19
Status: **PENDING — belum ada perubahan kode, menunggu arahan user.**

## Ringkasan keputusan user
- `template-acc-diterima-ditolak` / surat pemberitahuan status **sudah tidak dipakai**.
- Email/PDF yang digunakan hanya **ACC final**.
- Dialog "Jadikan ACC" yang salah harus diperbaiki.
- Instruksi eksplisit: jangan buat perubahan sebelum ada arahan.

## Temuan alur saat ini
1. `updatePengajuanStatus` memanggil `_processStatusNotification` untuk ACC/Ditolak.
   - PDF dari `template-acc-diterima-ditolak`.
   - Email hanya ke mahasiswa, bukan ke bagian.
   - Menyimpan `Lampiran Email`, `Status Notifikasi Email`, `Notifikasi Terkirim Pada`, `Error Notifikasi Email`.
2. `quickStatus('ACC')` di dashboard menulis "Tidak ada email yang dikirim", padahal backend mengirim email status ke mahasiswa.
3. Tombol "Kirim Ulang Email Notifikasi" (`sendStatusNotificationEmail`) masih memakai template lama.
4. `_sendFinalPdfEmails` (ACC final):
   - Wajib `Link ACC INHAL`; jika kosong proses batal.
   - PDF `template-acc-final`, disimpan sebagai `Link Final`.
   - Email + PDF ke mahasiswa dan bagian.
   - Mencatat `Status Info Bagian`, `Waktu Info Bagian`, `Email Bagian`, `Catatan Info Bagian`.
5. `3_drive_bridge.gs` masih punya aksi `sendStatusEmail` dengan template lama, tetapi CF tidak memanggilnya lagi.
6. Bug: jika ACC pertama kali lewat "Kirim Email ACC Final", status ACC di-set tanpa membuat `Nomor Surat`.
7. Bug: `_sendFinalPdfEmails` mengembalikan `ok:true` walau email gagal; `sendBulkFinalEmail` menghitungnya sebagai terkirim.
8. Test `dashboard-template.test.mjs` mengunci teks dialog yang salah.

## Pertanyaan yang menunggu jawaban
1. Saat status dijadikan ACC, kapan email final dikirim?
   - A. Otomatis saat ACC jika `Link ACC INHAL` ada; jika belum, ACC ditolak. Pengajuan manual tetap boleh ACC tanpa email. (rekomendasi)
   - B. ACC hanya mengubah status; email final selalu lewat tombol "Kirim Email ACC Final".
   - C. Opsi lain.
2. Status Ditolak: tidak mengirim email sama sekali, atau perlu email penolakan baru tanpa PDF?
3. Boleh hapus permanen template lama, konstanta, fungsi, tombol, dan aksi bridge? Atau dibiarkan tidak terpakai?
4. Setuju alur final yang men-set ACC otomatis membuat `Nomor Surat` jika kosong?
5. Kolom status email lama diisi ulang dengan status email final, atau dibiarkan sebagai data lama dan UI memakai `Link Final` + `Status Info Bagian`?
6. Jika email bagian tidak ditemukan: tetap kirim ke mahasiswa + tandai "Belum dikirim" (rekomendasi), atau batalkan semua?
7. Setuju `sendFinalEmail` dianggap gagal bila salah satu penerima gagal, dan bulk dihitung per penerima?

## File yang akan tersentuh setelah disetujui
- `new-code1/1_business.gs`
- `new-code1/0_code.gs`
- `new-code1/pages/dashboard.html`
- `new-code1/3_drive_bridge.gs`
- `new-code1/template-acc-diterima-ditolak.html` (hapus, perlu izin)
- `new-code1/README-new.md`
- `new-code1/test/dashboard-template.test.mjs`
