# Desain Materi Praktikum (Portal + Panel Bagian)

Tanggal: 27 Oktober 2026
Status: **DESAIN DISETUJUI — IMPLEMENTASI BELUM DIKERJAKAN.** Menunggu pemeriksaan lanjutan dari pemilik produk.
Model data: **Model B** (induk `master_praktikum` + anak `master_materi`).

## Tujuan

Admin dapat mengatur, per praktikum (pasangan **Lab + Kegiatan Lab**):

1. praktikum mana yang **dibuka** dan tampil di portal;
2. **jumlah dan nama materi** (rencana 4–6 materi) beserta urutannya.

Mahasiswa memilih **satu materi** saat mendaftar Praktikum, tepat di bawah field **Kegiatan Lab**.
Materi yang dipilih tampil di **Panel Bagian** agar staf tahu mahasiswa ikut materi yang mana.
Materi **bukan** bagian identitas kegiatan: jadwal dan Berita Acara tetap per `Lab - Kegiatan Lab`.

## Keputusan yang sudah disetujui

1. Satu mahasiswa memilih **satu** materi per pendaftaran.
2. Daftar materi disetel **per Lab + Kegiatan Lab**, bukan daftar global.
3. Materi hanya **info tambahan**; `kegiatan_key` (`bagian|blok|namaKegiatan`) tidak berubah.
4. Admin mengatur praktikum mana yang tampil lewat saklar `dibuka`.
5. Materi disimpan sebagai salinan di `detail_kegiatan.materi`; riwayat tidak berubah bila master diedit.
6. Data lama tanpa materi tetap valid dan ditampilkan sebagai "Tidak tercatat".

## Skema usulan

```sql
CREATE TABLE IF NOT EXISTS master_praktikum (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lab TEXT NOT NULL DEFAULT '',
  kegiatan_lab TEXT NOT NULL DEFAULT '',
  dibuka INTEGER NOT NULL DEFAULT 1,
  urutan INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_master_praktikum_unique
  ON master_praktikum(lower(trim(lab)), lower(trim(kegiatan_lab)));

CREATE TABLE IF NOT EXISTS master_materi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  praktikum_id INTEGER NOT NULL,
  materi TEXT NOT NULL DEFAULT '',
  urutan INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_master_materi_unique
  ON master_materi(praktikum_id, lower(trim(materi)));

ALTER TABLE detail_kegiatan ADD COLUMN materi TEXT NOT NULL DEFAULT '';
```

Backfill aman saat migrasi: isi `master_praktikum` dari `SELECT DISTINCT lab, kegiatan_lab FROM master_bagian`
dengan `dibuka = 1`, tanpa materi. Tujuannya agar pilihan praktikum di portal tidak hilang pada hari deploy.
Jika `master_praktikum` kosong, portal memakai perilaku lama (opsi dari `master_kegiatan`).

## Alur data

1. Admin mengisi Data Master → `master_praktikum` (buka/tutup) dan `master_materi` (4–6 materi).
2. `GET /api/registration-options` dan RPC `getRegistrationOptions` mengirim
   `praktikum: [{ lab, kegiatanLab, dibuka, materi: [...] }]`.
3. Portal: dropdown **Pilihan Lab** (hanya lab yang punya praktikum dibuka) →
   **Kegiatan Lab** (disaring per Lab) → **Materi** (hanya materi aktif, urut `urutan`).
   Materi direset saat Lab/Kegiatan Lab berubah.
4. Submit: `formData.praktikum = [{ lab, kegiatanLab, materi, tanggal }]`.
5. Server memvalidasi materi milik praktikum yang sama dan berstatus dibuka/aktif.
6. `buildDetailKegiatanRows` menyimpan `materi` ke `detail_kegiatan`.
7. Panel Bagian menampilkan materi per peserta (grup kegiatan, form jadwal, form BA).

## Perubahan per file (rencana)

### Database

- [ ] `new-code1-cf/schema.sql`: tabel `master_praktikum`, `master_materi`, kolom `detail_kegiatan.materi`, index, seed contoh.
- [ ] `new-code1-cf/migrations/2026-10-28-master-praktikum-materi.sql` (tanggal wajib setelah 2026-10-27).

### Data Master

- [ ] `src/write/master.js`: spec `MASTER_TABLES.master_praktikum` & `master_materi`; validasi pasangan Lab/Kegiatan Lab, `praktikum_id`, `dibuka`/`active` 0–1, `urutan` angka; tolak hapus praktikum/materi yang sudah dipakai.
- [ ] `src/read/dashboard.js`: `getMasterDataMonitor` → `masterPraktikum`, `masterMateri`.
- [ ] `src/read/columns.js`: mapping `master_praktikum`, `master_materi`, `detail_kegiatan.materi`.
- [ ] `public/dashboard.html`: 2 kartu di `master.cards`; modal generik mendukung `Dibuka`/`Aktif` (Ya/Tidak) dan pilihan praktikum induk; tampilkan "N materi".

