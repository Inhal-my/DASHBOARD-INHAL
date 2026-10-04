# Desain: Monitoring Kegiatan, Tanggal, dan Berita Acara

Tanggal: 2026-09-14
Status: menunggu review user
Area: `new-code1-cf` (dashboard.html, detail-laporan.html, src/write/beritaAcara.js, src/read/dashboard.js, src/read/laporan.js, schema.sql, migrations/)

## 1. Latar belakang

Saat ini tanggal tersebar di lima tempat tanpa sinkronisasi:

| # | Lokasi | Arti |
|---|--------|------|
| 1 | `detail_kegiatan.tanggal_pelaksanaan` | tanggal rencana per baris kegiatan |
| 2 | `pengajuan.tanggal_pelaksanaan` | tanggal pada "Keterangan Dosen" (manual) |
| 3 | `berita_acara_admin.tanggal_pelaksanaan` | tanggal BA Pendukung |
| 4 | `berita_acara.tanggal_pelaksanaan` | tanggal BA Pelaksanaan |
| 5 | `check_data.tanggal_pelaksanaan` | turunan / absensi |

Akibatnya: satu kegiatan bisa punya beberapa tanggal yang saling bertentangan, pencocokan BA ke kegiatan memakai kunci fuzzy (NPM + nama kegiatan, mengabaikan tanggal), dan tidak ada tampilan yang menyatukan riwayat proses dari pendaftaran sampai selesai.

Tujuan desain ini: menjadikan **BA Pelaksanaan sebagai satu-satunya sumber kebenaran** untuk tanggal-waktu dan dosen pelaksanaan, lalu menyajikan satu halaman rekapitulasi per kegiatan (dengan drill-down per mahasiswa) yang lengkap, akurat, dan profesional.

## 2. Keputusan yang sudah disetujui

1. **Unit rekap = dua level (C):** tabel per **kegiatan**, bisa di-expand untuk melihat **mahasiswa** di dalamnya.
2. **Enam tahapan** dipakai sebagai tulang punggung progres. Tahap 6 (Selesai) = BA Pelaksanaan ada **dan** nama dosen ada **dan** tanggal+jam pelaksanaan ada.
3. **BA Pelaksanaan = per sesi.** Satu BA = satu tanggal + satu jam + satu dosen untuk sekelompok peserta. Multi-sesi = banyak baris BA.
4. **Dosen & jam = atribut BA** (level sesi/kegiatan), bukan per mahasiswa. Satu BA maksimal satu dosen.
5. **Bagian wajib** mengisi tanggal+jam+dosen; **admin boleh** mengisi juga (fleksibel saling isi).
6. **Penyimpanan jam = kolom terpisah** `jam` di kedua tabel BA; `tanggal_pelaksanaan` disimpan sebagai date-only. Data lama ikut dirapikan saat migrasi.
7. **Rencana hanya info sekunder (C):** tidak ada kolom khusus, tidak ada hitungan deviasi. Ditampilkan sebagai ikon info bila ada.
8. **Penempatan (C):** dashboard memakai struktur baris kegiatan versi ringkas + aksi; detail-laporan memakai versi lengkap + ekspor.
9. **Ubah atribut BA lewat modal "Kelola BA"** (bukan inline).
10. **Sync otomatis:** saat BA Pelaksanaan disimpan, `pengajuan.dosen` + `pengajuan.tanggal_pelaksanaan` semua peserta BA itu diperbarui.
11. **Satu mahasiswa = satu BA Pelaksanaan per kegiatan.** Tidak ada konflik multi-sesi.
12. **Progres 3-warna:** hijau = semua peserta lolos tahap, kuning = sebagian, abu = belum; tooltip menampilkan hitungan (mis. "Diterima 3/5").
13. **Hapus BA Pelaksanaan →** `pengajuan.dosen` & `tanggal_pelaksanaan` peserta dikosongkan.
14. **Validasi unggah:** file + tanggal wajib; jam & dosen boleh menyusul (tahap 6 baru aktif setelah lengkap).
15. **Form manual Dosen & Tanggal Pelaksanaan di panel pengajuan dinonaktifkan** (read-only); hanya berubah lewat BA.
16. **Email di luar cakupan.** Email tidak memuat dosen/tanggal; ACC Final dipicu setelah admin memeriksa bukti bayar.
17. **Data BA lama sudah dihapus manual** oleh user; tidak ada backfill. Nilai lama `pengajuan.dosen`/`tanggal_pelaksanaan` dibersihkan saat migrasi.
18. **Kolom Biaya hanya di detail-laporan.**

## 3. Model data

### 3.1 Kunci kegiatan

```
kegiatan_key = norm(bagian) + '|' + norm(blok) + '|' + norm(nama_kegiatan)
```
`norm` = trim, ubah ke huruf kecil, rapikan spasi ganda. `nama_kegiatan` untuk BA Pelaksanaan = `pilihan` + (` - ` + `detail`) bila detail ada. Kunci ini konsisten dengan grouping `getBagianAggregation` yang sudah ada.

### 3.2 Perubahan skema

