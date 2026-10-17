# Desain: Panel Bagian v2 — Split Workspace + Mobile Ringkas

Tanggal: 2026-10-17
Status: disetujui (menunggu review spec)

## Tujuan

Merombak `new-code1-cf/public/bagian.html` agar alur kerja bagian lebih jelas dan tidak duplikatif:

- **Desktop (>=940px)** memakai **Konsep 02 (Split Workspace)**: daftar kegiatan di kiri, detail + aksi di kanan.
- **Ponsel (<940px)** memakai **Konsep 04 (Mobile Ringkas)**: daftar penuh, halaman detail penuh, bottom nav, dan FAB.
- Navigasi disederhanakan menjadi **4 menu**: Ringkasan, Jadwal, Berita Acara, Riwayat.
- Setiap kegiatan memiliki satu status yang konsisten: `ACC -> Terjadwal -> Draft BA -> Selesai`.
- **BA Pelaksanaan yang sudah lengkap otomatis pindah ke Riwayat** dan hilang dari antrean Berita Acara.
- **BA draft tetap di Berita Acara** sampai dosen/tanggal/jam lengkap.
- Peserta tidak lagi menjadi menu; peserta menjadi bagian dari detail kegiatan.

Referensi visual: `mockups/bagian-v2/02-split-workspace.html` dan `mockups/bagian-v2/04-mobile-compact.html`.

## Non-Goals

- Tidak mengubah backend, RPC, skema, atau migrasi. Bootstrap yang ada sudah memuat `rows`, `baList` (termasuk `selesai`), dan `jadwalList`.
- Tidak mengubah autentikasi/login, alur scan PDF, atau halaman lain (`dashboard.html`, `laporan.html`, portal).
- Tidak mengubah format payload RPC yang sudah dipakai: `saveJadwalPelaksanaan`, `updateJadwalPelaksanaan`, `cancelJadwalPelaksanaan`, `submitBeritaAcaraBagian`, `uploadBaFile`, `lengkapiBeritaAcaraBagian`.
- Tidak menambah fitur baru di luar penataan ulang tampilan, navigasi, dan status.
- Tidak mengubah isi `baConfig` (statuses/finalOnly).

## Constraints

- Produksi berjalan; perubahan terbatas pada `new-code1-cf/public/bagian.html`, helper murni baru `new-code1-cf/public/bagian-state.js`, dan test.
- Pertahankan semua fitur yang ada: buat/edit/batalkan jadwal, pilih peserta, buat BA manual/dari jadwal, unggah file, scan PDF, lengkapi draft, filter Blok, pencarian, muat ulang, polling 30 detik, cache lokal, logout.
- Copy UI konsisten: "Pendukung"/"Pelaksanaan", "Buat BA", "Lengkapi", "Blok", "Lengkap"/"Belum".
- Semua test dijalankan dari `new-code1-cf/` dengan `npx vitest run <file>`.
- Bahasa desain dipertahankan: Plus Jakarta Sans, indigo `#4f46e5`, slate, emerald/amber/rose, kartu `rounded-2xl`, `shadow-soft`.
- Tanpa `window.confirm` baru selain guard buang perubahan dan pembatalan jadwal yang sudah ada.

---

## A. Informasi & Navigasi

```
Ringkasan | Jadwal | Berita Acara | Riwayat
```

- **Ringkasan** — kondisi keseluruhan + hal yang perlu ditindaklanjuti.
- **Jadwal** — kegiatan ACC yang belum/sudah dijadwalkan.
- **Berita Acara** — antrean kerja: kegiatan tanpa BA + BA draft.
- **Riwayat** — arsip BA lengkap.
- `activeTab` default berubah dari `'jadwal'` menjadi `'ringkasan'`.
- Tab lama "Peserta" (jika masih tersisa) dihapus; daftar peserta ada di detail kegiatan.
- Pencarian global di top bar hanya tampil pada tab Jadwal, Berita Acara, dan Riwayat; memfilter daftar aktif.

### Desktop (>=940px)