### API

- [ ] `src/index.js` (`/api/registration-options`) dan `src/rpc.js` (`getRegistrationOptions`): kirim `praktikum` bertingkat.

### Portal & input manual

- [ ] `public/portal.html`: dropdown Materi di bawah Kegiatan Lab; filter bertingkat; reset otomatis; kirim `materi`.
- [ ] `public/dashboard.html`: field sama pada Input Manual + reset + kirim.

### Simpan & validasi

- [ ] `src/lib.js`: `buildDetailKegiatanRows` menyertakan `materi`; tinjau `buildPengajuanKey` (aturan duplikat).
- [ ] `src/pengajuan.js`: `INSERT INTO detail_kegiatan (... materi ...)`.
- [ ] `src/validation.js`: validasi materi terhadap `master_praktikum` + `master_materi`.
- [ ] `src/write/pengajuanAdmin.js`: validasi ulang saat admin mengubah detail.

### Panel Bagian & laporan

- [ ] `src/read/bagian.js`: `computeBagianRows` menambahkan `materi`.
- [ ] `public/bagian-state.js`: peserta membawa `materi`, grup memiliki `materiList`, `matchesQuery` mencocokkan materi.
- [ ] `public/bagian.html`: badge jumlah materi, materi per peserta (grup & form jadwal/BA), ringkasan di panel detail.
- [ ] Opsional: `public/detail-laporan.html` dan `src/write/email.js`.

### Tes & rilis

- [ ] Tes migrasi (tabel/kolom/index/idempoten/backfill).
- [ ] Tes master CRUD + validasi + monitor Title Case.
- [ ] Tes simpan pengajuan (valid / tidak cocok / kosong) dan `buildDetailKegiatanRows`.
- [ ] Tes endpoint opsi pendaftaran.
- [ ] `npm test`, `npm run migrations:check`, `npm run csp:generate` (hash CSP wajib diperbarui).
- [ ] Deploy berurutan: migrasi D1 (staging → produksi) sebelum deploy Worker.

## Aturan validasi & data lama

- Materi harus terdaftar pada praktikum (Lab + Kegiatan Lab) yang sama dan `active = 1`.
- Praktikum harus `dibuka = 1` agar bisa dipilih dari portal.
- `detail_kegiatan.materi` kosong = data lama / praktikum tanpa materi → tampil "Tidak tercatat".
- Perubahan atau penghapusan master **tidak** mengubah riwayat; nilai tersimpan tetap.
- Materi berbeda untuk praktikum yang sama: mengikuti keputusan pemilik produk (lihat pertanyaan terbuka).

## Jebakan yang harus dijaga

1. Jangan memasukkan materi ke kolom `detail` — `kegiatan_key` berubah dan BA/jadwal lama tidak cocok.
2. `buildDetailKegiatanRows` saat ini hanya menyimpan **baris praktikum pertama** (`test/lib.test.js`).
3. Data Master memakai label kartu sebagai kunci (`cols` harus sama dengan mapping `columns.js`).
4. Nama file migrasi harus bertanggal setelah `2026-10-27` (`scripts/check-migrations.mjs`).
5. Setiap perubahan `<script>` inline di `public/*.html` mengharuskan `npm run csp:generate`.
6. Praktikum yang dibuka sebaiknya punya pemetaan `master_bagian` agar email notifikasi punya tujuan yang benar.

## Pertanyaan terbuka (perlu jawaban sebelum implementasi)

1. Materi **wajib** atau opsional bila praktikum sudah punya daftar materi?
2. Boleh memilih **materi berbeda** untuk praktikum yang sama (mempengaruhi aturan duplikat pengajuan)?
3. Perlu **kuota per materi** sekarang atau nanti?
4. Materi ikut dicetak di **BA/PDF** atau cukup di layar Panel Bagian & laporan?
5. Bila admin menutup praktikum atau menghapus materi yang sudah dipakai: **tolak** (usulan) atau izinkan dengan peringatan?

## Cara melanjutkan (catatan untuk sesi berikutnya)

1. Baca file ini.
2. Konfirmasi jawaban 5 pertanyaan terbuka di atas.
3. Mulai Fase 1 (skema + migrasi + tes migrasi), lalu lanjut sesuai urutan checklist.
4. Status di file ini diperbarui menjadi "diimplementasikan" hanya setelah semua tes lulus dan deploy terverifikasi.

## Riwayat

- 2026-10-27: desain disetujui (Model B). Belum ada kode, skema, atau migrasi yang diubah.