Pada `berita_acara` (BA Pelaksanaan):
```sql
ALTER TABLE berita_acara ADD COLUMN jam TEXT;
ALTER TABLE berita_acara ADD COLUMN dosen TEXT;
ALTER TABLE berita_acara ADD COLUMN kegiatan_key TEXT;
CREATE INDEX IF NOT EXISTS idx_ba_kegiatan_key ON berita_acara(kegiatan_key);
```

Pada `berita_acara_admin` (BA Pendukung):
```sql
ALTER TABLE berita_acara_admin ADD COLUMN jam TEXT;
ALTER TABLE berita_acara_admin ADD COLUMN kegiatan_key TEXT;
CREATE INDEX IF NOT EXISTS idx_ba_admin_kegiatan_key ON berita_acara_admin(kegiatan_key);
```

Bersihkan nilai lama:
```sql
UPDATE pengajuan SET dosen = '', tanggal_pelaksanaan = '';
```

`schema.sql` diperbarui agar instalasi baru langsung memuat kolom-kolom ini.

Migrasi disimpan sebagai `migrations/2026-09-14-ba-tanggal-dosen.sql` dan dijalankan mengikuti pola di `DEPLOY.md`.

### 3.3 Aturan turunan & sinkronisasi

- **Saat simpan BA Pelaksanaan** (buat/ubah): untuk setiap peserta BA, set `pengajuan.dosen = ba.dosen` dan `pengajuan.tanggal_pelaksanaan = ba.tanggal` + (`T` + `ba.jam` bila jam ada).
- **Saat hapus BA Pelaksanaan:** kumpulkan daftar peserta lebih dulu, lalu kosongkan `pengajuan.dosen` & `pengajuan.tanggal_pelaksanaan` untuk peserta tersebut sebelum baris BA & peserta dihapus.
- `pengajuan.tanggal_pelaksanaan` tetap menyimpan gabungan tanggal+jam (untuk tampilan lama); `jam` terpisah hanya di tabel BA.
- BA Pendukung tidak menyinkronkan dosen (dosen hanya milik Pelaksanaan). Jam BA Pendukung hanya informasi di modal.

### 3.4 Perhitungan tahapan (tanpa tabel baru)

Untuk tiap `kegiatan_key`:

| Tahap | Syarat | Level |
|-------|--------|-------|
| 1 Pendaftaran | ada baris pengajuan | mahasiswa |
| 2 BA Pendukung | ada `berita_acara_admin` dgn kunci cocok (maks 1) | kegiatan |
| 3 Keputusan | status ∈ {Diterima, Ditolak} | mahasiswa |
| 4 ACC Final | `link_final ≠ ''` | mahasiswa |
| 5 BA Pelaksanaan | ada `berita_acara` dgn kunci cocok | kegiatan |
| 6 Selesai | ada `berita_acara` dgn `dosen ≠ ''` **dan** tanggal **dan** jam | kegiatan |

Tahap per-mahasiswa (1, 3, 4) dirender 3-warna; tahap kegiatan (2, 5, 6) hijau bila terpenuhi.

### 3.5 Anomali yang ditandai

- `realisasi ≠ rencana` — hanya sebagai info, bukan kolom (keputusan 7).
- `BA tanpa pengajuan` — `kegiatan_key` tidak cocok dengan pengajuan mana pun.
- `Diterima/ACC tapi ACC Final kosong`.
- `BA Pelaksanaan ada tapi dosen/jam/tanggal kosong` (belum Selesai).

### 3.6 Risiko yang perlu dijaga

- `kegiatan_key` bergantung pada kesesuaian `nama_kegiatan`. Untuk BA Pendukung maupun Pelaksanaan, nilai `nama_kegiatan` harus sama dengan `pilihan` (+ `- detail`) milik peserta; bila tidak, BA akan muncul sebagai "BA tanpa pengajuan". Penulisan `nama_kegiatan` harus diambil dari sumber yang sama (bukan ketikan bebas) bila memungkinkan.
- `pengajuan.tanggal_pelaksanaan` menyimpan gabungan `tanggal` + `T` + `jam`. Bila jam kemudian diubah lewat modal, field ini harus ikut ditulis ulang (bukan hanya kolom `jam`).

## 4. API / RPC

- `saveBeritaAcaraBagian` (ada) — ditambah penerimaan `jam`, `dosen`, penyimpanan `kegiatan_key`, dan sinkronisasi `pengajuan`.
- `saveBeritaAcaraAdmin` (ada) — menyimpan `jam` + `kegiatan_key`; menolak bila sudah ada BA Pendukung dengan `kegiatan_key` sama (maksimal satu per kegiatan).
- `updateBeritaAcaraBagian` (baru) — untuk modal "Kelola BA": ubah `tanggal`, `jam`, `dosen`, `catatan`, ganti file. Boleh diakses admin maupun sesi Bagian yang berhak. Menyinkronkan ulang `pengajuan` peserta.
- `updateBeritaAcaraAdmin` (baru) — untuk kelola BA Pendukung: `tanggal`, `jam`, `catatan`, ganti file.
- `deleteBeritaAcaraBagian` (ada) — ditambah pengosongan `pengajuan.dosen`/`tanggal_pelaksanaan` peserta.
- `deleteBeritaAcaraAdmin` (ada) — perilaku tetap.