- Header lengket: brand/nama bagian, 4 tab, kotak pencarian, tombol muat ulang, menu pengguna/keluar.
- Konten `max-w-7xl`.
- Ringkasan dan Riwayat memakai lebar penuh.
- Jadwal dan Berita Acara memakai grid dua kolom: daftar `380px` + detail `1fr` dengan `gap` 20-24px. Panel detail `position: sticky; top: 88px; max-height: calc(100vh - 104px); overflow-y: auto`.
- Tanpa pilihan: panel detail menampilkan empty state "Pilih kegiatan untuk melihat detail".

### Ponsel (<940px)

- Header ringkas: brand, tombol muat ulang, menu pengguna. Tab tidak tampil di header.
- Bottom nav tetap 4 item, ikon + label, `padding-bottom: env(safe-area-inset-bottom)`, `aria-current="page"` pada tab aktif.
- Konten utama diberi `padding-bottom` agar tidak tertutup bottom nav.
- Daftar memakai lebar penuh. Mengetuk item membuka **halaman detail penuh** (`position: fixed; inset: 0; z-index: 40; overflow-y: auto`).
- Halaman detail memiliki app bar sendiri: tombol kembali, judul singkat, dan aksi utama. Bottom nav disembunyikan saat detail terbuka.
- FAB "Buat BA" (kanan bawah, di atas bottom nav) tampil di Ringkasan dan Berita Acara selama detail tidak terbuka. Aksi: `setTab('ba')`, tutup detail, lalu arahkan fokus ke daftar Berita Acara.
- Di dalam halaman detail, aksi utama menjadi tombol lebar penuh yang menempel di bawah (`sticky bottom`).

Perilaku breakpoint memakai CSS kustom `@media (min-width: 940px)` dan `@media (max-width: 939.98px)` agar sesuai angka yang disepakati (bukan `lg` 1024px).

Detail kegiatan memakai **satu markup yang sama** untuk desktop dan ponsel. Di desktop panel tampil statis di kolom kanan; di ponsel panel yang sama menjadi overlay penuh saat `mobileDetail === true`. Tidak ada duplikasi markup detail.

---

## B. Model Status Kegiatan

Satu kegiatan diidentifikasi oleh `(blok, nama kegiatan)`, dengan nama = `pilihan + (detail ? ' - ' + detail : '')`.

| Status | Syarat | Tampil di | Aksi utama |
|---|---|---|---|
| `acc` | belum ada jadwal & belum ada BA | Jadwal, Berita Acara | Buat Jadwal / Buat BA |
| `terjadwal` | ada jadwal, belum ada BA | Jadwal, Berita Acara | Buat BA / Edit / Batalkan |
| `draft` | ada BA dengan `selesai === false` | **Berita Acara** | Lengkapi |
| `selesai` | ada BA dengan `selesai === true` | **Riwayat** (dan Jadwal dengan badge) | Lihat |

- `selesai` dihitung server: `Dosen` + `Tanggal Pelaksanaan` + `Jam` terisi.
- Kegiatan `selesai` **tidak** ditampilkan di Berita Acara.
- Kegiatan `selesai` **tetap** ditampilkan di Jadwal dengan badge "BA selesai"; Edit/Batalkan jadwal tetap boleh, dengan catatan pembatalan jadwal tidak menghapus BA.
- Kegiatan dengan sebagian peserta sudah masuk BA tetap dapat muncul sebagai sisa peserta (`baMember` sudah menandai baris yang tercakup BA).

### Helper pencocokan

Semua pencocokan memakai normalisasi teks: huruf kecil, buang diakritik, ganti non-alfanumerik dengan spasi, rapikan spasi.

- `sameKegiatan(blokA, namaA, blokB, namaB)`.
- `baForKegiatan({ blok, nama, tanggal }, baList)` — kandidat dengan blok+nama sama; dahulukan tanggal yang sama (`Tanggal Pelaksanaan` vs tanggal kegiatan), lalu tanggal terbaru.
- `jadwalForKegiatan({ blok, nama, tanggal }, jadwalList)` — aturan sama memakai `Tanggal`.
- `baForJadwal(j, baList)` — cocokkan `BA ID === j.baId`.
- `statusOf(ba, jadwal)` — `selesai` / `draft` / `terjadwal` / `acc`.
- `groupFullyScheduled(g, jadwalList)` — semua `idPengajuan` di `g.peserta` tercakup jadwal yang cocok.
- `unscheduledPeserta(g, jadwalList)` — peserta grup yang belum masuk jadwal mana pun.
- `buildBaWorkItems(kegiatanGroups, draftBaList)` — daftar antrean Berita Acara.
- `buildJadwalItems(jadwalList, jadwalPendingGroups)` — daftar Jadwal.
- `buildStats({ rows, kegiatanGroups, baList })` — angka Ringkasan.
- `buildBlokProgress(allKegiatanGroups, baList)` — progres per Blok.

