# Desain: Tabel "Kelengkapan per Blok" Ringkas 8 Kolom (Opsi A)

Tanggal: 2026-10-28
Status: **Diimplementasi** (markup + CSS + state/computed/method + test).
Terkait:
- `docs/superpowers/specs/2026-09-11-dashboard-laporan-bagian-audit.md` (asal tabel & audit BA)
- `docs/superpowers/specs/2026-10-14-ba-pendukung-pelaksanaan-unifikasi-design.md` (koeksistensi BA Pendukung & BA Pelaksanaan)
- `docs/superpowers/specs/2026-10-27-ba-pendukung-sumber-pilih-peserta-design.md` (multi-sesi)
- Kode: `new-code1-cf/public/dashboard.html` (tab Berita Acara), test `new-code1-cf/test/dashboard-ba-tabel.test.js`

> Dokumen ini catatan desain. Tidak ada perubahan DB/schema/endpoint — seluruh perubahan ada di template + state halaman dashboard.

---

## 1. Masalah

Tabel "Kelengkapan per Blok" di tab Berita Acara tumbuh sampai **12 kolom** (Bagian/Kegiatan, Tanggal, Realisasi, BA Pendukung, Keputusan, BA Pelaksanaan, Progres, Dosen, Aksi, dst.). Akibatnya:

1. **Baris sangat lebar dan tinggi.** Setiap tanggal dirender satu per satu dengan `whitespace-nowrap`, sehingga satu kegiatan multi-sesi mendorong lebar kolom dan memaksa scroll horizontal panjang.
2. **Informasi terpecah.** Tanggal rencana dan realisasi ada di dua kolom berbeda; mata harus mencocokkan sendiri mana jadwal yang sudah terealisasi.
3. **Tidak ada navigasi.** Semua kegiatan dirender sekaligus (ratusan baris), sehingga render berat dan pengguna kehilangan konteks saat scroll.
4. **Tidak ada pencarian.** Filter hanya Bagian/Blok/chip status; mencari satu kegiatan atau dosen berarti scan manual.

## 2. Keputusan (Opsi A)

| # | Keputusan | Alasan |
| --- | --- | --- |
| K1 | **Ringkas ke 8 kolom**: Kegiatan, Tanggal · Realisasi, BA Pendukung, Keputusan, BA Pelaksanaan, Progres, Dosen, Aksi | Kolom Realisasi digabung ke kolom Tanggal; sisa kolom tetap agar fitur (Kelola BA, riwayat, progres) tidak hilang |
| K2 | **Tanggal 2 per baris** (`.ba-date-grid` grid 2 kolom) + chip `+ tanggal` untuk realisasi di luar rencana | Tanggal rencana & realisasi terlihat berpasangan; sesi ekstra tetap terlihat tanpa melebarkan kolom |
| K3 | **Dosen diringkas** 2 nama + penanda `+n` (tooltip berisi semua nama) | Kolom dosen tidak mendominasi tinggi baris |
| K4 | **Kolom Kegiatan sticky** (`th.lead`/`td.lead`) + `.ba-scroll` dengan `max-height` | Konteks kegiatan tetap terlihat saat scroll horizontal/vertikal |
| K5 | **Paginasi klien** 10/25/50/100 per halaman dengan pager berjendela (`...`) | Render ringan, kontrol eksplisit, tanpa endpoint baru |
| K6 | **Pencarian teks** (`bagian.q`) menyatu dengan filter Bagian/Blok/chip | Satu jalur filter, satu reset |
| K7 | **Kartu mobile memakai data & pager yang sama** | Konsistensi desktop ↔ mobile tanpa markup duplikatif logic |
| K8 | **Enrichment di computed, helper berargumen tetap `methods`** | Menghindari computed berparameter (aturan `test/dashboard-template.test.js:331-344`) |

Non-tujuan: tidak mengubah query/endpoint data BA, tidak mengubah aturan kelengkapan (`unitHasPendukung`/`unitHasPelaksanaan`/`unitIncomplete`), tidak mengubah panel audit maupun modal Kelola BA.

## 3. Struktur Data Baris

`bagianTableRows` (computed) menambahkan properti turunan per baris:

