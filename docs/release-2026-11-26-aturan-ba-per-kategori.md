# Release 2026-11-26 - Aturan Multi-Sesi Berita Acara per Kategori

Status: **belum di-commit.** Fase A, B, C, D, dan E selesai.

## Ringkasan
- Berita Acara (BA) Pelaksanaan kini membedakan aturan per kategori kegiatan.
- Empat kategori (**SGD, Ujian, KKD, Praktikum**) dapat diatur. **KKD** dan **Praktikum**
  hadir dengan default `bebas` sehingga tidak mengubah perilaku sampai diubah admin.
- Setiap kategori memiliki empat dimensi aturan:
  - `multiJadwal` - boleh lebih dari satu jadwal pelaksanaan.
  - `multiSesi` - boleh menggabungkan beberapa sesi jadwal dalam satu BA.
  - `multiBa` - boleh lebih dari satu BA untuk kegiatan yang sama.
  - `perPeserta` - syarat status peserta yang boleh masuk BA.
- Setiap dimensi memilih salah satu mode: `bebas`, `longgar`, atau `ketat`.
- Default seluruh mode adalah `bebas` sehingga deploy tidak mengubah perilaku sampai
  admin mengaktifkannya lewat Master Data.

## Arti mode
| Mode | Perilaku |
|---|---|
| `bebas` | Tanpa batas; mengikuti filter status peserta yang dipilih (`BAGIAN_BA_STATUSES`). |
| `longgar` | Kasus aman diloloskan otomatis; penyimpangan wajib konfirmasi alasan (override) dan tercatat di audit. |
| `ketat` | Wajib satu / tidak boleh dipecah; pelanggaran ditolak. |

Rincian per dimensi:
- **multiJadwal** - `longgar`: tanggal sama dengan jadwal utama lolos otomatis, tanggal
  berbeda wajib alasan. `ketat`: hanya satu jadwal aktif per kegiatan.
- **multiSesi** - `longgar`: semua sesi bertanggal sama lolos otomatis, beda tanggal wajib
  alasan. `ketat`: BA tidak boleh memuat lebih dari satu sesi.
- **multiBa** - `longgar`: BA tambahan di tanggal berbeda lolos, tanggal sama wajib alasan.
  `ketat`: hanya satu BA aktif per kegiatan.
- **perPeserta** - `longgar`: peserta non-ACC otomatis dikeluarkan (deferred), tidak ada
  opsi paksa-ikut; BA tetap dibuat untuk peserta ACC. `ketat`: seluruh peserta BA wajib
  berstatus ACC. Status final yang diakui adalah **ACC**.

## Perubahan kode
- `src/read/common.js`
  - `BA_RULE_MODES`, `BA_RULE_KEYS`, `BA_RULE_CATEGORIES` (SGD, Ujian, KKD, Praktikum),
    `DEFAULT_BA_RULES` (semua `bebas`).
  - `normalizeBaRules`, `validateBaRules`, `baRulesConsistencyError` (menolak kombinasi
    buntu: multiJadwal tidak `ketat` sementara multiSesi dan multiBa sama-sama `ketat`).
  - `getBaRules`, `getBaRuleFor` (empat kategori memakai aturan tersimpan; kategori tak
    dikenal jatuh ke `bebas`).
  - `getBagianBaSettings` kini mengembalikan `{ statuses, finalOnly, rules }`.
- `src/write/master.js`
  - `saveBagianBaSettings` menerima `rules` opsional, memvalidasi mode dan konsistensi,
    lalu menyimpan config `BA_RULES` (JSON). `BAGIAN_BA_FINAL_ONLY` tetap ditulis untuk
    kompatibilitas pembaca lama.
- `src/write/baRules.js` (baru)
  - `ruleForKategori`, `kategoriFromBagian` (memetakan `KKD`, `Praktikum`, dan nama lab
    ke kategori; bagian non-kategori dianggap Praktikum), `overrideReason`,
    `applyPerPesertaRule`, `checkMultiJadwal`, `checkMultiSesi`, `checkMultiBa`,
    `loadPengajuanStatusMap`.
- `src/write/jadwal.js`
  - `saveJadwalPelaksanaan` dan `updateJadwalPelaksanaan` menegakkan `multiJadwal`
    (kecuali baris yang sedang diubah) dan mencatat audit `BA_RULE_OVERRIDE`.
- `src/write/beritaAcara.js`
  - `saveBeritaAcaraBagian`: `perPeserta` lalu `multiBa` lalu `multiSesi`.
  - `updateBeritaAcaraBagian`: `perPeserta` + `multiSesi`, kategori diturunkan dari
    `bagian` tersimpan (nama lab Praktikum dipetakan ke Praktikum).
  - `lengkapiBeritaAcaraBagian`: `perPeserta`.
  - Respons sukses membawa `deferred` (peserta yang dikeluarkan) dan `overrideApplied`.
- `public/dashboard.html`
  - Kartu "Pengaturan Bagian" memuat matriks **SGD/Ujian/KKD/Praktikum x (Multi Jadwal,
    Multi Sesi, Multi BA, Per Peserta)** dengan pilihan `Bebas/Longgar/Ketat`.
  - Panel **Pratinjau Peserta** (simulasi) menampilkan efek `perPeserta` per kategori dan
    ikut berubah saat mode diubah, sebelum disimpan.
  - Toggle global "Hanya kegiatan final" dihapus; pratinjau kelompok kegiatan mengikuti
    aturan `perPeserta` per kategori.
- `public/bagian-state.js` dan `public/bagian.html`
  - `groupRows` menerima `rules`; mode `longgar`/`ketat` hanya memasukkan peserta ACC,
    mode `bebas` mengikuti filter status. Pemetaan kategori mencakup KKD/Praktikum.