Helper murni ini hidup di `public/bagian-state.js` dan diekspos sebagai `window.BagianState` agar dapat diuji langsung. `bagian.html` memuatnya sebelum `app-common.js`. Helper tidak menyentuh DOM dan tidak memanggil RPC.

---

## C. Ringkasan

Susunan desktop: sapaan + tanggal, 4 KPI, lalu grid dua kolom (Perlu Tindakan + Kelengkapan per Blok), lalu Jadwal Terdekat. Ponsel: satu kolom dengan urutan sama.

### KPI

- **Total Peserta** — jumlah baris `rows`.
- **Belum Dijadwalkan** — jumlah kegiatan `acc` (sisa peserta yang belum tercakup jadwal).
- **Draft BA** — `baList.filter(!selesai).length`.
- **BA Selesai** — `baList.filter(selesai).length`, dengan persentase terhadap seluruh kegiatan.

### Perlu Tindakan

Kartu aksi dengan jumlah dan tombol yang memindahkan tab + mengatur filter:

- **Draft BA** -> tab Berita Acara, filter `draft`.
- **Belum dijadwalkan** -> tab Jadwal, filter `belum`.
- **Jadwal lewat tanpa BA** -> tab Berita Acara, filter `belum` (jadwal dengan `Tanggal < hari ini` dan belum punya BA).

### Kelengkapan per Blok

- Satu baris per Blok: nama Blok, `x/y kegiatan selesai`, bar persentase.
- Persentase dihitung dari seluruh kegiatan (termasuk yang pesertanya sudah masuk BA) dibagi kegiatan yang punya BA `selesai`.
- Mengetuk baris membuka tab Berita Acara dengan filter Blok tersebut.

### Jadwal Terdekat

- Maksimal 5 jadwal dengan tanggal >= hari ini, urut terdekat.
- Mengetuk item membuka tab Jadwal dan memilih jadwal tersebut.

---

## D. Jadwal

### Daftar

Sumber item:

- Setiap baris `jadwalList`.
- Grup sisa peserta yang **belum sepenuhnya** tercakup jadwal (`!groupFullyScheduled`), dengan peserta = `unscheduledPeserta`.

Filter chip: `Semua` | `Belum dijadwalkan` | `Sudah dijadwalkan`.

Item menampilkan: nama kegiatan, Blok, tanggal/jam, dosen, jumlah peserta, badge status (`acc`/`terjadwal`/`draft`/`selesai`). Pencarian mencocokkan nama, Blok, dosen, dan nama/NPM peserta.

Urutan: belum dijadwalkan lebih dulu (tanggal kegiatan terdekat), lalu jadwal terbaru.

### Detail — belum dijadwalkan

- Header kegiatan + jumlah peserta sisa.
- Checklist peserta sisa (pilih semua / hapus semua).
- Form: Tanggal Pelaksanaan, Jam, Dosen (dengan saran), Catatan opsional.
- Tombol "Simpan Jadwal".
- Setelah sukses: muat ulang data, pilih jadwal yang baru dibuat bila `JadwalID` tersedia di respons; jika tidak, tutup detail dan tampilkan toast.

### Detail — sudah dijadwalkan

- Ringkasan jadwal: tanggal, jam, dosen, catatan, peserta.
- Aksi: **Edit Jadwal**, **Batalkan**, dan **Buat BA** (bila belum ada BA). Bila sudah ada BA draft, tombol menjadi **Lengkapi BA** dan membuka detail BA; bila selesai, **Lihat BA** membuka detail read-only.
- Edit memuat form yang sama dengan nilai terisi dan tombol "Simpan Perubahan".
- Batalkan memakai konfirmasi yang sudah ada; setelah sukses muat ulang dan tutup detail.

