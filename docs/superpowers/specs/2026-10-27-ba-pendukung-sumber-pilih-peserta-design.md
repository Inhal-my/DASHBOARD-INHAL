# Desain: Sumber Pilihan Peserta "Dari BA Pendukung" pada BA Pelaksanaan (Opsi A)

Tanggal: 2026-10-27
Status: **Fase 1 & 2 diimplementasi** (read layer + helper), Fase 3 & 4 masih rencana.
Terkait:
- `docs/superpowers/specs/2026-10-14-ba-pendukung-pelaksanaan-unifikasi-design.md` (koeksistensi BA Pendukung & BA Pelaksanaan)
- `docs/superpowers/specs/2026-10-16-bagian-jadwal-pelaksanaan-design.md`
- `docs/superpowers/specs/2026-10-17-bagian-workspace-v2-design.md` (definisi `selesai` → Riwayat)
- Kode: `new-code1-cf/src/read/bagian.js`, `new-code1-cf/src/write/beritaAcara.js`, `new-code1-cf/public/bagian.html`, `new-code1-cf/public/bagian-state.js`

> Dokumen ini catatan desain + rencana. Tidak ada perubahan DB/schema; semua tambahan bersifat *additive*.

---

## 1. Masalah

1. **Peserta BA Pendukung tidak bisa dipakai sebagai peserta BA Pelaksanaan.**
   Form BA Pelaksanaan hanya menawarkan peserta dari `pengajuan` × `detail_kegiatan` (`pengajuan` ACC yang belum jadi anggota BA, `groupRows()` di `public/bagian-state.js`). Peserta yang sudah masuk BA Pendukung tidak pernah muncul sebagai kandidat, jadi Bagian harus mengetik/memilih ulang dari daftar kegiatan — dan peserta yang hanya ada di BA Pendukung (mis. hasil input manual admin) tidak pernah bisa masuk BA Pelaksanaan dari halaman Bagian.

2. **BA tanpa berkas bisa "Selesai" dan menjadi jalan buntu.**
   `selesai` bukan status DB, melainkan flag turunan saat baca (`src/read/bagian.js:151-152`): `Dosen` + `Tanggal Pelaksanaan` + (`Jam` atau `jumlahSesi > 1`). `saveBeritaAcaraBagian` membuat berkas opsional (`src/write/beritaAcara.js:582`, `if (p.file && p.file.data)`), sehingga BA tanpa PDF bisa berstatus *selesai* → masuk Riwayat → UI Bagian menganggapnya final dan menyembunyikan aksi edit (`bagian.html:1065` daftar kerja, `:547` editor draft, `editDraftBaById:1376-1380`, `ensureSelection:1413-1424`). Padahal yang dimaksud "Selesai" di sini adalah **"siap unggah berkas"**.

## 2. Temuan Kode yang Menjadi Dasar Desain

- `selesai` murni derivasi baca; **tidak ada guard `selesai` di jalur tulis**: `lengkapiBeritaAcaraBagian` (`beritaAcara.js:722-753`) hanya menulis tanggal/jam/dosen/catatan/label (tidak bisa mengubah peserta); `updateBeritaAcaraBagian` (`:618-720`) bisa mengubah peserta/remap sesi/restore pengajuan tapi `requireAdmin` (`:619`); `deleteBeritaAcaraBagian` (`:515-539`) juga `requireAdmin` (`:516`).
- Kunci peserta untuk form BA = `idPengajuan` (bukan npm): checkbox `bagian.html:641-647`, `selectedList()` `:1020-1022`, `togglePeserta()` `:1573-1575`.
- Validasi server peserta BA: `validateBaPesertaStatus` (`beritaAcara.js:109-123`, status harus ada di `BAGIAN_BA_STATUSES`, default `['ACC']`) dan `validateBaPesertaKegiatan` (`:125+`, peserta harus punya `detail_kegiatan` yang cocok blok + nama kegiatan).
- BA Pendukung dibaca dari `berita_acara_admin` + `berita_acara_admin_peserta` (`active = 1`); **sudah** tersedia di bootstrap Bagian (`out.baPendukungList`, `src/read/bagian.js:191`) tetapi hanya berupa info read-only (`{npm, namaLengkap, blok}`).
- Satu jadwal → satu BA Pelaksanaan dijaga `resolveBaSesi`/`findSesiLink` (`beritaAcara.js:272-283`, `:303-306`).