Semua penulisan menyimpan `kegiatan_key` hasil hitung dari bagian+blok+nama_kegiatan.

## 5. UI / UX

### 5.1 Dashboard — tab Berita Acara (ringkas + aksi)

Kolom: chevron · Kegiatan · Progres · Realisasi (tanggal·jam) · ikon rencana · Dosen · Peserta · Pendukung · Pelaksanaan · Aksi.

- Progres: 6 titik 3-warna + tooltip hitungan.
- Aksi: Unggah Pelaksanaan / Kelola BA / Hapus.
- Tanpa kolom Biaya.

### 5.2 detail-laporan — tab Berita Acara (lengkap + ekspor)

Kolom: chevron · Bagian · Blok · Kegiatan · Progres · Realisasi · ikon rencana · Dosen · Peserta · Pendukung · Pelaksanaan · Biaya · Aksi.

- Mempertahankan baris Subtotal per bagian + Grand Total dan tombol Ekspor XLSX.
- Kolom Biaya hanya di sini.

### 5.3 Drill-down mahasiswa (dipakai di kedua halaman)

Kolom: Nama/NPM · Tanggal Daftar · Status · No. Surat · ACC Final · Bukti · Biaya (+ aksi hapus untuk admin di detail-laporan).

### 5.4 Modal "Kelola BA"

Field: tanggal · jam · dosen · catatan · tombol Ganti File · tombol Hapus. Dapat dibuka admin maupun Bagian (sesuai hak). Validasi: tanggal tidak boleh kosong; jam/dosen boleh kosong.

### 5.5 Drawer "Riwayat Proses"

Muncul saat baris kegiatan diklik. Isi (waktu dari `timestamp` tiap dokumen):

- Pendaftaran — rentang tanggal daftar + jumlah mahasiswa.
- BA Pendukung — waktu unggah + BA ID.
- Keputusan — waktu dari `status_history` (Diterima/Ditolak).
- ACC Final — waktu dari `status_history` status ACC.
- BA Pelaksanaan — waktu unggah + realisasi tanggal·jam + dosen.
- Selesai — penanda tahap 6.

### 5.6 Tab lain di detail-laporan

- Tab Rekap (per mahasiswa) tetap ada; kolom Dosen & Tanggal Pelaksanaan jadi read-only dari BA.
- Panel pengajuan di dashboard: input Dosen & Tanggal Pelaksanaan dinonaktifkan.

## 6. Penanganan kasus tepi

- **BA tanpa pengajuan:** tetap ditampilkan sebagai baris tersendiri dengan badge `BA tanpa pengajuan`; tidak masuk hitungan kartu.
- **Kegiatan tanpa rencana tanggal:** ikon rencana disembunyikan.
- **BA Pelaksanaan tanpa dosen/jam:** tampil "Ada" di tahap 5, tetapi tahap 6 tetap belum (badge "Belum lengkap").
- **Status sebagian:** progres kuning + tooltip hitungan.
- **Ganti file:** atribut tanggal/jam/dosen/catatan dipertahankan; hanya file yang diganti.

## 7. Pengujian

- Unit test (`test/write-berita-acara.test.js` dan tambahan):
  - simpan BA Pelaksanaan menyimpan `jam`, `dosen`, `kegiatan_key`;
  - sinkronisasi `pengajuan.dosen`/`tanggal_pelaksanaan` ke semua peserta;
  - hapus BA mengosongkan field peserta;
  - `updateBeritaAcaraBagian` mengubah atribut & re-sync;
  - perhitungan `kegiatan_key` konsisten dengan grouping.
- Template test (`test/dashboard-template.test.js`): kompilasi template tanpa error, kolom baru muncul, tidak ada kolom Biaya di dashboard.
- Uji manual di `inhal-poc`: unggah BA Pelaksanaan sebagian (tanpa dosen) → tahap 6 belum; lengkapi via modal → tahap 6 hijau; hapus BA → field pengajuan kosong.

## 8. Di luar cakupan

- Perubahan email dan templat Apps Script.
- Rename worker/subdomain (`inhal-poc` → `inhal-online`).
- Perombakan tab Rekap selain menjadikan Dosen/Tanggal read-only.
- Tabel baru untuk sesi/riwayat (cukup diturunkan dari data yang ada).

## 9. File yang dipengaruhi

- `new-code1-cf/schema.sql`
- `new-code1-cf/migrations/2026-09-14-ba-tanggal-dosen.sql` (baru)
- `new-code1-cf/src/write/beritaAcara.js`
- `new-code1-cf/src/rpc.js`
- `new-code1-cf/src/read/dashboard.js`
- `new-code1-cf/src/read/laporan.js`
- `new-code1-cf/public/dashboard.html`
- `new-code1-cf/public/detail-laporan.html`
- `new-code1-cf/test/write-berita-acara.test.js`
- `new-code1-cf/test/dashboard-template.test.js`
