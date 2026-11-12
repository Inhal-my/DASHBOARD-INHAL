# Preview live: Tab Laporan Bagian (data dummy)

Preview statis untuk memeriksa tab **Laporan Bagian** tanpa menyentuh data produksi.
`index.html` dibangun dari `new-code1-cf/public/detail-laporan.html` asli, lalu `fetch('/api/rpc')`
di-intercept oleh `mock-boot.js` sehingga memakai `mock-data.js`.

## Cara membangun ulang

```bash
# 1. Regenerasi data dummy (deterministik, 12 kegiatan / 117 pengajuan / 9 BA PEL / 8 BA PEN)
node mockups/laporan-bagian-live/generate-mock.cjs

# 2. Bangun preview + salin aset dari new-code1-cf/public
node mockups/laporan-bagian-live/build-preview.cjs

# 3. Sajikan statis (port bebas)
python3 -m http.server 8127 --directory mockups/laporan-bagian-live
```

Buka `http://127.0.0.1:8127/index.html`, klik tab **Laporan Bagian**.

## Berkas

| Berkas | Peran |
|---|---|
| `generate-mock.cjs` | Membuat `mock-data.js` (payload `getLaporanBootstrap`) |
| `mock-data.js` | Data dummy hasil generator (ikut di-commit agar preview langsung jalan) |
| `mock-boot.js` | Override `fetch` `/api/rpc`, sesi admin palsu, paksa `?mode=analitis` |
| `build-preview.cjs` | Menyalin `detail-laporan.html` + aset terkait menjadi `index.html` |
| `index.html`, `app-common.js`, `bukti-preview.css`, `gs-shim.js`, `vendor/` | Artefak build (di-ignore, dibuat ulang oleh `build-preview.cjs`) |

## Yang bisa diperiksa

- KPI Kegiatan / BA PEL / BA PEN / Total hitungan.
- Matriks Blok × Bagian: 2+ BA PEL (hijau), 1 BA PEL (kuning), 0 dengan kegiatan (merah muda),
  0 tanpa kegiatan (putih, disabled).
- Filter Bagian menyempitkan kolom + KPI.
- Klik sel → tabel detail tersaring + chip "Disaring: Blok · Bagian" & "Tampilkan semua".
- Expand baris → panel peserta dan daftar dokumen BA PEL (semua sesi, dengan jam).
- Export .xlsx (sheet Rekap, Rekap Dosen, Rekap Bagian, Detail Kegiatan, Detail Peserta, Berita Acara, Pembayaran).