## 3. Keputusan

- **Bentuk solusi: Opsi A — sumber pilihan baru "Dari BA Pendukung" di form BA Pelaksanaan.** Bukan jalur tulis baru, bukan auto-merge: BA Pendukung tetap *read-only* bagi Bagian; peserta BA Pendukung hanya menjadi *kandidat* yang bisa dicentang untuk dimasukkan ke BA Pelaksanaan.
- **P1 — "Selesai" bukan final.** `selesai` hanya boleh aktif bila BA sudah punya berkas; BA tanpa berkas tetap dapat diedit Bagian.
- **P2 — Bagian boleh mengoreksi sendiri BA milik bagiannya** (tanpa izin admin dashboard): peserta, dosen/jam/tanggal, berkas, dan menghapus BA yang belum berberkas. Keputusan C3: (i) Bagian **boleh** mengganti/mengunggah berkas walau BA sudah punya berkas; (ii) Bagian **boleh** menghapus BA yang belum berberkas lewat RPC non-admin baru.
- **P3 — `updateBeritaAcaraBagian` tetap admin-only** (`requireAdmin` tidak dilonggarkan). Jalur koreksi Bagian harus mekanisme terpisah (mis. memperluas jalur tulis Bagian yang sudah ada), bukan menurunkan guard endpoint admin.
- **Non-tujuan:** tidak mengubah alur/isi BA Pendukung (tetap domain admin), tidak menambah tabel/kolom, tidak mengubah perilaku BA Pelaksanaan selama sumber baru tidak dipakai, tidak mengubah teks PDF/format nomor BA.

## 4. Rencana Bertahap

| Fase | Cakupan | Status |
| --- | --- | --- |
| 1 | Read layer: peserta BA Pendukung membawa identitas kandidat + kegiatan key | Selesai |
| 2 | Helper murni merge/dedupe kandidat + toggle sumber | Selesai |
| 3 | UI form BA Pelaksanaan (`bagian.html`) + test template | Selesai |
| 4 | P1/P2: `selesai` wajib berkas + jalur koreksi/hapus Bagian + tes tambahan | Selesai |

### 4.1 Fase 1 — Read (`new-code1-cf/src/read/bagian.js`)

- `getBaAdminPesertaMap()` sekarang mengembalikan `{ idPengajuan, npm, namaLengkap, blok, statusPengajuan, urutan }` dan mengurutkan peserta `urutan` lalu `npm` sehingga urutan tampil deterministik.
- `computeBaPendukungList()` menambahkan `kegiatanKey` per BA Pendukung (dari kolom `kegiatan_key`, fallback `kegiatanKey(Bagian, Blok, Nama Kegiatan)`) agar pencocokan kegiatan tidak menebak ulang dari nama.
- Field lama (`npm`, `namaLengkap`, `blok`) tetap ada → panel read-only BA Pendukung di halaman Bagian tidak berubah.

### 4.2 Fase 2 — Helper (`new-code1-cf/public/bagian-state.js`)

Empat fungsi murni baru (diekspor di `window.BagianState`):