---

## E. Berita Acara (antrean kerja)

### Daftar

Sumber item:

- `kegiatanGroups` (peserta yang belum masuk BA): status `acc`/`terjadwal`, aksi "Buat BA".
- `draftBaList` (BA `!selesai`): status `draft`, aksi "Lengkapi".
- BA `selesai` **tidak** dimasukkan.

Filter chip: `Semua` | `Belum dibuat` | `Draft`.

Urutan: draft lebih dulu (tanggal terbaru), lalu kegiatan belum dibuat BA (tanggal terdekat).

Item menampilkan: nama kegiatan, Blok, tanggal, jumlah peserta, badge, dan aksi. Item draft menampilkan jumlah peserta sisa yang belum tercakup BA (bila ada) sebagai keterangan, tanpa menghilangkan item sisa tersebut dari daftar.

### Detail — belum ada BA

- Header kegiatan + status + stepper `ACC -> Jadwal -> BA`.
- Checklist peserta (dari grup; untuk jalur jadwal memakai peserta jadwal).
- Form BA yang sudah ada dipakai ulang: Label, Tanggal, Jam, Dosen, Catatan, unggah file, scan PDF.
- Tombol "Buat BA" / "Unggah BA".
- Bila kegiatan punya jadwal, form dibuka lewat `openBaFromJadwal` (peserta jadwal terpilih otomatis). Bila tidak, form manual dengan kegiatan sudah terpilih.
- Modal konfirmasi unggah (`ba.confirm`) dipertahankan.
- Setelah sukses: muat ulang data. Bila BA lengkap, item hilang dari antrean dan pengguna diberi toast "BA lengkap. Lihat di Riwayat."; bila draft, item tetap di antrean dengan badge Draft.

### Detail — draft

- Menampilkan identitas BA, file (bila ada), daftar peserta.
- Form inline: Dosen, Jam, Tanggal (menggantikan modal `ba.lengkapi` lama).
- Tombol "Simpan & Lengkapi" memakai `lengkapiBeritaAcaraBagian`.
- Validasi: dosen, jam, dan tanggal wajib terisi sebelum simpan.
- Setelah sukses: muat ulang data; bila menjadi lengkap, item pindah ke Riwayat dan detail ditutup dengan toast.

---

## F. Riwayat

- Sumber: `baList.filter(r => r.selesai)`, urut `Tanggal Pelaksanaan` terbaru.
- Desktop: tabel/kartu lebar penuh dengan kolom Kegiatan, Blok, Tanggal, Dosen, Peserta, File.
- Ponsel: kartu bertumpuk.
- Pencarian mencocokkan nama kegiatan, Blok, dosen, nama/NPM peserta.
- Filter Blok memakai `blokOptions`.
- Mengetuk item membuka detail **read-only**: metadata BA, peserta, catatan, dan tautan "Buka File BA" (`safeUrl`).
- Tidak ada aksi edit/hapus di Riwayat.

---

## G. Detail Kegiatan (dipakai bersama)

Struktur panel (desktop) / halaman (ponsel):

1. App bar/header: tombol kembali (ponsel), nama kegiatan, badge status.
2. `Blok · Nama Kegiatan`, tanggal kegiatan, jumlah peserta.
3. Stepper: ACC -> Jadwal -> BA (BA aktif bila draft/selesai).
4. Daftar peserta + status pengajuan + tautan surat bila ada.
5. Konteks form sesuai status (lihat D dan E).
6. Footer aksi (sticky di ponsel): aksi utama + aksi sekunder.

Seleksi disimpan sebagai `sel = { kind: 'group' | 'jadwal' | 'ba', key }`. `selectedItem` mengembalikan objek yang sesuai. Bila item hilang setelah polling (mis. BA menjadi lengkap), detail ditutup dan toast "Data sudah diperbarui." ditampilkan.

---

## H. State Frontend