- `public/_headers` dan `src/security/csp.js`: CSP di-regenerasi (hash inline berubah).

## Override dan audit
- Permintaan override dikirim sebagai `payload.override = { multiJadwal? / multiSesi? /
  multiBa? / perPeserta?: "alasan" }`.
- Bila belum ada alasan, server mengembalikan
  `{ success: false, rule, allowOverride: true, message }` agar klien menampilkan
  konfirmasi.
- Bila alasan diisi, operasi dilanjutkan dan dicatat sebagai audit `BA_RULE_OVERRIDE`
  (rule, mode, alasan, kategori, kegiatan key, kanal, aktor).

## Data lama
- Tidak ada migrasi atau backfill. BA dan jadwal yang sudah ada dibiarkan apa adanya.
- Config `BA_RULES` tidak wajib ada; bila kosong, seluruh kategori memakai `bebas`.

## Verifikasi
- `npx vitest run test/write-ba-rules.test.js`: 16 test lulus (termasuk KKD/Praktikum).
- Frontend (`bagian-state`, template dashboard/bagian, regresi BA): lulus.
- `npm run test:scripts`: 85 lulus (1 dilewati).
- `npm run csp:check`: CSP sinkron.
- `npm run migrations:check`: 33 file migrasi valid.
- `npm test` (penuh): **1129/1129 lulus** (123 file).

## Catatan
- Matriks UI belum mencegah kombinasi buntu di sisi klien; server menolak saat disimpan
  dengan pesan validasi. Bila diinginkan, tambahkan penguncian opsi pada UI.
- `BAGIAN_BA_FINAL_ONLY` masih ditulis dan dibaca untuk kompatibilitas, tetapi tidak lagi
  dipakai UI.

## Status penyimpanan (26 Nov 2026, BELUM di-commit)
Semua perubahan Fase A-E tersimpan di working tree dan **belum** di-commit, di-push, atau
di-deploy. Tidak ada migrasi/backfill yang dijalankan ke D1.

- Repo: `Inhal-my/DASHBOARD-INHAL`, branch `main`, HEAD `04699a9`.
- D1 `inhal-poc` belum diubah.

File berubah (12, tracked):
- `new-code1-cf/src/read/common.js`
- `new-code1-cf/src/write/master.js`
- `new-code1-cf/src/write/jadwal.js`
- `new-code1-cf/src/write/beritaAcara.js`
- `new-code1-cf/public/dashboard.html`
- `new-code1-cf/public/bagian.html`
- `new-code1-cf/public/bagian-state.js`
- `new-code1-cf/public/_headers`
- `new-code1-cf/src/security/csp.js`
- `new-code1-cf/test/read-common.test.js`
- `new-code1-cf/test/write-master.test.js`
- `new-code1-cf/test/bagian-state.test.js`

File baru (untracked):
- `new-code1-cf/src/write/baRules.js`
- `new-code1-cf/test/write-ba-rules.test.js`
- `new-code1-cf/migrations/2026-11-19-ba-kolom-versi-baris.sql`
- `docs/release-2026-11-26-aturan-ba-per-kategori.md` (dokumen ini)
- `mockups-ba-rules/`, `mockups-dashboard/`, `mockups-parasitology-edit/`, `mockups-periksa-bayar/`
- `backups/`

## Temuan D1 (bahan keputusan, belum ada aksi)
- `config.BA_RULES` **tidak ada**; bila deploy, semua kategori memakai `bebas`.
- `config.BAGIAN_BA_STATUSES = 'ACC,Menunggu'`.
- `config.BAGIAN_BA_FINAL_ONLY = 'true'` (legacy, diabaikan kode baru).
- Status legacy `Disetujui` ada (KKD 4, Praktikum 3, SGD 12, Ujian 7); di luar statuses
  sehingga tetap dilewati seperti kode lama.
- Master Lab: Anatomi, Biokimia, Farmakologi, Fisiologi, Histologi, Literature Searching,
  Mikrobiologi, Parasitologi, Pat. Anatomi, Pat. Klinik, Research.

## Perubahan perilaku UI Bagian akibat `finalOnly` dihentikan
- Kode lama (HEAD) menyembunyikan kegiatan yang memiliki peserta `Menunggu` saat
  `BAGIAN_BA_FINAL_ONLY=true` (di `bagian-state` dan panel Bagian dashboard).
- Kode baru mengabaikan `finalOnly` dan memakai `bebas` (karena `BA_RULES` kosong) dengan
  status `ACC,Menunggu`, sehingga kegiatan tersebut tampil dan `Menunggu` ikut dihitung.
- Server sejak dulu mengizinkan `ACC,Menunggu` (`validateBaPesertaStatus`), jadi ini
  menyelaraskan UI dengan server, bukan mengubah data.
- Dampak terukur di D1: **4 kelompok kegiatan** (2 SGD, 2 KKD) memiliki peserta `Menunggu`
  yang tadinya tersembunyi.
- Opsi bila ingin nol perubahan sampai admin menyimpan aturan: tambahkan jembatan legacy
  (bila `BA_RULES` kosong dan `BAGIAN_BA_FINAL_ONLY=true`, UI tetap menyembunyikan grup
  ber-`Menunggu`). Belum diputuskan.

## Verifikasi terakhir
- `npm test` penuh: **1129/1129 lulus** (123 file).
- `npm run test:scripts`: 85 lulus (1 dilewati).
- `npm run csp:check`: sinkron.
- `npm run migrations:check`: 33 file valid.

## Langkah berikutnya (belum dijalankan)
1. Commit terpisah per fase (A, B, C, E) setelah ada arahan eksplisit.
2. Deploy worker `inhal-form` dan D1 bila diminta.
3. Putuskan opsi jembatan legacy `finalOnly` di atas.
