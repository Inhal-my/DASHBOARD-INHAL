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
- [x] **Poin 3 — Observability**
  - Error tracking, alert, dan pemantauan kesehatan aplikasi.
  - Worker sudah di-deploy; binding Workflow/R2 tetap menunggu R2 aktif.
  - Detail: `docs/superpowers/specs/2026-10-17-observability-design.md`, `docs/ops/observability.md`.
- [x] **Poin 4 — Keamanan**
  - MFA admin, security headers/CSP, dan audit akses berkas sudah di-deploy.
  - Detail: `docs/superpowers/specs/2026-10-17-security-design.md`, `docs/ops/security.md`.
- [ ] **Poin 5 — Proses rilis**
  - CI/CD, staging, migrasi terkontrol, dan test end-to-end browser.
  - Implementasi dan verifikasi lokal selesai; staging live; menunggu secret GitHub dan run Actions pertama.
  - Detail: `docs/superpowers/specs/2026-10-18-release-process-design.md`, `docs/ops/release.md`.
- [x] **Poin 6 — Skalabilitas dan kualitas data**
  - Kode, migrasi, dan deploy produksi selesai 2026-10-21.
  - Detail hasil: bagian "Hasil implementasi Poin 6" di bawah.
- [ ] **Poin 7 — UAT dan dokumentasi operasional**
  - Perangkat UAT, perbaikan aksesibilitas, E2E, dan SOP selesai; E2E staging lulus.
  - Restore drill staging lulus; menunggu pelaksanaan UAT dengan pengguna dan sign-off.
  - Detail: bagian "Hasil implementasi Poin 7" di bawah.

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

## Hasil implementasi Poin 3 (2026-10-17)

- Kode dan test selesai; deploy produksi belum dijalankan.
- Fitur:
  - `GET /api/health` memeriksa D1, mengembalikan 200 `{ ok, db: "ok", latencyMs, ts }` atau 503 `{ ok: false, db: "error" }`.
  - Semua respons `/api/*` memiliki header `x-request-id`; error RPC menyertakan `requestId`.
  - Log JSON terstruktur (`src/obs/log.js`) dengan redaksi token/password/secret dan pemotongan stack/string.
  - Event baru: `http_request_failed`, `http_request_rejected`, `rpc_failed`, `rpc_rejected`, `unhandled_error`, `health_check_failed`, serta event kegagalan log/audit/unggah.
  - `app.onError` mencatat exception tak tertangani dan mengembalikan JSON generik 500.
  - Workers Logs dan Workers Issues diaktifkan di `wrangler.toml`; Wrangler dinaikkan ke `4.151.1`.
  - SOP operasional: `docs/ops/observability.md` (log, Issues automation, monitor uptime, playbook alert).
- Verifikasi lokal:
  - Suite penuh: 83 file, 600 test lulus.
  - `wrangler deploy --dry-run` berhasil dengan binding Workflow/R2/observability.
- Deploy tertunda:
  - Menunggu R2 aktif karena `wrangler.toml` memuat binding `BACKUP_BUCKET` dan Workflow Poin 2.
  - Setelah deploy: aktifkan Issues automation dan monitor uptime, lalu verifikasi log/health di produksi.

## Hasil implementasi Poin 4 (2026-10-18)

- Kode dan test selesai; deploy produksi belum dijalankan.
- Fitur:
  - MFA admin TOTP opt-in: setup, aktifkan, nonaktifkan, 8 recovery code sekali pakai (hanya hash), anti-replay per langkah waktu.
  - Tabel `admin_mfa` dan kolom `sessions.admin_id`; sesi admin terikat ke akun.
  - Login `authenticateAdmin` menerima kode autentikator dan mengembalikan `mfaRequired` bila belum diisi.
  - Security headers pada aset statis (`public/_headers`) dan respons Worker (middleware Hono), termasuk CSP dengan hash script inline dan `'unsafe-eval'` untuk Vue runtime compiler.
  - `scripts/generate-csp.mjs` + `npm run csp:generate` menyinkronkan `public/_headers` dan `src/security/csp.js`.
  - Audit `FILE_ACCESS` best-effort pada `GET /api/files/:id`.
  - Modal Keamanan Akun dan kolom kode MFA pada login dashboard.
