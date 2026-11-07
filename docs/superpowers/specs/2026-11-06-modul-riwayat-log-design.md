# Modul Riwayat Log

Tanggal dicatat: 2026-11-06
Status: **SUDAH DIIMPLEMENTASIKAN (2026-11-07).** Migrasi index produksi belum diterapkan.
Target produksi: `new-code1-cf` (worker `inhal-form`, D1 `inhal-poc`).

> Dokumen ini catatan rencana. Tidak ada perubahan kode/schema/endpoint yang dilakukan saat dokumen dibuat. Mockup dummy sudah ada di `mockups/riwayat-aktivitas/` untuk review visual.

---

## 1. Keputusan User (final)

| # | Pertanyaan | Keputusan |
| --- | --- | --- |
| K1 | Cakupan sumber data | **Cukup 3 tabel yang ada**: `audit_log`, `status_history`, `log_upload`. Tidak menambah pencatatan baru untuk Master Data, login/logout, atau perubahan status. |
| K2 | Hak akses | **Semua admin**, read-only. Bukan khusus verifikator. |
| K3 | Gaya detail | **Diff ramah admin** seperti konsep 01 (sebelum → sesudah), plus fallback JSON mentah. |
| K4 | Penempatan | **Tab dashboard baru `Riwayat`**, urutannya **di bawah Master Data** (bukan setelah Berita Acara). |
| K5 | Ekspor XLSX | **Ya**, ekspor mengikuti filter aktif. |
| K6 | Konsep tampilan | **Konsep 02 — feed timeline per hari** sebagai tampilan utama tab, memakai drawer detail dari konsep 01. |

Konsekuensi yang diterima: aktivitas yang memang tidak tercatat (perubahan Master Data, login/logout) **tidak akan muncul** di modul ini. Ini keterbatasan data, bukan bug. Tidak ada perubahan pada jalur tulis selain penambahan index baca (opsional).

---

## 2. Tujuan & Non-Tujuan

Tujuan:

1. Satu tempat untuk menjawab "siapa melakukan apa, kapan, pada pengajuan/berkas mana".
2. Menelusuri satu kasus dari ujung ke ujung: unggah → verifikasi bayar → keputusan → BA.
3. Menyediakan bahan audit cepat (akses ditolak, hapus data, koreksi pembayaran) tanpa membuka D1 manual.

Non-tujuan:

1. Tidak menambah tabel/kolom baru.
2. Tidak mengubah `writeAuditLog`, `writeLogUpload`, atau alur tulis manapun.
3. Tidak membuat mekanisme retensi/penghapusan log.
4. Tidak menggantikan modal "Riwayat Proses" per pengajuan yang sudah ada (`openRiwayat`).

---

## 3. Arsitektur

### 3.1 Modul baca baru

`new-code1-cf/src/read/activity.js`:

- `getActivityLog(db, args, ctx)` — endpoint baca utama.
- `normalizeAudit(row)`, `normalizeStatus(row, prev)`, `normalizeUpload(row)` — fungsi murni, diekspor untuk unit test.
- `mergeAndSort(events)` — dedupe + urut `waktu` menurun (tie-breaker `id` menurun).
- `summarize(events)` — angka kartu ringkas.

Pola otorisasi mengikuti `getUploadMonitor` (`src/read/dashboard.js:473`):

```js
export async function getActivityLog(db, args, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  // ...
}
```

### 3.2 Registrasi RPC

`new-code1-cf/src/rpc.js`, tambah import dan handler:

```js
getActivityLog: (db, args, ctx) => getActivityLog(db, args[0], ctx),
```

Nama RPC: **`getActivityLog`**. Payload argumen tunggal (objek), semua opsional:

```js
{
  dari: '2026-10-30',      // YYYY-MM-DD, default 7 hari terakhir
  sampai: '2026-11-05',    // YYYY-MM-DD, default hari ini (UTC)
  aktor: '',               // nama persis dari daftar aktor
  jenis: '',               // kode jenis aksi (lihat §4.2)
  target: '',              // Pengajuan | Pembayaran | Berita Acara | Berkas | CheckData | Master Data | Akun
  q: '',                   // pencarian bebas
  page: 1,
  perPage: 25              // 10 | 25 | 50 | 100
}
```

Respons:

