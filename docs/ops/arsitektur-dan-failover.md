# Arsitektur dan Rencana Failover INHAL

Terakhir diperbarui: 2026-10-28

Dokumen ini menjelaskan komponen yang dipakai INHAL, ketergantungannya, dan apa
yang terjadi bila salah satu penyedia layanan mati. SOP operasional harian ada di
`docs/ops/backup-restore.md`.

## Prinsip

1. **Cloudflare tetap sumber kebenaran**, tetapi bukan satu-satunya tempat data.
2. Setiap komponen lintas penyedia harus punya salinan yang bisa dibaca tanpa
   komponen tersebut hidup.
3. Semua jalur cadangan bersifat **baca-saja** terhadap D1. Backup tidak pernah
   menulis ke tabel aplikasi.
4. Drive Bridge dibekukan: tidak ada perubahan pada `new-code1/*.gs` selama Fase 1.

## Peta komponen

```
                  +----------------------------+
   Pengguna ----> | Cloudflare Worker          |
                  | inhal-form (static + API)  |
                  +-------------+--------------+
                                |
                        +-------v--------+
                        | D1 inhal-poc   |  (8f412848-...)
                        +-------+--------+
                                |
     unggahan berkas / PDF      |
                                v
                  +----------------------------+
                  | Drive Bridge (Apps Script) |  GAS_DRIVE_URL
                  | 7 aksi, token Script Props |
                  +-------------+--------------+
                                |
                        +-------v---------------------+
                        | Google Drive DRIVE_FOLDER_ID |
                        | 1gFdANGMwa80gMpUNg1La91K...  |
                        +-----------------------------+

   GitHub Actions (di luar Cloudflare)
     - deploy staging / produksi
     - Backup D1 01:00 WIB --> dump SQL + snapshot + XLSX --> artefak 3 hari
                            \-> arsip terenkripsi --> Drive Bridge --> Drive
```

Folder Drive yang sama dipakai produksi **dan** staging. Karena itu staging tidak
boleh melakukan unggahan nyata: berkas uji akan tercampur dengan berkas produksi
dan tidak bisa dibedakan.

## Ketergantungan per komponen

| Komponen | Lokasi | Dipakai untuk | Bila mati |
|---|---|---|---|
| Worker `inhal-form` | Cloudflare | aplikasi & API | aplikasi tidak bisa diakses |
| D1 `inhal-poc` | Cloudflare | seluruh data | aplikasi berhenti menulis/membaca |
| Apps Script bridge | Google | simpan berkas, kirim email, PDF | unggahan & notifikasi gagal; data D1 aman |
| Google Drive | Google | berkas bukti & arsip backup | berkas lama tak bisa dibuka; data D1 aman |
| GitHub Actions | GitHub | deploy & backup | tidak ada backup baru; arsip lama tetap ada |

Tidak ada satu penyedia pun yang menyimpan **semua** bahan pemulihan: D1 ada di
Cloudflare, arsip harian ada di GitHub, dan salinan terenkripsi ada di Drive.

## Kontrak Drive Bridge (dibekukan)

`new-code1/3_drive_bridge.gs` menerima `POST` JSON dengan `token` + `action`.

| Aksi | Guna | Dipakai backup |
|---|---|---|
| `saveFile` | simpan base64 ke `DRIVE_FOLDER_ID`, kembalikan `url` + `fileId` | ya (arsip `.enc` dan manifest) |
| `trashFile` | `setTrashed(true)` berdasarkan `fileId` | ya (retensi 3 hari) |
| `getFile` | baca berkas berdasarkan `fileId` (base64 + mimeType) | tidak |
| `sendStatusEmail` | PDF ACC/Ditolak + email mahasiswa | tidak |
| `sendFinalEmail` | PDF ACC final + email mahasiswa & bagian | tidak |
| `sendFinalToBagian` | kirim ulang PDF final ke bagian | tidak |
| `sendReceiptEmail` | email tanda terima unggahan bukti | tidak |