- Test baru: `test/mfa-totp.test.js`, `test/mfa-recovery.test.js`, `test/mfa-flow.test.js`, `test/security-headers.test.js`, `test/file-audit.test.js`.
- Dokumen operasional: `docs/ops/security.md`.
- Commit: `df9aa60` (`feat(security): MFA admin, security headers/CSP, dan audit akses berkas`), sudah di-push ke `origin/main`.
- Deploy produksi: versi Worker `fcdfd4d1-108d-4149-970e-1ada867d49d8`.
- Backup pra-migrasi: `/tmp/opencode/backups/inhal-poc-20261018-pre-poin4.sql`.
- Migrasi produksi diterapkan: `migrations/2026-10-17-admin-mfa.sql`; verifikasi `admin_mfa` ada dan `sessions.admin_id` ada.
- Verifikasi produksi:
  - `GET /api/health` -> 200 `{ ok: true, db: "ok" }`, `cache-control: no-store`, `x-request-id` ada.
  - `/portal` dan `/api/*` mengirim CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, dan `Cross-Origin-Opener-Policy`.
  - RPC `mfaStatus` tanpa sesi mengembalikan error autentikasi (handler MFA aktif di produksi).
- Catatan deploy: Worker di-deploy memakai konfigurasi sementara tanpa binding Workflow/R2 agar Poin 3/4 live lebih dulu. Repo tetap memakai `wrangler.toml` lengkap; setelah R2 aktif, deploy ulang dengan konfigurasi default untuk mengaktifkan Poin 2.

## Hasil implementasi Poin 5 (2026-10-18)

- Desain: `docs/superpowers/specs/2026-10-18-release-process-design.md`.
- CI `.github/workflows/ci.yml`: `npm ci`, `npm test`, `npm run test:scripts`,
  `npm run csp:check`, guard migrasi, dan `wrangler deploy --dry-run`.
- Tooling rilis:
  - `scripts/lib/migrations.mjs`, `scripts/check-migrations.mjs` (tolak ubah/hapus/rename migrasi lama).
  - `scripts/migrations-baseline.mjs` (baseline `d1_migrations`).
  - `scripts/generate-csp.mjs --check` (`npm run csp:check`).
  - `scripts/seed-staging.mjs` (admin staging dari `STAGING_ADMIN_PASSWORD`).
- Baseline produksi: backup `/tmp/opencode/backups/inhal-poc-20261018-pre-baseline.sql`;
  21 migrasi terdaftar; `wrangler d1 migrations list --remote` -> tidak ada yang tertunda.
- Staging:
  - D1 `inhal-poc-staging` (`ca9a999b-51dc-4a0d-8588-edf25191aa5a`, APAC), data sintetis `schema.sql`.
  - Worker `inhal-form-staging` live di https://inhal-form-staging.prodi.workers.dev.
  - Baseline staging diterapkan; `/api/health` -> 200.
- Workflow deploy: `deploy-staging.yml` (otomatis dari `main`), `deploy-production.yml`
  (manual + environment approval + opsi migrasi), `seed-staging.yml`.
- E2E `e2e/smoke.cjs` + workflow `e2e-staging.yml`: portal publik, login admin,
  dashboard, modal Keamanan Akun. Diverifikasi lokal terhadap staging: lulus.
- Dokumentasi: `docs/ops/release.md`; `DEPLOY.md` dan README diperbarui.
- Verifikasi lokal: 88 file / 623 test Vitest lulus; 6 test Node tooling lulus; CSP sinkron;
  dry-run deploy berhasil.
- Sisa: tambahkan secret GitHub (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
  `STAGING_ADMIN_PASSWORD`), buat environment `staging`/`production` + required reviewer,
  lalu jalankan CI, Seed Staging Admin, Deploy Staging, dan E2E Staging pertama.

## Hasil implementasi Poin 6 (2026-10-21)

- Status: kode, migrasi, test, dan deploy produksi selesai 2026-10-21 (run `39551735466`, versi Worker `40c4f4a2-12c0-49ab-8ebf-dea26bd596b2`).
- Indeks baru: `idx_ba_admin_berkas_pengajuan_active`, `idx_ba_admin_peserta_ba_active`,
  `idx_ba_admin_peserta_pengajuan_active`, `idx_ba_peserta_pengajuan`, `idx_pengajuan_blok`,
  `idx_pengajuan_status`, `idx_jadwal_active_tanggal`.
- Filter `active = 1` diterapkan pada pembacaan peserta/berkas BA Pendukung di dashboard dan bagian.
- Validasi terpusat `src/validation.js` dipakai untuk simpan/ubah jadwal dan BA (batas teks,
  tanggal `YYYY-MM-DD`, maksimal 500 peserta).
