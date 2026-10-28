# Keamanan Aplikasi INHAL

Tanggal: 2026-10-18
Cakupan: MFA admin, security headers/CSP, dan audit akses berkas (Poin 4).

## 1. Security headers dan CSP

Header keamanan dipasang di dua tempat:

- `public/_headers` untuk aset statis (HTML, JS, CSS) yang disajikan langsung oleh Workers Static Assets.
- `src/security/headers.js` (middleware Hono) untuk respons yang dihasilkan Worker, termasuk `/api/*` dan redirect.

Header yang dipasang:

| Header | Nilai |
| --- | --- |
| `Content-Security-Policy` | `default-src 'self'`, script inline memakai hash SHA-256, `'unsafe-eval'` untuk compiler runtime Vue |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |

### Regenerasi CSP

CSP memuat hash setiap blok `<script>` inline di `public/*.html`. Setiap kali script inline diubah, hash harus dibuat ulang:

```bash
# Dari direktori new-code1-cf
npm run csp:generate
```

Perintah ini menulis ulang `public/_headers` dan `src/security/csp.js`. Test `test/security-headers.test.js` gagal bila hash tidak sinkron dengan HTML, sehingga kelalaian ini terdeteksi sebelum deploy.

Catatan:

- `_headers` hanya berlaku untuk aset statis; header respons Worker diatur middleware.
- Gaya inline diizinkan lewat `style-src 'unsafe-inline'` karena halaman memakai banyak atribut `style`.
- `'unsafe-eval'` diperlukan oleh `vue.global.prod.js` (runtime compiler). Jika kelak memakai build Vue yang sudah dikompilasi, `unsafe-eval` dapat dihapus.
- Google Fonts diizinkan pada `style-src` dan `font-src`; font lokal Bootstrap Icons
  diizinkan lewat `font-src 'self'`.

## 2. MFA admin (TOTP, opt-in)

MFA bersifat opsional per akun admin agar tidak mengunci akun yang belum menyiapkan autentikator.

### Skema

- Tabel `admin_mfa`: `admin_id` (PK), `secret`, `enabled`, `recovery` (JSON hash), `last_step` (anti-replay), `created_at`, `updated_at`.
- Kolom `sessions.admin_id` mengikat sesi admin ke baris `admin`, sehingga perubahan MFA hanya berlaku untuk akun tersebut.
- Migrasi: `migrations/2026-10-17-admin-mfa.sql`.

### Alur RPC

| RPC | Fungsi |
| --- | --- |
| `mfaStatus` | Status aktif, jumlah recovery code tersisa, ketersediaan sesi |
| `mfaSetup` | Membuat secret baru (pending) dan `otpauthUrl` |
| `mfaEnable` | Memverifikasi kode 6 digit, mengaktifkan MFA, mengembalikan 8 recovery code sekali tampil |
| `mfaDisable` | Memerlukan password admin + kode autentikator/recovery |

Login `authenticateAdmin(password, code)`:

1. Password diperiksa seperti biasa.
2. Jika MFA aktif dan `code` kosong, respons `{ ok: false, mfaRequired: true }` tanpa menambah hitungan gagal.
3. Kode diperiksa dengan toleransi satu langkah waktu. Kode yang sudah dipakai (`last_step`) ditolak (anti-replay).
4. Recovery code hanya disimpan sebagai hash SHA-256 dan dihapus setelah dipakai.
5. Hitungan throttle login tetap dipakai untuk kode yang salah.

### Batasan

- Sesi admin lama (dibuat sebelum migrasi) memiliki `admin_id` kosong; pengguna harus login ulang untuk mengelola MFA.
- Kehilangan perangkat autentikator dan seluruh recovery code berarti MFA tidak dapat dinonaktifkan lewat UI. Pemulihan manual: hapus baris `admin_mfa` untuk `admin_id` terkait melalui D1, lalu login ulang.
- MFA tidak diwajibkan; admin dapat menonaktifkannya sendiri dengan dua faktor.

## 3. Audit akses berkas

`GET /api/files/:id` menulis `audit_log` dengan:

- `aksi`: `FILE_ACCESS`
- `actor_email`: nama sesi admin
- `target`: ID unggahan
- `detail`: nama berkas

Penulisan audit bersifat best-effort: kegagalan insert dicatat sebagai `audit_log_write_failed` dan tidak menggagalkan unduhan.

## 4. Urutan deploy

Migrasi harus diterapkan sebelum kode baru karena `createSession` menulis `sessions.admin_id`.

```bash
# Dari direktori new-code1-cf
npx wrangler d1 execute inhal-poc --remote --file=./migrations/2026-10-17-admin-mfa.sql
npx wrangler deploy --config wrangler.production.toml
```

Poin 4 sudah di-deploy pada 2026-10-18 (versi Worker `fcdfd4d1-108d-4149-970e-1ada867d49d8`). Migrasi MFA sudah diterapkan ke D1 produksi.

Sejak 2026-10-28 jalur backup R2/Workflow dibatalkan: tidak ada binding R2 di
`wrangler.toml`/`wrangler.production.toml`, dan backup harian dijalankan GitHub
Actions dengan arsip terenkripsi di Google Drive (`docs/ops/backup-restore.md`).

## 5. Verifikasi

```bash
# Test fokus keamanan
npx vitest run test/mfa-totp.test.js test/mfa-recovery.test.js test/mfa-flow.test.js test/security-headers.test.js test/file-audit.test.js
```

Verifikasi produksi setelah deploy:

1. `curl -I https://inhal-form.prodi.workers.dev/portal` memuat CSP dan header keamanan.
2. `curl -I https://inhal-form.prodi.workers.dev/api/health` memuat header yang sama.
3. Login admin, buka menu Keamanan, aktifkan MFA, lalu login ulang dengan kode.
4. Unduh berkas sebagai admin, lalu periksa baris `FILE_ACCESS` di `audit_log`.