```js
{
  activeTab: 'ringkasan',        // 'ringkasan' | 'jadwal' | 'ba' | 'riwayat'
  sel: { kind: '', key: '' },    // 'group' | 'jadwal' | 'ba'
  mobileDetail: false,           // halaman detail ponsel terbuka
  q: '',                         // pencarian daftar aktif
  fBlok: '',                     // filter Blok (Riwayat / Ringkasan)
  jadwalFilter: 'semua',         // 'semua' | 'belum' | 'sudah'
  baTabFilter: 'semua',          // 'semua' | 'belum' | 'draft'
  // state lama tetap: rows, baList, jadwalList, ba, jadwal, dosenPick, toast, ...
}
```

Computed baru (nama final):

- `allKegiatanGroups` — seluruh kegiatan dari `rows` (termasuk `baMember`), dipakai untuk statistik dan progres Blok.
- `jadwalPendingGroups` — grup sisa yang belum sepenuhnya terjadwal.
- `jadwalItems` — gabungan `jadwalList` + `jadwalPendingGroups`.
- `baWorkItems` — gabungan `kegiatanGroups` + `draftBaList`.
- `riwayatBaList` — BA selesai (sudah ada).
- `selectedItem` — item terpilih dari `sel`.
- `ringkasanStats`, `blokProgress`, `upcomingJadwal`.
- `formOpen` / `hasFormContent` — untuk guard.

Computed lama `jadwalKegiatanGroups`, `selectedGroup`, `baDuplicate`, `filteredRows`, `draftBaList`, `jadwalSiapBaList` dipertahankan bila masih dipakai form; yang tidak terpakai dihapus.

---

## I. Alur Aksi & Data

- `_fetchBootstrap()` sudah mengembalikan `baList`; **tidak perlu RPC tambahan**. `loadBaList()` dan pemanggilannya dihapus; setelah unggah BA gunakan `loadData()`.
- `silentRefresh()` tidak berjalan saat `loading`, `ba.open`, `jadwal.open`, atau `ba.lengkapi` aktif.
- `setTab(t, opts)`:
  1. Bila form terbuka dan berisi, minta konfirmasi "Perubahan belum disimpan. Tinggalkan?"; bila batal, hentikan.
  2. Reset `sel`, `mobileDetail`, dan `q`.
  3. Bila `opts.filter`/`opts.blok` diberikan (dari kartu Ringkasan), set filter tab tujuan; selain itu kembalikan filter tab tujuan ke `semua`.
  4. Set `activeTab`.
- `selectItem(kind, key)` — guard yang sama; set `sel`; di ponsel set `mobileDetail = true`; fokus ke tombol kembali.
- `closeDetail()` — `sel` kosong, `mobileDetail=false`, `ba.open=false`, `jadwal.open=false`, `ba.lengkapi=null` (setelah guard).
- Aksi yang sudah ada dipertahankan dan dipanggil dari detail:
  - `openJadwalForm()` / `selectJadwalKegiatan()` / `saveJadwal()`
  - `editJadwal(id)` / `cancelJadwal(id)`
  - `openBaPicker()` / `openBaFromJadwal(j)` / `submitBa()` / `uploadBaFile`
  - `editDraftBa(r)` (baru, menggantikan `lengkapiDraft`) / `saveDraftBa()` (baru, memanggil RPC lama)
  - scan PDF: `scanOnPhotos`, `scanBuildPdf`, `scanItems` tidak berubah.
- `openBaForGroup(g)`:
  - bila `g.jadwal` ada -> `openBaFromJadwal(g.jadwal)`;
  - selain itu -> reset form manual, set `ba.kegiatanKey = g.key`, `ba.tanggal = g.tanggal`.
- Setelah simpan/unggah: `await loadData()`, reset seleksi sesuai aturan tiap tab, tampilkan toast dari respons.

---

## J. Guard, Error, Empty, Loading

- **Guard buang perubahan**: berlaku saat menutup detail, pindah tab, memilih item lain, atau menekan kembali di ponsel, bila `jadwal.open` atau `ba.open` atau `ba.lengkapi` aktif dan `hasFormContent()` benar. Memakai `window.confirm`.
  - `hasFormContent()` = ada field teks/tanggal/jam/dosen/label/catatan yang tidak kosong, ada peserta terpilih, atau ada file/scan yang dipilih. Form yang baru dibuka tanpa isian boleh ditutup tanpa konfirmasi.