- Hapus pengajuan ikut membersihkan BA tanpa peserta aktif dan berkas BA yatim; audit mencatat
  `BA_CREATE`/`BA_UPDATE`/`BA_DELETE`.
- Backfill `mahasiswa.blok` hanya untuk NPM dengan tepat satu blok non-kosong.
- Audit kualitas data baru (BA yatim, jadwal duplikat, mahasiswa tanpa blok, BA perlu regen,
  peserta nonaktif) tampil di modal "Audit Integritas Data".
- Verifikasi lokal: 93 file / 664 test Vitest lulus; GAS 113 test lulus; CSP, `test:scripts`,
  dan `migrations:check` lulus. `EXPLAIN QUERY PLAN` berubah dari `SCAN` menjadi
  `SEARCH ... USING INDEX` untuk peserta BA Pendukung, status pengajuan, dan jadwal aktif.
- Deploy: migrasi staging dan produksi diterapkan; health produksi `200 { ok: true, db: "ok" }`.
  Recovery point produksi: Time Travel bookmark
  `000001f8-0000000e-0000510b-9ea1ed190410e6b647b71d99001a0cf4` (R2 belum aktif, tanpa dump ekspor).
- Skrip dry-run duplikat jadwal tersedia: `scripts/audit-jadwal-duplikat.mjs`
  (`npm run audit:jadwal -- <dump.sql>`) dan prosedur `docs/ops/data-quality.md`.
  Script hanya membaca dump, menampilkan baris yang disarankan dipertahankan, serta
  menandai baris terkait BA yang perlu review manual. Hasil dump lokal 2026-10-21:
  2 jadwal aktif, 0 duplikat.

## Hasil implementasi Poin 7 (2026-10-21, lokal)

- Matriks UAT baru `docs/ops/uat.md`: kasus per peran (mahasiswa, admin, bagian,
  operator), aksesibilitas, performa, kriteria lulus, dan sign-off.
- E2E staging lulus 2026-10-21 (run `39551581712`): portal, login, navigasi, audit,
  keamanan akun, menu mobile, dan logout.
- Restore drill staging lulus 2026-10-21 (run `39554233150`): dump staging
  diekspor baca-saja, diverifikasi, diimpor ke database scratch lokal, diekspor
  ulang, jumlah tabel inti sama, dan Worker lokal membaca data lewat health,
  opsi pendaftaran, portal mahasiswa, serta `/portal`. Bukti: artifact
  `restore-drill-evidence`. UAT-O05 ditandai lulus.
- Aksesibilitas:
  - Label/`for` dan `id` pada formulir pendaftaran, login admin, dan login bagian.
  - `role="alert"` untuk pesan login, `role="status"`/`aria-live` untuk loading,
    toast, dan hasil validasi.
  - Nama aksesibel pada dialog, riwayat, dan tombol tutup.
  - `alert()` pada formulir pendaftaran diganti pesan inline.
  - Regresi otomatis di `test/accessibility.test.js` (4 test).
- E2E `e2e/smoke.cjs` diperluas: validasi NPM portal, navigasi dashboard, audit
  integritas, keamanan akun, menu mobile, dan logout.
- Dokumen rilis diperbarui: cakupan E2E, tautan UAT, dan pemeriksaan aksesibilitas.
- Verifikasi lokal: 93 file / 664 test lulus, `test:scripts` 7 test lulus, CSP sinkron,
  guard migrasi lulus, dan `wrangler deploy --dry-run` berhasil.
- Latihan restore lokal: dump D1 lokal `ok`, impor ke database scratch berhasil,
  jumlah tabel inti sama, dan ekspor ulang scratch `ok` (dicatat di SOP backup).
- Sisa: jalankan UAT dengan pengguna dan lampirkan bukti/sign-off. Restore drill
  staging sudah lulus (run `39554233150`). Batasan aksesibilitas yang belum ditutup:
  focus trap seluruh modal dan Escape untuk semua modal selain dialog konfirmasi.

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

### Poin 3 — Observability

- Status: Worker sudah di-deploy (versi `fcdfd4d1-108d-4149-970e-1ada867d49d8`); observability aktif.
- Sisa:
  - Mengaktifkan Issues automation (email/webhook).
  - Memasang monitor uptime eksternal ke `/api/health`.
  - Verifikasi log `http_request_failed`/`health_check_failed` di produksi.
- Binding Workflow/R2 belum ikut ter-deploy karena R2 belum aktif.