Batasan yang harus diingat saat merancang otomatisasi:

- `saveFile` **selalu membuat berkas baru** (`folder.createFile`) — tidak menimpa
  berkas dengan nama sama.
- `saveFile` menandai berkas **Anyone with the link can view**. Apa pun yang
  dikirim lewat aksi ini harus dianggap publik.
- Tidak ada aksi untuk **mendaftar isi folder**; `getFile`/`trashFile` hanya
  bekerja dengan `fileId` yang sudah diketahui.
- Token hanya ada di Script Properties (`DRIVE_BRIDGE_TOKEN`), tidak di repo.

Konsekuensi: setiap otomatisasi baru di jalur Drive harus menyimpan `fileId`
sendiri (saat ini di indeks `drive-backup-index.json` dalam cache GitHub Actions).

## Skenario kegagalan

| Skenario | Dampak | Pemulihan | Sasaran waktu |
|---|---|---|---|
| Salah input / hapus data oleh admin | data berubah | Time Travel D1 (7 hari) | < 1 jam |
| Migrasi merusak skema | aplikasi error | Time Travel ke bookmark pra-migrasi | < 1 jam |
| D1 korup / hilang, akun Cloudflare ada | aplikasi mati | Time Travel bila < 7 hari; bila lewat: impor dump artefak/Drive ke D1 baru | 1-4 jam |
| Akun Cloudflare disuspend / tidak bisa diakses | aplikasi mati, Time Travel tidak tersedia | unduh artefak GitHub (3 hari) atau arsip Drive -> D1 baru -> impor -> deploy Worker | 4-24 jam |
| Google Drive / Apps Script mati | unggahan & email gagal, berkas lama tak terbuka | data D1 aman; backup harian tetap jalan; tunggu layanan pulih | mengikuti Google |
| GitHub Actions mati | tidak ada backup baru | arsip Drive lama tetap ada; jalankan `wrangler d1 export` manual | < 1 hari |
| Kuota D1 Free (500 MB) tercapai | penulisan ditolak | pangkas log, bersihkan `uploads.content`, atau ekspor -> D1 baru -> rebind | 2-4 jam |
| Token bridge bocor | pihak lain bisa mengunggah ke folder Drive | ganti `DRIVE_BRIDGE_TOKEN` di Script Properties dan GitHub, deploy versi bridge baru | < 1 jam |

RPO dengan jadwal saat ini: **≤ 24 jam** (backup 01:00 WIB). RTO realistis untuk
skenario Cloudflare total: **4-24 jam**, tergantung kecepatan membuat akun
pengganti dan mengimpor dump.

## Yang belum dibangun (sengaja ditunda)

1. **GAS cold reader** - pembaca darurat berbasis Apps Script yang menyajikan data
   dari arsip Drive bila Worker mati. Ditunda sampai arsip harian terbukti jalan
   minimal 3 hari berturut-turut dan drill lokal lulus. Syarat bila nanti
   dibangun: hanya membaca (tanpa tulis), terpisah dari bridge produksi, dan tidak
   menyimpan kredensial admin.
2. **Pembersihan `uploads.content`** - kolom base64 warisan skema lama. Penulis
   barunya (`saveUpload`) sudah tidak dipakai, tetapi baris lama masih dilayani
   `GET /api/files/:id`. Perlu pengukuran di produksi dulu sebelum dihapus.
3. **Pemantauan ukuran di luar backup** - saat ini ukuran hanya muncul di
   manifest dan ringkasan run harian, belum ada metrik Cloudflare.

## Larangan operasional

- Jangan mengunggah berkas ke `DRIVE_FOLDER_ID` dari staging.
- Jangan restore in-place ke `inhal-poc` dari dump; selalu ke database baru lalu
  rebind `database_id`.
- Jangan mengubah 7 aksi bridge tanpa memperbarui dokumen ini dan SOP backup.
- Jangan menaruh `BACKUP_PASSPHRASE` di repositori, issue, atau chat.