- **Loading awal**: skeleton baris daftar (3 baris) dan placeholder detail; tombol muat ulang berputar.
- **Empty state**:
  - Jadwal: "Belum ada kegiatan ACC untuk dijadwalkan."
  - Berita Acara: "Semua BA sudah lengkap." bila antrean kosong.
  - Riwayat: "Belum ada BA lengkap."
  - Detail: "Pilih kegiatan untuk melihat detail."
- **Error**:
  - Gagal muat data: toast error; cache lama tetap tampil bila ada (perilaku sekarang).
  - Auth error: logout (perilaku sekarang).
  - Gagal simpan/unggah: toast error, form dan isian tidak dihapus.
  - Gagal buka file: tautan tetap ditampilkan; tidak ada penanganan tambahan.
- **Polling**: bila data berubah dan item terpilih hilang, tutup detail + toast "Data sudah diperbarui."
- **Pencegahan double-submit**: tombol simpan/unggah `:disabled="loading"` seperti sekarang.

---

## K. Aksesibilitas & Konsistensi Visual

- Tab desktop memakai `role="tablist"`, `role="tab"`, `aria-selected`; bottom nav memakai `aria-current="page"`.
- Tombol ikon saja wajib punya `aria-label`.
- Detail ponsel memakai `role="dialog"` + `aria-modal="true"`; fokus awal ke tombol kembali; `Esc` menutup (desktop dan ponsel).
- Status tidak hanya dibedakan warna; selalu ada teks badge.
- Kontras teks minimal tetap seperti palet sekarang.
- Nama kegiatan/Blok yang panjang dipotong dengan ellipsis pada daftar; nama lengkap terlihat di detail.
- Tidak ada emoji di UI.

---

## L. Pengujian

Test baru: `new-code1-cf/test/bagian-workspace-v2.test.js`.

1. **Template** — `#app` di `bagian.html` dikompilasi dengan `@vue/compiler-dom` tanpa error/warning (pola `extractAppTemplate` + `installDocumentStub`).
2. **Navigasi** — tepat 4 label nav; tidak ada tab "Peserta"; `activeTab: 'ringkasan'`; bottom nav memuat 4 item dan `aria-current`.
3. **Breakpoint** — CSS memuat `@media (min-width: 940px)` dan `@media (max-width: 939.98px)`; bottom nav hanya tampil di bawah 940px.
4. **Helper murni** — muat `/bagian-state.js`, evaluasi dengan sandbox `window`, lalu uji:
   - normalisasi nama dan `sameKegiatan`;
   - `statusOf` untuk 4 kombinasi;
   - `baForKegiatan` memilih tanggal yang sama lebih dulu;
   - `buildBaWorkItems`: draft disertakan, BA selesai tidak, grup sisa tetap muncul;
   - `buildJadwalItems`: grup yang belum sepenuhnya terjadwal muncul, yang sudah penuh tidak;
   - `buildStats` dan `buildBlokProgress`.
5. **Struktur kerja** — `baWorkItems`, `draftBaList`, `riwayatBaList`, `openBaForGroup`, `saveDraftBa`, `selectedItem`, dan guard `hasFormContent` ada; modal `ba.lengkapi` lama tidak ada; kartu "Upload Berita Acara" terpisah tidak ada.
6. **Perilaku teks** — "Buat BA", "Lengkapi", "BA selesai", "Lihat di Riwayat" muncul; tombol FAB dan tombol kembali ada.

Semua test lama harus tetap hijau (`npx vitest run`).

---

## M. Rollout

1. Implementasi + test hijau.
2. Deploy Worker dari `new-code1-cf` (`wrangler deploy`) dan verifikasi live dengan cache-bust.
3. Cek manual: login, Ringkasan, buat jadwal, buat BA draft, lengkapi BA, item pindah ke Riwayat, tampilan ponsel (bottom nav, detail penuh, FAB), dan guard form.

## File Tersentuh

- `new-code1-cf/public/bagian.html`
- `new-code1-cf/public/bagian-state.js` (baru)
- `new-code1-cf/test/bagian-workspace-v2.test.js` (baru)
- `docs/superpowers/plans/2026-10-17-bagian-workspace-v2.md` (rencana implementasi)
