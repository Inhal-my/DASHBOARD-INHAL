# SOP Backup dan Restore D1 INHAL

Terakhir diperbarui: 2026-10-28

## Ringkasan

Cadangan INHAL dibuat oleh **GitHub Actions**, bukan oleh Worker dan bukan lewat
R2/Workflows Cloudflare. Tujuannya: bila akun Cloudflare bermasalah total
(suspend, lupa akses, gangguan regional), data tetap bisa dipulihkan.

Tiga lapis pemulihan, dari yang paling cepat:

| Lapis | Lokasi | Jendela retensi | Dipakai untuk |
|---|---|---|---|
| 1. Time Travel D1 | Cloudflare | 7 hari (Free) / 30 hari (Paid) | salah input, migrasi gagal, hapus data |
| 2. Artefak `Backup D1` | GitHub Actions | 3 hari | Cloudflare tidak bisa diakses |
| 3. Arsip Drive terenkripsi | Google Drive (via Drive Bridge) | 3 hari | Cloudflare dan GitHub bermasalah, atau arsip dibutuhkan staf di luar tim teknis |

Workflow: `.github/workflows/backup-d1.yml` (nama **Backup D1**), jadwal
`0 18 * * *` UTC = **01:00 WIB**, bisa dijalankan manual lewat `workflow_dispatch`.

## Status yang berlaku sekarang

- Paket D1: **Workers Free** — batas 500 MB per database, Time Travel 7 hari,
  5 GB penyimpanan akun, 100.000 baris ditulis per hari.
- **R2 dan Cloudflare Workflows tidak dipakai.** Binding `BACKUP_WORKFLOW`/`BACKUP_BUCKET`
  sudah dihapus dari `wrangler.toml` dan `wrangler.production.toml`; `src/backup/`
  hanya tersisa sebagai kode mati yang tidak di-import `src/index.js`. Jangan mengikuti
  instruksi lama yang menyebut bucket `inhal-poc-backups` atau workflow `d1-backup` —
  keduanya tidak pernah dibuat.
- Tidak ada cron di dalam Worker. Tidak ada pemangkasan otomatis data di D1.
- D1 **tidak mendukung `VACUUM`**; mengecilkan database berarti ekspor → database
  baru → impor → ganti binding (lihat bagian *Ambang ukuran*).

## Arsitektur dan skenario kegagalan

Peta komponen, 7 aksi Drive Bridge yang dibekukan, dan tabel skenario kegagalan
ada di `docs/ops/arsitektur-dan-failover.md`.

## Secret yang dipakai workflow

| Secret GitHub | Isi | Status |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | token dengan izin D1 read/export | sudah ada |
| `CLOUDFLARE_ACCOUNT_ID` | `e2efd255f61d2b81c7f54c92eb57b946` | sudah ada |
| `DRIVE_BRIDGE_URL` | nilai `GAS_DRIVE_URL` produksi | sudah ada |
| `DRIVE_BRIDGE_TOKEN` | nilai `GAS_DRIVE_TOKEN` produksi | sudah ada |
| `BACKUP_PASSPHRASE` | frasa sandi ≥ 12 karakter untuk enkripsi arsip Drive | sudah ada |

Selama `DRIVE_BRIDGE_URL` atau `BACKUP_PASSPHRASE` kosong, langkah cermin ke
Drive dilewati dan hanya lapis 1–2 yang aktif. Workflow tetap sukses.

Langkah cermin **tidak** memakai `continue-on-error`, jadi kegagalan Drive
membuat job merah dan issue otomatis dibuka. Ini disengaja: sebelumnya
`continue-on-error` menyembunyikan kegagalan 404 selama berhari-hari.

### Bentuk `DRIVE_BRIDGE_URL` yang diterima

`scripts/mirror-drive-backup.mjs` menormalkan URL sebelum memanggil bridge:

- spasi dan kutip pembungkus (`"`, `'`, `` ` ``) dibuang — nilai yang disalin
  dari UI sering ikut membawa kutip sehingga Google menjawab `404 Page Not Found`;
- bentuk domain Workspace `https://script.google.com/a/macros/<domain>/s/<id>/exec`
  ditulis ulang menjadi bentuk publik `https://script.google.com/macros/s/<id>/exec`.

Bentuk `/a/macros/<domain>/...` menjawab 404 bila dipanggil dari IP datacenter
(runner GitHub Actions), sedangkan bentuk publik menjawab 200 untuk deployment
yang sama. Karena itu secret sebaiknya diisi bentuk publik.

`BACKUP_PASSPHRASE` **wajib disimpan juga di luar GitHub** (pengelola sandi
lembaga). Tanpa frasa itu arsip Drive tidak bisa dibuka — tidak ada mekanisme
pemulihan sandi.

## Kenapa arsip Drive dienkripsi

Aksi `saveFile` di Drive Bridge (`new-code1/3_drive_bridge.gs`) selalu membuat
berkas baru di `DRIVE_FOLDER_ID` dan menandainya
**Anyone with the link can view**. Dump database memuat data pribadi mahasiswa
dan hash kata sandi admin, jadi tidak boleh dikirim apa adanya. Karena itu:

- dump SQL, snapshot JSON, dan XLSX dikirim dalam bentuk terenkripsi
  (AES-256-GCM, format `INHALBK1`);
- hanya `manifest.json` (jumlah baris, hash, ukuran — tanpa data pribadi) yang
  dikirim terbuka;
- Drive Bridge **tidak diubah**; hanya aksi `saveFile` dan `trashFile` yang dipakai.

Alat bantu:

```bash
# Enkripsi/dekripsi dipakai oleh skrip backup (bukan perintah manual)
node scripts/mirror-drive-backup.mjs --help   # lihat pemakaian lengkap

# Membuka arsip hasil unduhan Drive
node scripts/decrypt-backup.mjs inhal-20261028-database.sql.enc \
  --out=inhal-20261028.sql --passphrase="<BACKUP_PASSPHRASE>"
```

## Alur harian

1. `wrangler d1 export inhal-poc --remote` → `inhal-poc.sql` (baca-saja).
2. `scripts/verify-backup.mjs` memeriksa integritas, tabel inti, duplikat master,
   referensi blok asing, dan `kegiatan_key`. Gagal di sini = backup dianggap gagal.
3. `scripts/backup-snapshot.mjs` membuat `snapshot.json.gz`, `database.xlsx`,
   dan `manifest.json` (SHA-256, jumlah baris per tabel, ukuran, status ambang).
4. Semua berkas diunggah sebagai artefak `d1-backup-<label>` dengan retensi 3 hari.
5. Bila secret Drive tersedia: berkas dienkripsi lalu dicerminkan ke Drive
   (`inhal-<label>-database.sql.enc`, `-snapshot.json.gz.enc`, `-database.xlsx.enc`,
   serta `-manifest.json` terbuka), arsip lebih tua dari 3 hari dipindah ke trash.
6. `scripts/backup-report.mjs` menulis ringkasan ke halaman run dan **gagal**
   bila perkiraan ukuran data mencapai batas paket.
7. Bila ada langkah yang gagal, issue berlabel `backup-failed` dibuka otomatis;
   issue ditutup otomatis pada run berikutnya yang sukses.

Kolom besar (mis. `uploads.content` berisi base64) otomatis dikecualikan dari
snapshot dan XLSX agar berkas tetap wajar, tetapi **tetap utuh di dump SQL**.
Daftar kolom yang dikecualikan tercatat di `manifest.json`.

## Membaca hasil run

1. Buka Actions → **Backup D1** → run terbaru.
2. Halaman run memuat tabel jumlah baris, ukuran, integritas, dan status ambang.
3. Unduh artefak `d1-backup-<label>`; di dalamnya:
   - `inhal-poc.sql` — dump lengkap (sumber restore utama)
   - `out/<label>-snapshot.json.gz` — seluruh tabel dalam JSON
   - `out/<label>-database.xlsx` — rekap untuk dibuka tanpa aplikasi
   - `out/manifest.json` — hash dan metrik
   - `out/verify.json` — hasil verifikasi bisnis
   - `deployments.json`, `time-travel.json` — konteks rilis (bila perintahnya tersedia)

## Ambang ukuran (Fase 1.5)

| Status | Ambang (Free) | Perilaku |
|---|---|---|
| `ok` | < 300 MB | normal |
| `warn` | ≥ 300 MB | anotasi peringatan di run, backup tetap lanjut |
| `over` | ≥ 500 MB | langkah ringkasan keluar kode 1, issue otomatis dibuka |

Nilai `status` ditulis `scripts/backup-snapshot.mjs` ke `manifest.json`; keputusan
gagal diambil `scripts/backup-report.mjs`.

Bila mendekati batas, periksa `manifest.json` → `size.byTable`:

1. Tabel log (`audit_log`, `log_upload`, `log_data`) boleh dipangkas manual
   setelah backup sukses diverifikasi.
2. `uploads.content` adalah sisa skema lama (`src/uploads.js`). Penulis barunya
   sudah tidak dipakai — semua unggahan baru lewat Drive — tetapi baris lama
   masih bisa dilayani `GET /api/files/:id` dan memakan kuota. Setelah dipastikan
   tidak ada lagi baris yang dibutuhkan, kosongkan kolomnya (`UPDATE uploads SET content = NULL`).
3. D1 tidak punya `VACUUM`. Untuk benar-benar mengecilkan: ekspor → buat database
   baru → impor → verifikasi → ganti `database_id` di `wrangler.production.toml`
   → deploy → simpan database lama sampai validasi selesai.

## Retensi dan pemangkasan

- Artefak GitHub: `retention-days: 3`.
- Arsip Drive: 3 hari, dipangkas oleh `scripts/mirror-drive-backup.mjs`.
- Drive Bridge tidak punya aksi listing folder, sehingga retensi memakai indeks
  (`drive-backup-index.json`) yang menyimpan `fileId` tiap arsip. Indeks disimpan
  sebagai cache GitHub Actions (`restore-keys: drive-backup-index-`) karena
  workflow tidak menulis ke repositori.
- Bila cache indeks hilang, arsip lama tidak terpangkas otomatis. Tindakan:
  buka Drive, urutkan menurut tanggal, pindahkan arsip lebih dari 3 hari ke trash
  secara manual; indeks akan terbentuk ulang pada run berikutnya.

## Prosedur restore

### A. Time Travel (insiden masih dalam 7 hari)

```bash
# Bookmark sekarang
npx wrangler d1 time-travel info inhal-poc

# Bookmark pada waktu tertentu
npx wrangler d1 time-travel info inhal-poc --timestamp="2026-10-28T01:00:00Z"

# Kembalikan database ke bookmark pilihan
npx wrangler d1 time-travel restore inhal-poc --bookmark=<bookmark>
```

Simpan bookmark undo yang dicetak setelah restore. Lalu periksa `/api/health`,
login admin, jumlah pengajuan, dan master kegiatan.

### B. Restore dari artefak GitHub (Cloudflare tidak bisa diakses)

Restore **tidak** dilakukan in-place ke `inhal-poc`; selalu ke database baru agar
data yang lebih baru tidak hilang.

```bash
# 1. Unduh artefak terbaru (butuh GitHub CLI, login sebagai pemilik repo)
gh run list --workflow=backup-d1.yml --limit 5
gh run download <run-id> -n d1-backup-<label> -D ./restore
cd restore && gunzip -c out/<label>-snapshot.json.gz | head -c 0   # cek berkas utuh

# 2. Verifikasi dump sebelum menyentuh database apa pun
cd new-code1-cf
node scripts/verify-backup.mjs ../restore/inhal-poc.sql

# 3. Buat database tujuan (akun Cloudflare baru/pulih) lalu impor
npx wrangler d1 create inhal-poc-restore
npx wrangler d1 execute inhal-poc-restore --remote --file=../restore/inhal-poc.sql

# 4. Ekspor ulang dari database tujuan dan verifikasi lagi
npx wrangler d1 export inhal-poc-restore --remote --output=../restore/restored.sql
node scripts/verify-backup.mjs ../restore/restored.sql

# 5. Bandingkan jumlah tabel inti dengan manifest
node -e "console.log(JSON.parse(require('fs').readFileSync('../restore/out/manifest.json','utf8')).counts)"
```

Langkah terakhir: ganti `database_id` pada `wrangler.production.toml`, deploy, lalu
jalankan smoke test (`/api/health`, `/api/registration-options`, `/portal`).
Simpan database lama minimal 7 hari sampai validasi selesai.

### C. Restore dari arsip Drive terenkripsi

Dipakai bila GitHub juga tidak dapat diakses, atau bila yang dibutuhkan adalah
salinan yang disimpan staf di Drive.

1. Unduh `inhal-<label>-database.sql.enc` (dan `-manifest.json` untuk pembanding).
2. Dekripsi:

```bash
cd new-code1-cf
node scripts/decrypt-backup.mjs inhal-<label>-database.sql.enc \
  --out=inhal-restore.sql --passphrase="<BACKUP_PASSPHRASE>"
```

3. Lanjutkan dari langkah 2 pada prosedur B.

Jika dekripsi gagal dengan pesan autentikasi, berarti frasa sandi salah atau
berkas rusak — AES-GCM tidak dapat dipaksa dibuka.

### D. Uji restore lokal (latihan, tanpa menyentuh staging/produksi)

```bash
cd new-code1-cf

# Ekspor database lokal (atau gunakan dump hasil unduhan)
npx wrangler d1 export inhal-poc --local \
  --config wrangler.production.toml --output="$TMPDIR/drill.sql"

node scripts/verify-backup.mjs "$TMPDIR/drill.sql"
node scripts/backup-snapshot.mjs "$TMPDIR/drill.sql" --out="$TMPDIR/out" --label=DRILL

# Impor ke database lokal scratch (state lokal wrangler, bukan remote)
npx wrangler d1 execute inhal-poc-restore-drill --local \
  --config wrangler.production.toml --file="$TMPDIR/drill.sql"
```

Latihan wajib memakai `--local`. Jangan menjalankan drill terhadap staging atau
produksi; keduanya memakai folder Drive yang sama dan bisa mengganggu data nyata.

## Eskalasi

- Backup gagal 1 hari: jalankan **Backup D1** manual (`workflow_dispatch`),
  periksa langkah yang merah. Issue `backup-failed` menyertakan tautan run.
- Backup gagal 2 hari berturut-turut: jangan menunggu; buat dump manual dengan
  `wrangler d1 export inhal-poc --remote --output=...` dari mesin yang punya
  akses, simpan di luar repo, lalu cari penyebab (token, kuota, ukuran).
- Data rusak: hentikan penulisan (maintenance), tentukan waktu kejadian, pilih
  lapis pemulihan tercepat yang masih dalam jendela retensi.
- Token atau frasa sandi bocor: cabut `CLOUDFLARE_API_TOKEN`, ganti
  `DRIVE_BRIDGE_TOKEN` di Script Properties Apps Script dan di GitHub, ganti
  `BACKUP_PASSPHRASE` (arsip lama tetap butuh sandi lama untuk dibuka).

## Uji otomatis

Skrip backup punya unit test yang ikut berjalan di CI (`npm run test:scripts`):

```bash
cd new-code1-cf
npm run test:scripts
```

Cakupan `scripts/__tests__/backup-github-actions.node.mjs`:

- enkripsi/dekripsi AES-256-GCM bolak-balik, salt+IV unik, penolakan frasa sandi
  salah, header salah, dan frasa sandi < 12 karakter;
- pemilihan arsip kedaluwarsa (termasuk entri tanpa `uploadedAt` valid) dan
  retensi indeks saat `trashFile` gagal;
- status ambang ukuran (`ok`/`warn`/`over`) dan format label `YYYYMMDD-HHmm` UTC;
- isi ringkasan run (ukuran, hash, integritas, kolom dikecualikan, tabel baris).

Uji end-to-end lokal tanpa Cloudflare:

```bash
# 1. D1 lokal + data uji, lalu ekspor
npx wrangler d1 execute inhal-poc --local --file=./schema.sql
npx wrangler d1 export inhal-poc --local \
  --config wrangler.production.toml --output=/tmp/drill.sql

# 2. Verifikasi + artefak + ringkasan
node scripts/verify-backup.mjs /tmp/drill.sql
node scripts/backup-snapshot.mjs /tmp/drill.sql --out=/tmp/out --label=DRILL --plan=free
node scripts/backup-report.mjs /tmp/out
```

## Checklist verifikasi Fase 1

- [x] Secret `DRIVE_BRIDGE_URL`, `DRIVE_BRIDGE_TOKEN`, `BACKUP_PASSPHRASE` terpasang.
- [x] Run manual **Backup D1** sukses dan artefak bisa diunduh.
- [x] Arsip muncul di folder Drive (`DRIVE_FOLDER_ID`) dan berupa `.enc`.
- [ ] `node scripts/decrypt-backup.mjs` berhasil membuka arsip yang diunduh.
- [x] `manifest.json` menampilkan `size.status` dan `uploads.contentBytes` sesuai kenyataan.
- [ ] Run kedua memangkas arsip lebih dari 3 hari (cek jumlah berkas di Drive).
- [ ] Drill lokal prosedur D selesai dan jumlah tabel inti cocok dengan manifest.
- [ ] **TODO sebelum 2026-11-04**: artefak `restore-drill-evidence` (drill staging
  2026-10-21) kedaluwarsa pada tanggal itu. Jalankan drill ulang lewat
  **Restore Drill Staging** atau prosedur D, lalu catat hasilnya di bagian
  *Catatan uji* agar bukti tidak ikut kedaluwarsa.
- [x] **TODO**: ukur `SELECT COUNT(*), SUM(LENGTH(content)) FROM uploads` di produksi
  dan catat di log — angka ini menentukan apakah pembersihan kolom lama diperlukan.
  Hasil run 2026-10-29: `uploads` **0 baris**, `content` **0.00 MB** → tidak ada
  data berkas lama yang perlu dibersihkan.

## Catatan uji

### 2026-10-17

- Backup pra-Poin 1: `inhal-poc-20261017-pre-poin1.sql`, integritas `ok`, ditemukan 2 duplikat master.
- Backup pasca-Poin 1: `inhal-poc-20261017-post-poin1.sql`, integritas `ok`, duplikat 0, referensi blok asing 0, `kegiatan_key` drift 0.
- Uji restore dari arsip R2 tidak pernah dilakukan (jalur R2 batal); penggantinya
  drill lokal pada 2026-10-28.

### 2026-10-21 (lokal)

- Dump: `/tmp/opencode/backups/inhal-local-20261021.sql`, integritas `ok`.
- Jumlah: mahasiswa 6, pengajuan 6, master_kegiatan 13, berita_acara 2,
  berita_acara_admin 1.
- Restore ke database scratch lokal berhasil (131 perintah). Ekspor ulang scratch
  juga `ok`, tanpa duplikat/orphan/drift.
- Latihan ini tidak menggantikan drill restore GitHub Actions pada 2026-10-28;
  keduanya sama-sama memakai D1 lokal, bukan arsip produksi.

### 2026-10-21 (staging restore drill)

- Workflow: **Restore Drill Staging**, run `39554233150`, hasil `success`.
- Sumber: D1 staging diekspor baca-saja, lalu diverifikasi `ok`.
- Restore: dump diimpor ke database scratch lokal di runner, diekspor ulang,
  diverifikasi `ok`, dan jumlah tabel inti sama.
- Jumlah tabel inti: mahasiswa 3, pengajuan 0, master_kegiatan 11, berita_acara 0,
  berita_acara_admin 0.
- Aplikasi: Worker lokal membaca database hasil restore; `/api/health`, opsi
  pendaftaran, portal mahasiswa, dan `/portal` lulus.
- Bukti: artifact `restore-drill-evidence` (kedaluwarsa 2026-11-04).
- Catatan: drill memakai salinan lokal, bukan mengarahkan staging ke database baru.
  Staging dan produksi tidak diubah.

### 2026-10-21 (produksi)

- Deploy produksi Poin 6: run `39551735466`, versi Worker
  `40c4f4a2-12c0-49ab-8ebf-dea26bd596b2`.
- Time Travel bookmark sebelum migrasi:
  `000001f8-0000000e-0000510b-9ea1ed190410e6b647b71d99001a0cf4`.
- Migrasi `2026-10-21-poin6-backfill-mahasiswa-blok.sql` dan
  `2026-10-21-poin6-indexes.sql` berstatus diterapkan; health produksi 200.
- Tidak ada dump ekspor produksi pada rilis ini karena R2 belum aktif dan token
  Cloudflare lokal tidak tersedia. Gunakan Time Travel atau backup R2 setelah aktif.

### 2026-10-26 (produksi)

- Deploy produksi perbaikan status pembayaran: versi Worker
  `c7ddf806-fea0-45a0-a89a-beb6236ad583`, health produksi 200.
- Ekspor pra-migrasi `wrangler d1 export`: 450 KB, disimpan di luar repo
  (`D:\tmp\backup-pre-pembayaran-2026-10-26.sql`).
- Time Travel bookmark sebelum migrasi (dari URL ekspor):
  `00000232-00000000-00005110-0b794c0855aedc2f9d22967601df076e`.
  Bookmark setelah migrasi:
  `00000232-00000002-00005110-a5ba1b2cd7db89c9375bff0286391c7d`.
- Migrasi `2026-10-26-pembayaran-backfill-menunggu.sql` berstatus diterapkan.
  Hasil: `menunggu` 25 baris, `valid` 1 baris, dan 0 baris ber-bukti yang
  masih `belum`.

### 2026-10-27 (produksi)

- Deploy produksi BA Pelaksanaan multi-sesi (commit `83d6bcb`): versi Worker
  `00575170-c5a3-4969-9846-3823a3647614`, health produksi 200.
- Time Travel bookmark sebelum migrasi:
  `0000023b-00000000-00005110-26708c9d03b7d08b6863d713153a9458`.
  Bookmark setelah migrasi dan deploy:
  `0000023e-00000066-00005111-066406c7568943df2d523fd19b713c25`.
- Migrasi `2026-10-27-ba-pelaksanaan-sesi.sql` berstatus diterapkan.
  Hasil: tabel `berita_acara_sesi` dibuat, backfill 2 baris dari 8 baris
  `berita_acara` (2 baris ber-`jadwal_id`), tanpa duplikat `jadwal_id`.
- Tidak ada dump ekspor produksi pada rilis ini (R2 belum aktif). Untuk
  pemulihan, gunakan bookmark Time Travel di atas.
- Smoke test: `/api/health` `{"ok":true,"db":"ok"}`, `/bagian` memuat
  `baSesiSummary`/`jumlahSesi`, `/bagian-state.js` memuat `applySessionToggle`.
- Uji fungsional BA 2 sesi (buat BA, badge "N sesi", Jumlah Sesi di dashboard,
  panel Sesi Pelaksanaan, kunci batal sesi non-pertama) belum dijalankan karena
  butuh sesi admin; jalankan saat verifikasi manual berikutnya.

### 2026-10-27 (staging)

- Staging tertinggal 2 migrasi sebelum rilis ini; diterapkan manual dengan
  `wrangler d1 migrations apply inhal-poc-staging --remote --config wrangler.staging.toml`:
  `2026-10-26-pembayaran-backfill-menunggu.sql` dan
  `2026-10-27-ba-pelaksanaan-sesi.sql` (keduanya ✅).
- Ekspor pra-migrasi `wrangler d1 export`: 26.9 KB, disimpan di luar repo
  (`D:\tmp\backup-pre-ba-sesi-staging-2026-10-27.sql`). Bookmark dari URL ekspor:
  `0000002b-00000000-00005111-c40937d801e9297b52b511bf6aac8b34`.
- Deploy staging: versi Worker `6755baaa-2d19-446e-aa1b-763ab6c28a41`,
  health staging 200, `/bagian` memuat `baSesiSummary`/`jumlahSesi`.
- `berita_acara_sesi` di staging dibuat dan masih kosong (0 BA), siap untuk UAT.

### 2026-10-28 (produksi)

- Deploy produksi tabel "Kelengkapan per Blok" 8 kolom (commit `dbead4f`,
  docs `375be58`): versi Worker `2bfd9c39-cde8-4801-8053-b04ba73add80`,
  health produksi 200 (`{"ok":true,"db":"ok"}`).
- Deploy manual dengan `wrangler deploy --config wrangler.production.toml`
  karena workflow **Deploy Production** run #17 gagal di langkah
  "Show pending migrations" (`wrangler d1 migrations list`), bukan di langkah
  deploy. Secret `CLOUDFLARE_API_TOKEN` di GitHub Actions perlu diganti.
- Tidak ada migrasi pada rilis ini. `wrangler d1 migrations list inhal-poc
  --remote` → "No migrations to apply!"; `d1_migrations` berisi 26 baris dan
  tabel `berita_acara_sesi` sudah ada, jadi `apply_migrations` tidak diperlukan.
- Time Travel bookmark sebelum deploy:
  `00000263-00000000-00005112-35298b0450e8700b52082024a875e3ce`. Tidak ada
  dump ekspor pada rilis ini (R2 belum aktif).
- Perubahan yang terpasang: 1 aset statis (`/dashboard.html`, 452.546 byte),
  hash CSP inline script baru `sha256-61aLl/1As0lsVwbwEkWbZTxrbD8eVWLPsrdCGo9ErCg=`.
- Smoke test: `/api/health` 200, `/dashboard` 200, `/portal` 200, `/` 302.
  `SHA-256 dashboard.html` produksi identik dengan berkas lokal
  (`2BF6E9A60B8ED503…`) dan halaman memuat `ba-pager-desk`,
  `bagianPageInfo`, `bagianPagedRows`, serta `tanggalSesiInfo`.
- Catatan: produksi sebelumnya tertinggal 15 komit (termasuk BA multi-sesi dan
  perubahan pembayaran) sehingga rilis ini sekaligus membawa perubahan tersebut.
- Verifikasi visual 1440/1280/390 px pada tab Berita Acara belum dijalankan.

### 2026-10-28 (backup Fase 1: GitHub Actions + Drive terenkripsi)

- Jalur backup R2/Workflows dibatalkan karena R2 belum aktif. Pengganti:
  `.github/workflows/backup-d1.yml` dengan jadwal `0 18 * * *` (01:00 WIB).
- Skrip baru: `scripts/backup-snapshot.mjs` (snapshot JSON + XLSX + manifest),
  `scripts/backup-report.mjs` (ringkasan run + ambang ukuran),
  `scripts/mirror-drive-backup.mjs` (cermin ke Drive + retensi),
  `scripts/backup-crypto.mjs` (AES-256-GCM) dan `scripts/decrypt-backup.mjs`.
- Retensi 3 hari pada artefak GitHub dan arsip Drive. Arsip Drive dienkripsi
  karena aksi `saveFile` bridge menandai berkas "Anyone with the link can view".
- Uji lokal: D1 lokal (`schema.sql` + data uji) → dump 41 KB → `verify-backup`
  `{"ok":true}` → snapshot 1,7 KB dan XLSX 65 KB (31 entri zip, terbaca) →
  manifest mencatat `uploads.content` 30.000 byte sebagai kolom dikecualikan.
- Uji retensi memakai bridge tiruan: 6 `fileId` arsip berumur 5 hari dipindahkan
  ke trash, indeks menyisakan satu label aktif. Dekripsi dengan frasa sandi salah
  ditolak (AES-GCM), frasa sandi benar berhasil bolak-balik.
- Unit test skrip: `scripts/__tests__/backup-github-actions.node.mjs` (10 test) untuk
  kripto, retensi, ambang ukuran, label, dan ringkasan; ikut `npm run test:scripts`
  yang sudah dipanggil CI.
- Belum dijalankan terhadap produksi: menunggu secret `DRIVE_BRIDGE_URL`,
  `DRIVE_BRIDGE_TOKEN`, dan `BACKUP_PASSPHRASE`. Setelah terpasang, jalankan
  `workflow_dispatch` satu kali lalu centang checklist Fase 1 di atas.

### 2026-10-29 (backup Fase 1: workflow akhirnya berjalan + cermin Drive hidup)

- **Workflow tidak pernah berjalan.** `BACKUP_DIR: ${{ runner.temp }}/backup`
  diletakkan di `env` tingkat job. Konteks `runner` hanya sah di dalam step,
  sehingga GitHub menolak mem-parse workflow dan menampilkannya sebagai path
  berkas mentah, bukan "Backup D1". Run tidak pernah tercipta. Diperbaiki dengan
  memindahkan `BACKUP_DIR` ke `env` step *Siapkan direktori dan label*
  (komit `181f590`). Setelah itu workflow muncul di API Actions dan 15 step hijau.
- **Cermin Drive selalu gagal 404, tersembunyi oleh `continue-on-error`.**
  Tiga percobaan diagnostik dari runner menunjukkan penyebab sebenarnya:
  - `GET /exec` polos pun 404 → bukan soal method, body, ukuran, atau redirect;
  - bentuk `/a/macros/umsu.ac.id/s/<id>/exec` → 404 "Page Not Found";
  - bentuk publik `/macros/s/<id>/exec` → 200, termasuk POST 740 KB;
  - panjang `DRIVE_BRIDGE_URL` = 126 karakter, padahal URL bersih 125 →
    nilai secret menyimpan **kutip ganda nyasar di akhir** (`.../exec"`).
  - Perbaikan: `scripts/mirror-drive-backup.mjs` membuang spasi/kutip pembungkus
    (`cleanSecretValue`) dan menormalkan URL domain Workspace ke bentuk publik
    (`normalizeBridgeUrl`). Token juga dibersihkan dengan cara yang sama.
- `continue-on-error` pada langkah cermin dihapus agar kegagalan Drive membuat
  job merah dan issue otomatis dibuka, bukan lolos diam-diam.
- Uji regresi ditambah di `scripts/__tests__/backup-github-actions.node.mjs`
  (31 test total): normalisasi URL, kutip nyasar pada URL/token, dan pemeriksaan
  bahwa `env` tingkat job workflow tidak memakai konteks `runner`/`steps`.
  Uji terakhir sudah diverifikasi gagal bila bug lama dikembalikan.
- Hasil run `main` #40841596372 (label `20261029-0822`): `{"ok": true}`, empat
  arsip terunggah ke Drive — dump `569.638` B, snapshot `64.629` B, XLSX
  `1.569.724` B, manifest `2.773` B — masing-masing dengan `fileId` nyata.
  Ringkasan: dump 0.54 MB, sha256 `9AC25BBE1BAA3A60…`, integritas `ok`,
  2.852 baris, verifikasi bisnis LULUS, ukuran 0.17 MB dari batas 500 MB.
- Catatan: `uploads` 0 baris dan `content` 0.00 MB, jadi TODO pengukuran
  `uploads` terjawab — tidak ada pembersihan kolom lama yang diperlukan.
- Belum diverifikasi: `decrypt-backup.mjs` terhadap arsip Drive yang diunduh,
  dan pemangkasan retensi 3 hari pada run kedua (perlu menunggu arsip menua).

### 2026-10-29 (produksi: paginasi detail laporan)

- Deploy produksi paginasi per tabel di `/detail-laporan.html` (commit
  `e1bb7a6`): versi Worker `6161ee41-5bd7-4a7b-97cc-82fb547bdf3c`, health
  produksi 200 (`{"ok":true,"db":"ok","latencyMs":51}`).
- Deploy lewat workflow **Deploy Production** (`workflow_dispatch`, run
  `40820292719`) dan seluruh langkah sukses: Tests, Release tooling tests,
  CSP sync, Show pending migrations, Deploy production, Smoke check.
- `apply_migrations` = `false`; `wrangler d1 migrations list inhal-poc --remote`
  → "No migrations to apply!". Langkah "Record Time Travel bookmark" dilewati
  karena tidak ada migrasi, jadi tidak ada bookmark baru pada rilis ini.
- Perubahan yang terpasang: paginasi 11 tabel + kartu mobile di
  `detail-laporan.html` (state `pagers`, komponen `PagerBar`, `bagianPagedSections`
  agar Subtotal tetap utuh), reset halaman saat filter berubah, dan ekspor
  tetap memakai data penuh.
- Aset: `/detail-laporan.html` 433.691 byte, `SHA-256` produksi identik dengan
  berkas lokal (`6A50A099C150D831…`) dan memuat `pager-bar`. 5 hash inline
  script pada header CSP produksi identik dengan `public/_headers`.
- Smoke test: `/api/health` 200, `/detail-laporan.html` 307 → `/detail-laporan`
  200, `/dashboard` 200, `/bagian` 200, `/portal` 200, `/` 302.
- Catatan proses: CI sempat gagal di `test/backup-config.test.js` karena masih
  menuntut binding `[[workflows]]`/`[[r2_buckets]]` yang sudah dihapus; uji
  disesuaikan pada commit `e1bb7a6`. Deploy dipicu via GitHub API
  `workflow_dispatch` karena `.cf_token` lokal ditolak Cloudflare
  (`Invalid access token [code: 9109]`) dan `CLOUDFLARE_API_TOKEN` tidak ada di
  mesin lokal; secret Actions tetap valid.
- Verifikasi visual responsif 1440/1280/390 px untuk pager belum dijalankan.
