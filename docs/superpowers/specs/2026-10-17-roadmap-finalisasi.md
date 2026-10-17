# Roadmap Finalisasi Aplikasi INHAL

Tanggal dibuat: 2026-10-17
Status: daftar kerja aktif, dikerjakan satu per satu.

## Cara pakai

- Kerjakan berurutan. Jangan mulai poin berikutnya sebelum poin aktif selesai dan diverifikasi.
- Setiap poin harus punya: audit, rencana, test, implementasi, verifikasi produksi, dan dokumentasi.
- Sebelum perubahan data produksi: buat backup D1 dan catat jumlah baris terdampak.

## Checklist

- [x] **Poin 1 — Integritas data master**
  - Rename/merge/hapus nilai master yang sudah dipakai harus aman dan konsisten di semua tabel.
  - Hilangkan duplikat master dan tambahkan constraint.
  - Audit referensi blok lama, nilai kosong, dan `kegiatan_key` yang tidak sinkron.
- [ ] **Poin 2 — Backup dan pemulihan**
  - Implementasi selesai dan teruji lokal; **deploy produksi ditunda** karena R2 belum aktif.
  - Detail: `docs/superpowers/specs/2026-10-17-backup-restore-design.md`, `docs/ops/backup-restore.md`.
- [ ] **Poin 3 — Observability**
  - Error tracking, alert, dan pemantauan kesehatan aplikasi.
- [ ] **Poin 4 — Keamanan**
  - MFA admin, security headers/CSP, dan audit akses berkas.
- [ ] **Poin 5 — Proses rilis**
  - CI/CD, staging, migrasi terkontrol, dan test end-to-end browser.
- [ ] **Poin 6 — Skalabilitas dan kualitas data**
  - Optimasi query, validasi input, dan pembersihan data lama.
- [ ] **Poin 7 — UAT dan dokumentasi operasional**
  - UAT pengguna, uji aksesibilitas, SOP backup/restore, dan SOP rilis.

## Temuan awal Poin 1 (audit produksi 2026-10-17)

- Rename blok di Master Kegiatan hanya mengubah `master_kegiatan`; tabel transaksi tetap menyimpan nama lama.
- `Gastrointestinal, hepatobilier, and pancreas` masih ada di `pengajuan` (3), `check_data` (1), `berita_acara` (1), `berita_acara_peserta` (1), `berita_acara_admin` (3), `berita_acara_admin_peserta` (3), dan `log_upload` (3). Nilai baru `Gastro` belum ada di tabel transaksi.
- Duplikat master: `Blok / Elective` (2 baris) dan `Blok / Psychiatry` (2 baris).
- `mahasiswa.blok` kosong pada seluruh 1.975 baris.
- Belum ada unique constraint pada `master_kegiatan`.
- `kegiatan_key` BA dan jadwal bergantung pada `bagian + blok + nama kegiatan`; rename blok tanpa menghitung ulang key berpotensi merusak relasi.

## Prinsip perbaikan Poin 1

1. Nama master tidak boleh diubah diam-diam lewat edit biasa; rename harus operasi eksplisit dengan pratinjau dampak.
2. Semua perubahan yang menyentuh banyak tabel harus atomik.
3. Rename harus memperbarui referensi teks dan `kegiatan_key`, lalu menandai PDF BA terkait untuk dibuat ulang.
4. Nilai master yang masih dipakai tidak boleh dihapus tanpa penggantian.
5. Nama baru yang sudah ada harus ditolak atau diselesaikan lewat alur merge dengan aturan konflik yang jelas.

## Hasil implementasi Poin 1 (2026-10-17)

- Commit implementasi: `9b10cd8` (`feat(master): cascade rename blok, audit integritas, dan unique index`).
- Deploy Worker: `c4df8860-854f-4053-9ced-dca557cc9e51`.
- Backup pra-migrasi: `/tmp/opencode/backups/inhal-poc-20261017-pre-poin1.sql`.
- Migrasi produksi diterapkan: `migrations/2026-10-17-master-kegiatan-integrity.sql` (27 perubahan, 230 baris ditulis).
- Fitur:
  - Tombol Ganti Nama Blok dengan pratinjau dampak per tabel dan peringatan regenerasi PDF BA.
  - Rename atomik: master, semua tabel referensi blok, dan `kegiatan_key`; ditolak bila nama baru konflik.
  - Hapus blok yang masih dipakai ditolak; edit biasa yang mengubah blok terpakai diarahkan ke alur rename.
  - Modal Audit Integritas: duplikat, referensi blok asing, blok kosong, dan `kegiatan_key` tidak sinkron.
  - Unique index `idx_master_kegiatan_unique` pada `lower(trim(kategori)), lower(trim(nilai))`.
- Verifikasi produksi:
  - Referensi nama lama di seluruh tabel transaksi: 0.
  - `master_kegiatan` Blok/Gastro: 1 baris; duplikat master: 0.
  - `kegiatan_key` drift pada 12 baris BA/jadwal: 0.
  - Dashboard live memuat alur rename dan audit (HTTP 200).
  - Suite test: 79 file, 578 test lulus.
- Sisa untuk poin lain: `mahasiswa.blok` masih kosong pada 1.975 baris (perlu pengisian data, bukan bug rename); merge dua blok berbeda belum otomatis dan masih manual.

## Deploy tertunda

### Poin 2 — Backup D1 ke R2

- Status: kode selesai dan sudah di-push (`7ef4ea5`), belum di-deploy ke produksi.
- Blocker: R2 belum diaktifkan pada akun (`code 10042`).
- Yang belum dijalankan:
  - Membuat bucket `inhal-poc-backups`.
  - Menyimpan secret `D1_REST_API_TOKEN`.
  - Deploy Worker dengan Workflow dan binding R2.
  - Trigger backup pertama dan verifikasi objek R2.
  - Memasang lifecycle 180 hari.
  - Uji restore dari arsip R2 dan mencatat hasilnya.
- Selama tertunda: Time Travel D1 tetap aktif (30 hari untuk Workers Paid, 7 hari untuk Workers Free), tetapi arsip jangka panjang 180 hari belum tersedia.
- Lanjutkan Poin 2 segera setelah R2 aktif; jangan deploy konfigurasi Workflow/R2 sebelum bucket tersedia.