```js
{
  ...unit,
  __orphan: false,
  __pendukungBa: [...],   // BA sumber Admin
  __pelaksanaanBa: [...], // BA sumber Bagian
  __progres: [...],       // dot progres (progresDots)
  __tanggal: { total, rencana: [{ tanggal, jam, ada }], ekstra: [{ tanggal, jam, ada }] },
  __dosen: { tampil: [nama...], sisa, semua }
}
```

- `tanggalSesiInfo(r)` (methods):
  - `rencana` = `r.tanggalList` (fallback `[r.tanggal]`), dedupe, lalu dicocokkan ke `r.pelaksanaan[].tanggal` → `ada: true` + `jam` bila ada realisasi pada tanggal itu.
  - `ekstra` = tanggal realisasi yang tidak ada di rencana, urut naik.
  - `total` = `r.baAudit.jumlahSesi` bila ada, jika tidak `max(jumlah rencana, jumlah tanggal realisasi unik)`.
- `dosenRingkas(r)` (methods): `tampil = dosenList.slice(0, 2)`, `sisa = max(0, n - 2)`, `semua = dosenList.join(', ')` (dipakai sebagai `title`).

Baris `__orphan` (BA tanpa pengajuan) tetap didukung: `tanggalList` sudah diisi satu tanggal, `pelaksanaan`/`dosenList` kosong sehingga helper mengembalikan `rencana` satu item tanpa realisasi dan `dosen.tampil` kosong.

## 4. Filter & Paginasi

- `bagianFilteredUnits` menyaring berurutan: `fBagian` → `fBlok` → `chip` → `q` (`unitMatchesQuery`, sudah mencakup label/pilihan/detail/blok/bagian/dosen/peserta/BA).
- State baru: `bagian.page` (default 1), `bagian.perPage` (default 10).
- Computed:
  - `bagianPageInfo` → `{ n, perPage, pages, page, start, end }`; `page` di-clamp ke `[1, pages]` sehingga data berubah tidak membuat halaman kosong.
  - `bagianPagedRows` → `bagianTableRows.slice((page-1)*perPage, ...)`.
  - `bagianPageList` → nomor halaman berjendela ±2 + halaman pertama/terakhir.
- Methods: `bagianSetPage(p)` (clamp + scroll ke `#ba-unit-list`), `bagianSetPerPage(v)` (hanya 10/25/50/100).
- Reset ke halaman 1 pada: `setBagianChip`, `sortBagian`, `resetBagianFilter`, `openBlokCard`, dan watcher `bagian.q`/`bagian.fBagian`/`bagian.fBlok`/`bagian.perPage` + `bagianPageInfo.pages` (clamp saat jumlah baris menyusut).
- Tabel "Pemeriksaan BA Pelaksanaan" tetap memakai `bagianTableRows` penuh (tidak terpengaruh paginasi).

## 5. Markup & CSS

Markup (`public/dashboard.html`, tab `ba`):

- Toolbar: `.ba-toolbar-row` berisi `.ba-toolbar-search` (input `bagian.q`), dua `select.ba-select` (Bagian/Blok), tombol Reset, chip status, dan teks "Menampilkan start–end dari n kegiatan" dari `bagianPageInfo`.
- Tabel desktop di dalam `.ba-scroll.hidden.md:block` dengan kelas `ba-tbl`, header sticky, kolom pertama `lead` sticky; baris rincian (peserta + daftar BA) memakai `colspan="8"`.
- Pager desktop `<div class="ba-pager-bar ba-pager-desk">` (select ukuran halaman + `‹`/`›` + daftar halaman) di luar area scroll agar selalu terlihat.
- Kartu mobile `md:hidden` per baris + `<div class="ba-pager-bar ba-pager-mob">` dengan tombol Sebelumnya/Berikutnya dan indikator `page/pages`.

CSS baru (blok `/* --- Kelengkapan per Kegiatan --- */`):