- `baPendukungFor(ref, baPendukungList)` — BA Pendukung untuk kegiatan tertentu; memakai `baForKegiatan` (tanggal sama lebih dulu, fallback terbaru).
- `pendukungPesertaList(baPendukung)` — peserta BA Pendukung ternormalisasi menjadi kandidat: `{ idPengajuan, npm, namaLengkap, blok, statusPengajuan, sumber: 'pendukung', pendukungBaId, pendukungFileUrl, pendukungFileName }`; dedupe lewat `pesertaKey` (`idPengajuan` → fallback `npm`).
- `mergeBaCandidates(ref, groupPeserta, baPendukungList, options)` — gabungan kandidat form BA:
  - `base`: peserta kegiatan (ditandai `punyaPendukung` + `pendukungBaId` bila juga ada di BA Pendukung),
  - `tambahan`: peserta BA Pendukung yang belum ada di `base`, berada di kegiatan BA ini (bila `options.rows` + `options.group` diberikan), dan statusnya lolos `options.statuses`,
  - `ditolak`: peserta BA Pendukung yang statusnya di luar `options.statuses`,
  - `tidakSesuai`: peserta BA Pendukung yang tidak punya baris peserta pada kegiatan BA ini (dilewati tanpa mengganggu pilihan lain),
  - `peserta`: `base` + (`options.includePendukung` ? `tambahan` : `[]`).
  - Filter `options.rows` murni UI: server tetap memvalidasi lewat `validateBaPesertaKegiatan` + `validateBaPesertaStatus`. Status yang dipakai adalah status **terkini** dari baris peserta (bila ada), bukan snapshot BA Pendukung, karena server membaca tabel `pengajuan`. Pencocokan kegiatan mengabaikan tanggal agar sama dengan aturan server (`kegiatanKey(bagian, blok, nama)`).
- `applyPendukungToggle(tambahan, selected, include)` — menyalakan/mematikan sumber pada peta pilihan peserta; karena `tambahan` hanya berisi peserta di luar `base`, mematikan sumber tidak membuang pilihan yang berasal dari kegiatan.

### 4.3 Fase 3 — UI (`public/bagian.html`)

1. State form BA: `ba.includePendukung` (default `false`), direset di `openBaPicker`,
   `openBaFromJadwal`, `closeBaPicker`, `closeDetail`, `resetDetailSilently`, dan `setTab`.
2. Computed `baCandidates` = `mergeBaCandidates({ blok, nama, tanggal } dari `selectedGroup`, `selectedGroup.peserta`, `baPendukungList`, `{ statuses: baConfig.statuses, includePendukung: ba.includePendukung, rows: this.rows, group: selectedGroup }`)`.
3. Daftar "Pilih Peserta" memakai `baCandidates.peserta`; baris `sumber === 'pendukung'` diberi badge "Dari BA Pendukung" beserta tautan berkas BA Pendukungnya.
4. Saklar `Dari BA Pendukung` (`togglePendukungSource()`) tampil hanya bila kegiatan punya BA Pendukung; catatan jumlah peserta yang masuk/ditolak/tidak sesuai tampil di panel BA Pendukung dan di atas daftar peserta.
5. `selectedCount()`, `selectedList()`, `allSelected()`, dan `toggleAllPeserta()` memakai `baCandidates.peserta` sehingga peserta dari sumber baru ikut terkirim ke `uploadBeritaAcaraBagian`.
6. Tidak ada blok script baru (hanya isi blok inline yang berubah), cukup `npm run csp:generate` + `npm run csp:check`.

### 4.4 Fase 4 — P1/P2 (domain read & tulis)

1. **P1 — "Selesai" wajib berkas.**
   - `src/read/bagian.js` (`computeBaList`): `copy.selesai` menuntut `File URL` terisi, sehingga BA tanpa berkas tetap di daftar kerja Bagian sebagai Draft.
   - `src/read/kegiatan.js` (`computeUnitProgress`): tahap `selesai` menuntut berkas; helper `baFile()` menerima kunci `file_url`, `fileUrl`, atau `File URL` karena bentuk baris BA berbeda antar pemanggil (dashboard memakai kunci kecil, halaman Bagian memakai kunci klien).
   - UI: item Draft BA tanpa berkas menampilkan "Berkas BA belum ada - unggah agar BA bisa Selesai" dan CTA "Unggah Berkas".
