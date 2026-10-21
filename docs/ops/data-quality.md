# Audit Duplikat Jadwal (Dry-Run)

Terakhir diperbarui: 2026-10-21

## Tujuan

Menampilkan jadwal yang dianggap identik oleh aplikasi, tanpa mengubah atau
menghapus data. Script ini dipakai sebelum memutuskan pembersihan duplikat.

## Batasan

- Hanya membaca file dump SQL.
- Database diproses di memori; tidak ada koneksi tulis ke D1.
- Tidak menghasilkan perintah `DELETE`.
- Baris nonaktif (`active <> 1`) tidak dihitung sebagai duplikat.

## Langkah

Ekspor dump dari staging atau produksi. Ekspor bersifat baca-saja.

```bash
# Ekspor staging
npx wrangler d1 export inhal-poc-staging --remote --config wrangler.staging.toml --output=/tmp/opencode/jadwal-staging.sql
```

```bash
# Jalankan audit dry-run
cd new-code1-cf
node scripts/audit-jadwal-duplikat.mjs /tmp/opencode/jadwal-staging.sql
```

Bisa juga lewat npm:

```bash
npm run audit:jadwal -- /tmp/opencode/jadwal-staging.sql
```

## Membaca hasil

- `summary.totalGroups`: jumlah kelompok jadwal identik.
- `summary.extraRows`: jumlah baris berlebih jika hanya satu baris per kelompok dipertahankan.
- `summary.manualReviewGroups`: kelompok yang tidak aman dibersihkan otomatis.
- `summary.baLinkedRemovals`: baris calon hapus yang masih terhubung ke BA.
- `keep`: baris yang disarankan dipertahankan.
- `remove`: baris calon hapus beserta `safeToRemove`.

Urutan pemilihan `keep`:

1. Baris yang memiliki BA.
2. Timestamp paling awal.
3. ID database paling kecil.

Jika `safeToRemove` bernilai `false`, jangan hapus baris tersebut tanpa pemeriksaan
manual. Artinya baris masih dirujuk oleh `berita_acara.jadwal_id`.

## Tindak lanjut pembersihan

Script ini tidak melakukan pembersihan. Jika hasil audit akan ditindaklanjuti:

1. Cadangkan D1 dan catat jumlah baris terdampak.
2. Jalankan audit pada dump staging terlebih dahulu.
3. Review kelompok yang memiliki `needsManualReview = true`.
4. Minta persetujuan eksplisit sebelum menghapus data.
5. Hapus `jadwal_peserta` dan `jadwal_pelaksanaan` dalam satu transaksi.
6. Jalankan ulang audit dan pastikan `summary.totalGroups` sesuai harapan.

## Catatan

- Audit di modal "Audit Integritas Data" tetap menjadi pemeriksaan cepat.
- Script ini memberi rincian per baris untuk keputusan pembersihan.
- Hasil pada dump lokal 2026-10-21: 2 jadwal aktif, 0 duplikat.