```js
{
  rows: [ /* event ternormalisasi, lihat §4.1 */ ],
  total: 123,
  page: 1,
  perPage: 25,
  pages: 5,
  actors: [{ nama, role, jumlah }],
  kinds: [{ jenis, label, jumlah }],
  summary: { hariIni, keputusan, unggahan, kritis, total }
}
```

### 3.3 Strategi query

Volume produksi saat ini kecil (`audit_log` 268, `status_history` 241, `log_upload` 82), sehingga:

1. Query ketiga tabel dengan filter rentang tanggal (dan filter yang bisa didorong ke SQL: aktor untuk `audit_log`/`status_history`, `id_pengajuan` untuk pencarian ID).
2. Normalisasi di JS, merge, dedupe, sort menurun.
3. Filter `jenis`/`target`/`q` diterapkan setelah normalisasi (karena `jenis` adalah hasil turunan).
4. Paginasi di memori setelah filter, dengan **hard cap 5.000 event** per request; bila lebih, potong setelah sort dan tandai `truncated: true` agar UI memberi tahu.

Alasan tidak SQL UNION: bentuk kolom berbeda dan `jenis`/`ringkasan`/`sebelum`/`sesudah` adalah turunan yang lebih mudah diuji sebagai fungsi murni di JS.

---

## 4. Bentuk Data Ternormalisasi

### 4.1 Skema event (kontrak UI)

```js
{
  id: 'audit:123',              // prefix sumber + row id
  waktu: '2026-11-05T08:17:06', // ISO UTC, sama seperti isi DB
  aktor: 'Devi',
  aktorRole: 'Admin',
  inisial: 'DV',
  jenis: 'VerifyBayar',
  sumber: 'audit_log',          // audit_log | status_history | log_upload
  targetJenis: 'Pembayaran',    // pengajuan | pembayaran | berita acara | berkas | checkdata | master data | akun
  targetId: 'INHAL-388dd8de',
  ringkasan: 'Memvalidasi pembayaran Rp250.000 (sesuai tagihan)',
  meta: { nominal: 250000, kesesuaian: 'pas' },
  alasan: '',
  sebelum: { status: 'menunggu', nominal: 0 },   // opsional
  sesudah: { status: 'valid', nominal: 250000 }  // opsional
}
```

### 4.2 Pemetaan per sumber

**`audit_log`** (`timestamp, actor_email, aksi, target, detail, alasan`)

| `aksi` | `jenis` | `targetJenis` | `ringkasan` | `sebelum/sesudah` |
| --- | --- | --- | --- | --- |
| `UPDATE` + `target=Pengajuan` | `UpdatePengajuan` | Pengajuan | dari `detail.idPengajuan` + daftar field berubah | field dari `detail` (nilai baru); sebelum hanya bila tersedia |
| `UPDATE` + `target=DetailKegiatan` | `UpdatePengajuan` | DetailKegiatan | "Mengubah detail kegiatan" | dari `detail` |
| `UPDATE` + `target=CheckData` | `UpdatePengajuan` | CheckData | "Mengoreksi biaya pengajuan" | `biaya`/`cleared` |
| `DELETE` + `target=Pengajuan` | `DeletePengajuan` | Pengajuan | "Menghapus pengajuan beserta N baris terkait" | — |
| `DELETE` + `target=DetailKegiatan` | `DeletePengajuan` | DetailKegiatan | "Menghapus detail kegiatan" | baris lama dari `detail` |
| `UPLOAD_BUKTI_ADMIN` | `UploadAdmin` | Pengajuan | "Admin mengunggah bukti bayar" | — |
| `RESET_UPLOAD` | `ResetUpload` | Pengajuan | "Mereset unggahan mahasiswa" | link lama → kosong |
| `VERIFY` | `VerifyBayar` | Pembayaran | nominal + kesesuaian | status menunggu → valid |
| `CORRECT` | `CorrectBayar` | Pembayaran | mode + status baru | `mode`, `statusBaru` |
| `DENY` | `Deny` | Pengajuan | "Percobaan mengubah keputusan ditolak sistem" | `dari` → `ke` |
| `BA_CREATE` | `BaCreate` | Berita Acara | jenis BA + jumlah peserta | — |
| `BA_UPDATE` | `BaUpdate` | Berita Acara | field yang diubah | — |
| `BA_DELETE` | `BaDelete` | Berita Acara | jenis BA | — |
| `FILE_ACCESS` | `FileAccess` | Berkas | "Membuka berkas ..." | — |
| `RENAME_MASTER` | `RenameMaster` | Master Data | dari → ke | `dari` → `ke` |
| lainnya | `Lainnya` | `target` apa adanya | `aksi` + potongan `detail` | — |