2. **P2 — jalur koreksi Bagian** (P3 tetap: `updateBeritaAcaraBagian` dan `deleteBeritaAcaraBagian` admin-only).
   - `lengkapiBeritaAcaraBagian(db, baId, payload, kategori, ctx)` menerima opsional `peserta`/`pesertaIds` dan opsional `file`. Guard: sesi Bagian + BA milik bagian tersebut.
   - Koreksi peserta divalidasi dengan aturan yang sama seperti upload pertama (`resolveBaPesertaInput` → `validateBaPesertaKegiatan` → `validateBaPesertaStatus`); baris peserta diganti, `jumlah_peserta` diperbarui, dan `buildRestorePengajuanStmts` mengembalikan dosen/tanggal pengajuan peserta yang dibuang.
   - Berkas: `saveDriveFile` prefix `ba-<baId>`; bila BA sudah berberkas, berkas lama dipindahkan ke trash (`trashDriveFile`) sehingga Bagian boleh mengganti berkas.
   - Baru: `deleteDraftBeritaAcaraBagian(db, baId, kategori, ctx)` — Bagian boleh menghapus BA yang **belum berberkas**; BA berberkas ditolak dengan pesan agar dihapus admin dashboard. RPC `deleteDraftBeritaAcaraBagian` didaftarkan di `src/rpc.js`.
   - UI: panel Draft BA punya pemilih peserta (termasuk sumber "Dari BA Pendukung"), unggah/ganti berkas PDF, dan tombol `Hapus Draft` (hanya tampil bila belum berberkas). `peserta` hanya dikirim bila pilihannya berubah (`lengkapiPesertaBerubah`) supaya penyimpanan biasa tidak tertahan validasi peserta.
3. `getBaPesertaMap()` (`src/read/bagian.js`) ikut membawa `idPengajuan` + `statusPengajuan` agar panel Draft BA bisa memuat pilihan peserta BA saat ini.

## 5. Testing

Sudah ditambahkan:
- `test/read-bagian.test.js` — peserta BA Pendukung membawa `idPengajuan`, `statusPengajuan`, urut `urutan`, peserta `active = 0` tidak ikut, `kegiatanKey` benar (`ujian|a|uas`).
- `test/bagian-state.test.js` — dedupe `pendukungPesertaList`, `baPendukungFor` (cocok/tidak cocok), `mergeBaCandidates` (base + tambahan + ditolak, tanpa `statuses`, kegiatan tanpa BA Pendukung), `applyPendukungToggle` (nyala/mati tanpa membuang pilihan kegiatan).

Rencana tes Fase 3/4: `test/bagian-template.test.js` & `test/bagian-workspace-v2.test.js` (tombol sumber + badge), `test/bagian-state.test.js` (komposisi kandidat saat mode jadwal multi-sesi), `test/write-berita-acara.test.js` (P1: BA tanpa berkas belum "selesai"; P2: koreksi Bagian ditolak untuk BA berberkas dan untuk sesi non-Bagian), `test/read-kegiatan-progress.test.js` bila aturan `selesai` di `kegiatan.js` ikut berubah.

Ditambahkan di Fase 3/4:
- `test/bagian-state.test.js` — `mergeBaCandidates` gagal-lolos saat `rows` tidak memuat peserta BA Pendukung (`tidakSesuai`), status terkini dari baris peserta lebih kuat daripada snapshot BA Pendukung, dan tanggal baris yang berbeda tidak menggugurkan peserta.
- `test/bagian-workspace-v2.test.js` — saklar `Dari BA Pendukung`, `baCandidates.peserta`, catatan `jumlahTambahan`/`jumlahDitolak`/`jumlahTidakSesuai`, `lengkapiCandidates`, `onLengkapiFile`, `lengkapiPesertaBerubah`, `Hapus Draft`, dan CTA `Unggah Berkas`.
- `test/read-kegiatan-progress.test.js` — tahap `selesai` menuntut berkas pada kunci `file_url`/`fileUrl`/`File URL`; satu BA berberkas sudah cukup.
- `test/read-bagian-jadwal.test.js` — BA berberkas = `selesai`, BA tanpa berkas tetap draft.
- `test/read-dashboard.test.js` — `progress.pelaksanaan = 'all'` tetapi `progress.selesai = 'none'` untuk BA tanpa berkas.
- `test/write-berita-acara-jadwal.test.js` — koreksi peserta via `peserta`/`pesertaIds`, penolakan peserta di luar kegiatan / belum berstatus final, pengembalian pengajuan peserta yang dibuang, unggah + ganti berkas (berkas lama ke trash), `deleteDraftBeritaAcaraBagian` (hapus draft, tolak BA berberkas, tolak tanpa sesi Bagian).

