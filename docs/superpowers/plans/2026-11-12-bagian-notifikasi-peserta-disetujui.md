# Notifikasi Peserta Disetujui di Panel Bagian — Implementation Plan

**Goal:** Menambahkan ikon lonceng di app bar `bagian.html` (tepat di kiri tombol Keluar) yang menampilkan daftar peserta yang disetujui admin dashboard, sesuai mockup Varian A yang disetujui.

**Architecture:** Data notifikasi diturunkan dari `status_history` (transisi `ACC`) dan digabung ke `getBagianBootstrap` sebagai `notifikasiList` agar tidak menambah round-trip. Status "sudah dibaca" disimpan di `localStorage` sehingga tidak perlu skema baru. UI memakai panel melayang di desktop dan bottom sheet di ponsel.

**Tech Stack:** Cloudflare Workers + D1 (`src/read/bagian.js`), Vue 3 global (Options API) di `public/bagian.html`, Vitest pool-workers, Playwright.

## Global Constraints

- Tidak mengubah schema D1; sumber data `status_history` + `pengajuan` yang sudah ada.
- Baris notifikasi = satu per pengajuan, memakai transisi `ACC` terakhir dalam 30 hari terakhir.
- Hanya pengajuan yang statusnya masih `ACC` dan masuk cakupan Bagian login yang dikirim.
- Frasa "di-ACC" tidak muncul di UI; judul panel "Peserta disetujui".
- Waktu selalu diformat `DD Mon YYYY, HH.MM WIB` (Asia/Jakarta), bukan label relatif.
- Nama penyetuju memakai `status_history.actor_email` (berisi nama admin); fallback "Admin".
- "Sudah dibaca" hanya di `localStorage` (kunci `inhal_bagian_notif_read`), maksimal 400 kunci terakhir.
- Setiap perubahan script inline wajib `npm run csp:generate`.

---

### Task 1: Query notifikasi di bootstrap

**Files:**
- Modify: `new-code1-cf/src/read/bagian.js`

- [x] Tambah helper `isoUtc()` untuk menambahkan sufiks `Z` pada timestamp UTC tanpa zona.
- [x] Tambah `computeBagianNotifikasi(db, rows, days)`: scope dari `rows` (idPengajuan → baris + daftar kegiatan), ambil `status_history` status `ACC` dengan `timestamp >= cutoff` (30 hari) ber-indeks, `LIMIT 500`, ambil ACC terakhir per pengajuan.
- [x] Lewati pengajuan yang statusnya bukan `ACC` lagi; gabungkan nama kegiatan multi-detail dengan `, `.
- [x] Urutkan terbaru dulu, batasi 40 baris.
- [x] Kirim sebagai `out.notifikasiList` di `getBagianBootstrap`.

### Task 2: UI lonceng + panel

**Files:**
- Modify: `new-code1-cf/public/bagian.html`

- [x] Tambah CSS `.ntf-*`: bell, badge, panel, head, tabs, row, ava, meta, actions, empty, backdrop, sheet mobile.
- [x] Markup bell tepat sebelum tombol Keluar; badge hanya tampil saat ada yang belum dibaca; `aria-expanded`, `aria-controls`, `aria-label`.
- [x] Panel: head (judul "Peserta disetujui", hitungan belum dibaca), tab Semua / Belum dibaca / Hari ini, daftar baris (nama, NPM, kegiatan, nama penyetuji, waktu WIB), empty state, aksi "Tandai semua dibaca" + "Buka daftar peserta".
- [x] Bottom sheet di layar < 640px dengan backdrop; naikkan z-index header saat panel terbuka agar tidak tertimpa FAB.
- [x] Tutup panel via silang, klik backdrop, klik luar, atau Esc; bersihkan listener di `beforeUnmount`.
- [x] Klik baris menandai dibaca, menutup panel, pindah ke tab Berita Acara, dan mengisi pencarian NPM.

### Task 3: State dan persistensi

- [x] `notifikasiList`, `notifReadKeys`, `notif { open, tab }`, `isMobile` di `data()`.
- [x] Computed `notifList`, `notifUnreadCount`, `notifTodayCount`, `notifTabs`, `notifVisible`.
- [x] Helper `notifKey`, `wibDate`, `notifTime`, `isTodayWib`, `initialsOf`, `loadNotifRead`, `saveNotifRead`.
- [x] Methods `toggleNotif`, `closeNotif`, `isNotifRead`, `markNotifRead`, `markAllNotifRead`, `openNotifRow`, `openNotifPeserta`, `syncNotifViewport`.
- [x] Simpan `notifikasiList` ke cache bootstrap dan pulihkan dari cache saat halaman dimuat.
- [x] Reset state notifikasi saat logout.

### Task 4: Tes dan verifikasi

- [x] `test/read-bagian.test.js`: notifikasi terkirim (aktor + waktu `Z`), ACC terakhir, lewati yang bukan ACC, abaikan di luar cakupan/30 hari, gabungkan multi-kegiatan.
- [x] `test/bagian-template.test.js`: posisi bell sebelum Keluar, tidak ada teks "di-ACC", tab + badge + aksi, format WIB, localStorage + bootstrap.
- [x] `npm run csp:generate` lalu `npm run csp:check` → "CSP sinkron."
- [x] `npx vitest run` → 112 file, 954 tes lulus (satu kegagalan "Network connection lost" pada `detail-laporan-template` bersifat flaky dan lulus saat dijalankan ulang).
- [x] Playwright: badge, panel, tab, tanda dibaca, empty state, persistensi setelah reload, klik baris → tab Berita Acara + pencarian, sheet mobile + backdrop, tanpa `pageerror`.