Catatan: `detail` kadang JSON, kadang teks biasa (`FILE_ACCESS`). Parser harus defensif: coba `JSON.parse`, jika gagal simpan sebagai `meta.detail` string.

**`status_history`** (`timestamp, id_pengajuan, status, catatan, actor_email`)

- `jenis`: `ACC` → `ACC`; `Ditolak` → `Tolak`; `Dibatalkan` → `Batal`; `Menunggu` → `Menunggu`.
- `aktor`: `actor_email` (di DB prod berisi nama, mis. `dr. Desi Isnayanti,M.Pd.Ked`).
- `aktorRole`: `Verifikator` bila nama ada di `VERIFIKATOR_NAMES` (`src/policy.js`), selain itu `Admin`.
- `sebelum`: status riwayat sebelumnya untuk `id_pengajuan` yang sama (diurutkan naik); `sesudah`: `status`.
- `ringkasan`: "ACC pengajuan" / "Menolak pengajuan" / "Membatalkan pengajuan" / "Mengembalikan ke Menunggu" + `id_pengajuan`.
- `alasan`: `catatan`.

**`log_upload`** (`timestamp, id_pengajuan, npm, nama_lengkap, blok, jenis_kegiatan, detail, tanggal, link_acc_inhal, link_bukti_bayar`)

- `jenis`: `UploadMahasiswa` secara default; `UploadAdmin` bila `detail` = `'Unggah bukti bayar oleh admin'`.
- `aktor`: `nama_lengkap` untuk unggahan mahasiswa; nama admin dari pasangan `audit_log` bila ada, jika tidak `'Admin'`.
- `aktorRole`: `Mahasiswa` / `Admin`.
- `targetJenis`: `Pengajuan`; `targetId`: `id_pengajuan`.
- `ringkasan`: "Mahasiswa mengunggah bukti bayar (jenis_kegiatan)" / "Admin mengunggah bukti bayar atas nama X".
- `meta`: `namaMahasiswa`, `npm`, `blok`, `jenisKegiatan`, `berkas` (nama file dari URL `link_bukti_bayar`), `tanggal`.

**Aturan dedupe** (penting):

`log_upload` ikut ditulis saat admin mengunggah bukti (`UPLOAD_BUKTI_ADMIN`) dan saat reset (`RESET_UPLOAD`), sehingga akan dobel dengan `audit_log`. Aturan:

> Buang baris `log_upload` bila ada baris `audit_log` dengan `target` Pengajuan, aksi `UPLOAD_BUKTI_ADMIN` atau `RESET_UPLOAD`, `idPengajuan` sama, dan selisih `timestamp` ≤ 10 detik.

`UPLOAD_BUKTI_ADMIN`/`RESET_UPLOAD` dipertahankan karena memuat aktor admin yang sebenarnya.

---

## 5. UI / Tampilan

### 5.1 Penempatan tab

`public/dashboard.html`:

- `TAB_KEYS` (`:2898`): `['pengajuan', 'manual', 'stats', 'ba', 'master']` → tambah `'riwayat'` **di akhir** (setelah `master`).
- `navItems` (`:3056`): tambah `{ key: 'riwayat', icon: 'bi-clock-history', label: 'Riwayat' }` **setelah** item Master Data.
- `switchTab`/`refreshTab` (`:3908`, `:3934`): tambah cabang `if (tab === 'riwayat' && !this.loaded.riwayat) this.loadRiwayat();` dan refresh saat filter berubah.
- Bottom nav mobile (`:2626`) **tidak diubah** (sudah 4 tombol: Pengajuan, BA, Master, Menu). Tab Riwayat diakses lewat sheet "Menu" (`navItems`) yang sudah otomatis.
- Guard akses: seluruh tab hanya dirender bila `loggedIn`; RPC tetap dijaga `requireAdmin`.

### 5.2 Struktur halaman (mengikuti konsep 02)

Mockup acuan: `mockups/riwayat-aktivitas/02-feed-timeline.html`.

