# Desain: Optimasi Kecepatan Loading `detail-laporan.html`

Tanggal: 2026-08-22
Status: Disetujui user (22 Agu 2026)

## Latar Belakang

Halaman `detail-laporan.html` memuat seluruh data laporan melalui satu panggilan GAS `getLaporanBootstrap`, lalu merender 4 tab (Rekap, Dosen, Bagian, Berita Acara). User meminta pemeriksaan dan perapian **kecepatan loading** halaman ini, dengan kriteria sukses:

- **Terukur & transparan** — ada indikator waktu muat yang terlihat.
- **Terasa cepat tampil** — persepsi kecepatan di mata user, bukan hanya angka teknis.

Skala data saat ini kecil (10 baris, target akhir ±300 baris). Oleh karena itu waktu loading didominasi **aset & roundtrip GAS**, bukan volume data.

### Temuan Audit

1. **Server — bottleneck O(n×m):** di `getLaporanBootstrap` (`1_business.gs:1591-1592`), untuk setiap pengajuan dijalankan `details.filter(...)` dan `histories.filter(...)` → kompleksitas O(P×D + P×H). Belum terasa di skala kecil, tapi menjadi penghambat di skala akhir ±300 baris.
2. **Client — persepsi lambat:** overlay full-screen "Memuat data..." (`v-if="loading"`) menutupi seluruh halaman; tidak ada umpan balik bahwa struktur halaman sudah tersedia. Pengguna hanya melihat layar kosong + spinner.
3. **Client — tidak ada pengukuran:** tidak ada indikator waktu muat yang ditampilkan ke user.
4. **Aset:** Vue dimuat sinkron di ujung body (`detail-laporan.html:662`); font + icons CDN sudah via preconnect/`display=swap`; SheetJS sudah lazy-load saat export (sudah baik, tidak diubah).

## Solusi (Pendekatan A — server + client + pengukuran)

### 1. Server: hilangkan O(n×m) di `getLaporanBootstrap`

Bangun index-map **sekali sebelum loop**, lalu gunakan di dalam loop per pengajuan:

```js
const detailById = {};   // key: 'ID Pengajuan' → array detail
details.forEach(function(d) {
    const k = String(d['ID Pengajuan'] || '').trim();
    (detailById[k] = detailById[k] || []).push(d);
});
const historyById = {};  // pola yang sama untuk histories
```

Di dalam `rows.map(...)`:

```js
const id = String(p['ID Pengajuan'] || '').trim();
return {
    pengajuan: pengajuanCopy,
    details: (detailById[id] || []).map(function(d) { return _clientRow(d); }),
    history: (historyById[id] || []).map(function(h) { return _clientRow(h); })
};
```

**Kontrak hasil tidak berubah:** urutan detail/history per pengajuan mengikuti urutan baris di tabel asli (index-map di-build dengan `push` berurutan), sehingga output identik. `getLaporanBootstrap` tetap satu panggilan; tidak ada endpoint baru, tidak ada perubahan bentuk payload.

### 2. Client: ukur & tampilkan waktu muat (transparan)

- `loadData()` mencatat `performance.now()` di awal (sebelum `this.run`) dan setelah data di-assign; selisihnya disimpan ke `this.loadTimeMs` (hanya saat sukses).
- Badge kecil di hero, tepat di samping tombol "Muat Ulang": ikon `bi-stopwatch` + teks `Dimuat dalam 0,8 dtk`, tampil hanya setelah load sukses (`v-if="loadTimeMs"`).
- Tambah `console.time('getLaporanBootstrap')` / `console.timeEnd('getLaporanBootstrap')` di dalam `loadData` untuk debugging devtools (tidak mengubah payload).

Format angka: 1 desimal, gunakan locale `id-ID` (`loadTimeMs/1000`).

### 3. Client: skeleton per tab alih-alih overlay penuh (terasa cepat)

Ganti overlay full-screen (`v-if="loading"`) dengan **skeleton inline di dalam setiap section tab**:

- Saat `loading` true, tiap section tab (rekap/dosen/bagian/ba) menampilkan placeholder statis berisi blok abu-abu `animate-pulse` yang meniru bentuk konten asli (kartu untuk rekap, baris tabel untuk matriks/tabel, list item untuk BA).
- Struktur halaman (navbar, hero, filter bar, tab switcher) langsung terlihat sejak awal; hanya isi tab yang menunggu data.
- Skeleton dirender per tab aktif (menggunakan `v-if="loading"` di dalam section yang sama), sehingga saat data tiba, transisi ke konten asli mulus (reuse `transition name="fade"` yang sudah ada).

Skeleton tiap tab:

| Tab | Bentuk skeleton |
|---|---|
| Rekap | grid kartu 6 kolom berisi blok ikon + teks |
| Dosen | header kartu + grid baris × kolom abu-abu |
| Bagian | baris tabel abu-abu (5 baris) |
| BA | list item kartu (4 item) |

CSS memakai kelas Tailwind yang sudah ada (`animate-pulse`, `bg-slate-200/70`, `rounded-xl`, dst.), tidak menambah kelas baru.

### 4. Aset

- `<script src="...vue.global.prod.js">` diberi atribut `defer`. Skrip inline Vue berada di ujung body dan app baru di-`mounted` setelah parse selesai, sehingga `defer` tidak mengubah urutan eksekusi yang bergantung DOM — hanya menandai non-blocking.
- Font (`display=swap`) dan preconnect sudah benar; tidak diubah.
- Icons bootstrap tetap di head (blokir kecil, diterima).
- **Tidak menambah cache klien** — data kecil (±300 baris), roundtrip GAS dominan; cache menambah kompleksitas tanpa manfaat berarti (YAGNI).

## Lingkup File

- **Diubah:** `new-code1/1_business.gs` (hanya fungsi `getLaporanBootstrap`, blok index-map + loop) dan `new-code1/pages/detail-laporan.html` (data `loadTimeMs`, `loadData` timing, hero badge, skeleton per tab, atribut `defer` pada Vue).
- **Tidak diubah:** `0_code.gs`, `dashboard.html`, `bagian.html`, `index.html`, `portal.html`, fungsi GAS lain, logika filter/export/login/session, struktur data respons `getLaporanBootstrap`.

## Pengujian

### Verifikasi Sintaks

```bash
node --check /tmp/opencode/check/detail_laporan_inline.js
```

(ekstrak `<script>` inline terakhir dari `detail-laporan.html`, pola sama seperti plan sebelumnya)

```bash
node --check /tmp/opencode/check/business.gs.js
```

(ekstrak blok fungsi `getLaporanBootstrap` + dependensi `_clientRow`, `_getBiayaMap`, `_getBaPesertaMap`, `formatRupiah` ke file validasi, lalu `node --check`)

### Verifikasi Perilaku Server (simulasi Node)

Simulasikan logika `getLaporanBootstrap` dengan fixture kecil (mis. 3 pengajuan, 5 detail, 4 history) di Node harness untuk memastikan:

- Output `details`/`history` per pengajuan **identik** sebelum vs sesudah optimasi (urutan & isi).
- Pengajuan tanpa detail/history tetap mendapat array kosong.

### Pengujian Manual (setelah deploy)

1. Buka halaman Laporan → struktur halaman langsung terlihat (navbar, hero, tab), area konten menampilkan skeleton saat data dimuat.
2. Setelah data tiba, badge "Dimuat dalam X dtk" muncul di hero.
3. Semua tab (Rekap, Dosen, Bagian, Berita Acara) tetap berfungsi normal; muat ulang via tombol "Muat Ulang" tetap jalan dengan skeleton + badge baru.
4. DevTools: `console.time('getLaporanBootstrap')` mencatat durasi panggilan GAS.
5. Login/session, export XLSX, filter di semua tab tidak berubah perilakunya.
