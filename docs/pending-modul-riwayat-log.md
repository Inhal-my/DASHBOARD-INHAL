# Pending: Modul Riwayat Log

Tanggal dicatat: 2026-11-06
Status: **SELESAI diimplementasikan (2026-11-07).** Menunggu perintah eksplisit untuk menerapkan migrasi index ke D1 produksi.

Rencana lengkap ada di `docs/superpowers/specs/2026-11-06-modul-riwayat-log-design.md`.
Mockup review ada di `mockups/riwayat-aktivitas/` (konsep 02 dipilih).

## Keputusan yang sudah final
- Sumber data: **3 tabel saja** — `audit_log`, `status_history`, `log_upload`. Tidak menambah pencatatan Master Data, login/logout, atau perubahan status.
- Akses: **semua admin, read-only**.
- Detail: **diff ramah admin** (sebelum → sesudah) + fallback JSON mentah.
- Penempatan: **tab dashboard baru `Riwayat`**, urutan **di bawah Master Data**.
- Ekspor **XLSX**: ya, mengikuti filter aktif.
- Tampilan: **konsep 02 (feed timeline per hari)** dengan drawer detail dari konsep 01.

## Yang akan dikerjakan saat disetujui
1. `src/read/activity.js` — normalisasi + merge + filter + paginasi (`getActivityLog`).
2. `src/rpc.js` — daftarkan RPC `getActivityLog`.
3. `public/dashboard.html` — tab `riwayat` setelah Master Data, section feed + drawer + filter + pager + ekspor.
4. `public/app.css` — kelas feed/timeline/badge aksi.
5. Migrasi index waktu: `audit_log(timestamp)`, `status_history(timestamp)`, `log_upload(timestamp)`.
6. Tes: `test/activity-normalize.test.js`, `test/dashboard-riwayat.test.js`, lalu suite penuh + `npm run csp:check`.
7. Rilis hanya setelah perintah eksplisit: commit → push main → `wrangler deploy --config wrangler.production.toml` → verifikasi.

## Catatan implementasi (2026-11-07)
- Semua poin di atas dikerjakan; gaya feed/drawer memakai inline `<style>` di `public/dashboard.html` karena `public/app.css` tidak ada.
- Tes: `test/activity-normalize.test.js`, `test/dashboard-riwayat.test.js`, `test/migration-activity-indexes.test.js`, update `test/dashboard-template.test.js`.
- Verifikasi: `npm test` 111 file / 909 tes lulus, `csp:check` sinkron, `migrations:check` 29 file valid, smoke browser lokal (login, feed, drawer diff, chip filter, ekspor XLSX) lulus.