| Kelas | Peran |
| --- | --- |
| `.ba-toolbar-row`, `.ba-toolbar-search`, `.ba-search`, `.ba-select`, `.ba-reset` (+`:disabled`) | Toolbar filter/pencarian ringkas |
| `.ba-date-grid` (`repeat(2, minmax(0,1fr))`), `.ba-date` (+`.is-ok`, `em`), `.ba-date-extra` | Tanggal 2 per baris, dot hijau bila sudah terealisasi, chip sesi ekstra |
| `.ba-sesi-badge`, `.ba-more`, `.ba-kegiatan-label` | Badge sesi, tombol `+n`, label kegiatan |
| `.ba-tbl` (header sticky, `td`/`th.lead` sticky, `td` valign top), `.ba-scroll` (`max-height: calc(100vh - 168px)` ≥768px) | Tabel kompak + konteks tetap |
| `.ba-pager-bar`, `.ba-pager` (+`is-active`, `:disabled`, `.ellipsis`), `.ba-pager-size`, `.ba-pager-desk`/`.ba-pager-mob` | Pager desktop/mobile |

Catatan teknis: `display` pager **tidak** memakai utility Tailwind (`hidden md:flex`) karena `.ba-pager-bar` sendiri mendefinisikan `display` dengan specificity sama sehingga urutan stylesheet menentukan hasil. Sebagai gantinya dipakai `.ba-pager-bar.ba-pager-desk` / `.ba-pager-bar.ba-pager-mob` (specificity dua kelas) dengan media query eksplisit.

## 6. Dampak & Kompatibilitas

- Nama helper lama yang dipakai test tetap ada: `openPelaksanaanPanel(r)`, `r.__pelaksanaanBa`, `toggleBaExpand`, `openRiwayat` + `r.__progres` + `stageTooltip(r)`, `progresDots`, `pesertaDenganBa`, `title="Kelola BA"`.
- `bagianTableRows` tetap dipakai panel audit (`bagianAuditRows`), ekspor pemeriksaan, dan sheet BA — tidak ada perubahan kontrak.
- Filter chip/Blok/Bagian tetap sama; `bagian.q` sebelumnya hanya dipakai sheet BA (`baSheet.q`), sekarang juga memfilter tabel utama (state terpisah, tidak saling memengaruhi).
- Hash CSP inline script berubah → `npm run csp:generate` dijalankan ulang (`npm run csp:check` → "CSP sinkron").

## 7. Pengujian

`new-code1-cf/test/dashboard-ba-tabel.test.js` (9 test):

1. Template `#app` tetap valid (`@vue/compiler-dom` tanpa error).
2. 8 header kolom + `td.lead` sticky + `colspan="8"` + tidak ada lagi sel realisasi lama.
3. `.ba-date-grid` 2 kolom, `is-ok`, `ba-date-extra`, akses `r.__tanggal.*`.
4. `dosenRingkas` (`slice(0,2)`, `sisa`) & pemakaian `r.__dosen.*`.
5. Paginasi: state `page/perPage`, computed/method, kelas pager, teks "Menampilkan …".
6. Pencarian `bagian.q` + watcher reset halaman + clamp `bagianPageInfo.pages`.
7. Rumus clamp/slice paginasi & whitelist ukuran halaman.
8. Helper berargumen tetap `methods` (aturan computed tanpa parameter).
9. Kartu mobile memakai `bagianPagedRows`, `.ba-date-grid`, dan pill status yang sama.

Regresi: `test/dashboard-template.test.js` (60), `dashboard-ba-audit.test.js` (4), `dashboard-ba-pendukung.test.js` (2), plus seluruh suite (755 test) dan `test/security-headers.test.js` setelah CSP diregenerasi.

> Catatan lingkungan: suite vitest memakai `@cloudflare/vitest-pool-workers`; bila path repo mengandung spasi, `workerd` gagal me-resolve worker (`No such module ".../vitest/dist/workers/threads.js"`). Solusi sementara saat verifikasi: jalankan suite pada salinan repo di path tanpa spasi.

## 8. Tindak Lanjut

- (Opsional, belum dikerjakan) Accordion + paginasi untuk tabel "Pemeriksaan BA Pelaksanaan" agar tidak merender semua sesi sekaligus.
- (Opsional) Pilihan `perPage` disimpan di `localStorage` agar preferensi pengguna bertahan.
- (Opsional) Ekspor CSV khusus halaman aktif vs seluruh hasil filter (saat ini ekspor pemeriksaan memakai seluruh baris).