```
[Header tab: judul + penjelasan singkat]            [Ekspor XLSX]
[Filter bar: Dari | Sampai | Aktor | Jenis | Cari | Terapkan | Reset]
[Chip cepat: Semua | ACC | Ditolak | Unggahan | Verifikasi Bayar | BA | Akses Ditolak]
[Grid 2 kolom]
  kiri  : kartu "Linimasa"
            hari (sticky) + jumlah aktivitas
            feed-item: jam · titik warna · aktor · ringkasan
                       badge jenis · ID target · target · sumber
                       alasan (italic, bila ada)
            paginasi bawah (Menampilkan x–y dari n)
  kanan : kartu "Hari" (lompat tanggal)
          kartu "Legenda" (warna per kelompok aksi + jumlah)
          kartu "Sorotan" (Deny, Delete, CorrectBayar, ResetUpload)
```

Mobile: satu kolom; sidebar pindah ke bawah feed; filter bertumpuk (grid 2 kolom → 1 kolom).

### 5.3 Drawer detail (konsep 01)

Klik baris / kartu membuka drawer kanan (`mockups/riwayat-aktivitas/01-tabel-drawer.html`):

1. Header: "Detail Aktivitas", waktu lengkap, ID target.
2. Info grid: Aktor, Peran, Jenis Aksi (badge), Sumber Data, Target, ID Target.
3. Ringkasan + alasan/catatan (bila ada).
4. Rincian (`meta`) sebagai key-value; nominal diformat Rupiah.
5. **Sebelum → Sesudah**: tabel field | sebelum | sesudah; field yang berubah diberi warna (`rose`/`green`). Bila tidak ada diff, bagian ini tidak dirender.
6. Payload mentah: JSON dari `audit_log.detail` (atau objek normalisasi untuk sumber lain), `<pre>` gelap.
7. Footer: Tutup · Buka pengajuan (tautan `/detail-laporan#<id>` atau pembukaan detail pengajuan yang ada) · Salin ID.

### 5.4 Ekspor XLSX

Tombol "Ekspor XLSX" di header. Perilaku:

- Memakai filter aktif, mengambil seluruh hasil (bukan hanya halaman aktif) lewat `getActivityLog` dengan `perPage: 5000` (atau argumen `all: true`).
- Kolom: `Waktu`, `Aktor`, `Peran`, `Jenis Aksi`, `Target`, `ID Target`, `Ringkasan`, `Alasan`, `Sumber`.
- Nama file: `riwayat-aktivitas-YYYY-MM-DD.xlsx`.
- Memakai SheetJS yang sudah dimuat dashboard (`window.XLSX`, pola `exportPemeriksaanBa` di `public/dashboard.html:5169`).

### 5.5 Gaya

Ikuti token dashboard yang ada (Tailwind + `app.css`): kartu `dash-card`, badge status, warna aksi:

| Kelompok | Warna |
| --- | --- |
| Keputusan ACC | hijau |
| Ditolak / Dibatalkan / Deny | rose / slate |
| Pembayaran | teal |
| Berita Acara | violet |
| Master Data | amber |
| Berkas / Akun | slate |
| Data (update/delete) | brand |

Format waktu memakai `AppCommon.formatTanggalWaktu` (tanggal `dd/mm/yyyy hh:mm`) dan zona Asia/Jakarta bila ditampilkan lengkap. Di feed, tampilkan `HH:MM` + tanggal pada header hari.

---

## 6. Schema & Performa

**Tidak ada tabel/kolom baru.** Hanya index baca (opsional tapi disarankan) lewat migrasi baru `migrations/2026-11-06-activity-log-indexes.sql`:

```sql
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_status_history_timestamp ON status_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_log_upload_timestamp ON log_upload(timestamp);
```

Catatan: `status_history` & `log_upload` sudah punya index per pengajuan, belum per waktu. `audit_log` belum punya index sama sekali.

Tanpa index pun fungsional untuk volume sekarang (591 baris total); index mencegah pemindaian penuh saat data tumbuh.

---

## 7. File yang Akan Tersentuh (saat implementasi disetujui)

Baru:

- `new-code1-cf/src/read/activity.js`
- `new-code1-cf/test/activity-normalize.test.js`
- `new-code1-cf/test/dashboard-riwayat.test.js` (template)
- `new-code1-cf/migrations/2026-11-06-activity-log-indexes.sql`

Diubah:

- `new-code1-cf/src/rpc.js` (import + handler `getActivityLog`)
- `new-code1-cf/public/dashboard.html` (tab key, nav item, section markup, state/computed/method, load, export)
- `new-code1-cf/public/app.css` (kelas `.act-*`, `.feed-*`, `.day-*`, `.heat-*` bila ringkasan ikut; minimal feed + drawer)
- `new-code1-cf/public/_headers` + `new-code1-cf/src/security/csp.js` (hasil `npm run csp:generate`)
- `new-code1-cf/schema.sql` (hanya bila index dimasukkan ke skema acuan; mengikuti konvensi repo)