## 6. Kriteria Terima

- Fase 1: `baPendukungList[i].peserta` memuat `idPengajuan` + `statusPengajuan` dan `baPendukungList[i].kegiatanKey` terisi; panel read-only lama tidak berubah.
- Fase 2: kandidat form BA = peserta kegiatan ∪ peserta BA Pendukung tanpa duplikat dan deterministik; mematikan sumber tidak mengubah pilihan yang berasal dari kegiatan.
- Fase 3: Bagian dapat memilih peserta dari BA Pendukung lalu menyimpan BA Pelaksanaan; payload peserta berisi `idPengajuan` valid.
- Fase 4: BA tanpa berkas tidak pernah "Selesai" dan tetap dapat diperbaiki Bagian; endpoint admin tidak dilonggarkan.
- Seluruh suite lama tetap hijau.

## 7. Risiko & Catatan

- **Tanggal berbeda**: BA Pendukung memakai `Tanggal Pelaksanaan` sendiri; `baPendukungFor` memprioritaskan tanggal sama lalu jatuh ke yang terbaru, sehingga kegiatan dengan beberapa BA Pendukung bisa memilih yang tidak diharapkan bila tanggal kegiatan berubah. Mitigasi: `kegiatanKey` (Fase 1) tersedia untuk pencocokan lebih tegas di Fase 3.
- **Status berubah setelah masuk BA Pendukung**: kandidat dengan status di luar `BAGIAN_BA_STATUSES` disaring ke `ditolak` agar tidak memicu penolakan server (`validateBaPesertaStatus`).
- **Peserta "hantu"**: peserta BA Pendukung dengan `id_pengajuan` kosong (data lama) tetap tampil di panel informasi, tetapi tidak dapat dipilih sebagai kandidat karena kunci pilihannya kosong — konsisten dengan `validateBaPesertaKegiatan` yang menolak ID pengajuan kosong.
- **Jebakan lama**: `buildSesiSyncStmts` (`beritaAcara.js:352`) memakai fallback dosen/jam/tanggal BA untuk peserta yang belum ada di sesi mana pun, sehingga `pengajuan.tanggal_pelaksanaan` bisa berbeda dari `detail_kegiatan`; tidak disentuh di fase ini.
- **Regresi BA lama tanpa berkas (P1)**: BA yang sebelumnya dihitung "Selesai" kini kembali ke Draft bila belum berberkas, termasuk pada dashboard dan laporan (tahap `selesai` pada `computeUnitProgress`). Ini konsekuensi yang diterima; UAT-A07/UAT-B04 dicatat untuk retest dan CTA "Unggah Berkas" disediakan agar pemulihannya jelas.
- **Status peserta berubah setelah BA dibuat**: koreksi peserta divalidasi ulang, jadi peserta yang status akhirnya berubah (mis. menjadi Ditolak) akan ditolak saat koreksi. Untuk menghindari penolakan tak terduga pada penyimpanan biasa, `peserta` hanya dikirim bila pilihan Bagian benar-benar berubah (`lengkapiPesertaBerubah`).
- **Ganti berkas (C3-i)**: berkas lama dipindahkan ke trash setelah update DB sukses. Bila update DB gagal setelah unggah sukses, berkas baru menjadi orphan di Drive (sama seperti perilaku upload lama) dan tidak ada data BA yang menunjuk ke sana.
- **Hapus draft (C3-ii)**: `deleteDraftBeritaAcaraBagian` hanya untuk BA tanpa berkas; guard `requireBagianSession` + kepemilikan `existing.bagian` tetap dipakai, dan `updateBeritaAcaraBagian`/`deleteBeritaAcaraBagian` tetap admin-only.