Tidak diubah: semua `src/write/*`, `src/audit.js`, `src/policy.js`, alur email, portal mahasiswa.

---

## 8. Pengujian

Unit (`test/activity-normalize.test.js`):

1. `normalizeAudit` memetakan tiap `aksi` ke `jenis`/`targetJenis` yang benar.
2. `detail` JSON valid dan teks biasa tidak membuat crash.
3. `normalizeStatus` mengisi `sebelum` dari riwayat sebelumnya per pengajuan.
4. `normalizeUpload` membedakan unggahan mahasiswa vs admin.
5. Dedupe `log_upload` vs `UPLOAD_BUKTI_ADMIN`/`RESET_UPLOAD` dalam 10 detik.
6. Merge + sort menurun stabil; tie-breaker konsisten.
7. Filter `jenis`/`target`/`q`/rentang tanggal.
8. Paginasi clamp (`page` > `pages` → halaman terakhir).
9. `summarize` menghitung keputusan/unggahan/kritis.

Template (`test/dashboard-riwayat.test.js`):

1. `#app` tetap valid (`@vue/compiler-dom` tanpa error).
2. `TAB_KEYS` memuat `'riwayat'` di akhir; `navItems` memuat label `Riwayat` setelah `Master Data`.
3. Markup feed: `day-head`, `feed-item`, `chip`, filter, pager, tombol ekspor, drawer.
4. Tidak ada tombol aksi tulis di tab (read-only).
5. Helper berargumen tetap `methods` (aturan computed tanpa parameter, lihat `test/dashboard-template.test.js:331`).

Regresi: seluruh suite (`npx vitest run`), `npm run csp:check`, dan smoke lokal Playwright untuk alur: buka tab → filter → klik entri → drawer diff → ekspor.

---

## 9. Urutan Rilis (setelah disetujui)

1. `npx vitest run` (semua lulus).
2. `npm run csp:generate` lalu `npm run csp:check` (CSP sinkron).
3. Smoke lokal (wrangler dev + seed) untuk tab Riwayat.
4. Commit (pesan gaya repo, mis. `feat(dashboard): tambah tab Riwayat Log`).
5. `git push origin main`.
6. `CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy --config wrangler.production.toml`.
7. Verifikasi endpoint `getActivityLog` dan tab di produksi.

Tidak dikerjakan tanpa perintah eksplisit.

---

## 10. Risiko & Catatan

1. **Aktor `log_upload` tidak tercatat** di DB. Solusi: label mahasiswa dari `nama_lengkap`; untuk unggahan admin ambil dari `audit_log` pasangannya. Bila tidak ada pasangan, tampil `Admin` tanpa nama.
2. **Zona waktu**: `timestamp` disimpan UTC (`nowIso`). Filter tanggal di UI harus dikonversi ke rentang UTC yang mencakup hari lokal (Asia/Jakarta, +7) agar entri dini hari tidak hilang. Rencana: `dari` 00:00 WIB → `dari - 1 hari T17:00:00Z`; `sampai` 23:59 WIB → `sampai T16:59:59Z`.
3. **`actor_email` berisi nama**, bukan email. Jangan menampilkan sebagai tautan email.
4. **Duplikasi** `log_upload` vs `audit_log` bila aturan dedupe meleset; uji dengan data seed yang meniru `resetUploadBukti`/`uploadBuktiAdmin`.
5. **Celah data** yang sudah disepakati tidak ditutup: perubahan Master Data dan login/logout tidak akan muncul.
6. **Volume masa depan**: hard cap 5.000 + index waktu. Bila tumbuh besar, pertimbangkan paginasi per sumber di SQL.

---

## 11. Pengingat

Status masih **PENDING**. Jangan implementasi sebelum user memberi arahan.

Saat user kembali, ingatkan:

- Modul Riwayat Log sudah dirancang dan disimpan di dokumen ini.
- Mockup review: `mockups/riwayat-aktivitas/` (konsep 02 dipilih, drawer diff dari konsep 01).
- Langkah berikutnya bila disetujui: implementasi `src/read/activity.js` + RPC `getActivityLog` + tab `Riwayat` setelah Master Data + ekspor XLSX + tes + CSP + rilis.
