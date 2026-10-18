# Desain Keamanan INHAL (Poin 4)

Tanggal: 2026-10-17
Status: implementasi selesai dan teruji lokal; deploy menunggu R2 aktif bersama Poin 2/3.

## Tujuan

1. MFA untuk akun admin dashboard.
2. Security headers dan CSP untuk halaman serta API.
3. Audit akses berkas admin.

## Audit kondisi awal

- `authenticateAdmin` hanya memverifikasi password; tidak ada faktor kedua.
- Sesi disimpan di tabel `sessions` tanpa `admin_id`, sehingga tidak ada relasi pasti antara sesi dan baris `admin`.
- Halaman statis tidak mengirim security headers (`X-Frame-Options`, `nosniff`, CSP, dan sejenisnya).
- CSP belum ada; halaman memakai inline `<script>`, inline `<style>`, Google Fonts, dan Vue global yang memakai runtime compiler (`new Function`).
- `GET /api/files/:id` sudah mewajibkan sesi admin, tetapi akses berkas tidak dicatat ke `audit_log`.
- Tidak ada `onclick=` inline; interaksi memakai Vue `@click`, sehingga hash CSP untuk script inline dapat dipakai.

## 1. MFA TOTP

### Model data

Tabel baru `admin_mfa`:

| Kolom | Keterangan |
|---|---|
| `admin_id` | PK, relasi ke `admin.id` |
| `secret` | Base32 TOTP, disimpan di D1 |
| `enabled` | 0 = menunggu verifikasi, 1 = aktif |
| `recovery` | JSON array hash SHA-256 recovery code |
| `last_step` | Langkah TOTP terakhir yang dipakai (anti-replay) |
| `created_at`, `updated_at` | Timestamp UTC |

Migrasi juga menambah `sessions.admin_id INTEGER` agar sesi admin terhubung ke akun MFA.

### Alur login

1. Admin memasukkan password (dan kode bila diminta).
2. Password dicocokkan seperti sekarang. Bila tidak cocok, tidak ada informasi MFA yang dibocorkan.
3. Bila baris `admin_mfa` aktif:
   - Tanpa kode: kembalikan `{ ok: false, mfaRequired: true }`.
   - Kode TOTP diverifikasi dengan jendela ±1 langkah (30 detik).
   - Bila TOTP gagal, coba recovery code sekali pakai.
   - TOTP yang sudah dipakai (`step <= last_step`) ditolak.
   - Gagal verifikasi dicatat ke throttle yang sudah ada.
4. Bila berhasil, sesi dibuat dengan `admin_id`.

MFA bersifat **opt-in per akun**. Tidak ada enforcement yang bisa mengunci admin di luar; dokumentasi menyarankan semua admin mengaktifkan MFA. Enforcement dapat ditambahkan setelah semua akun terdaftar.

### Alur pendaftaran

1. Admin membuka modal **Keamanan** dari sidebar.
2. `mfaSetup` membuat secret baru, menyimpannya sebagai `enabled=0`, dan mengembalikan secret + `otpauth://` URL (tanpa QR eksternal).
3. Admin memasukkan kode dari aplikasi authenticator; `mfaEnable` memverifikasi lalu mengaktifkan MFA.
4. `mfaEnable` mengembalikan 8 recovery code sekali pakai; hanya hash yang disimpan.
5. `mfaDisable` memerlukan password + kode TOTP/recovery.

### RPC baru

- `mfaStatus` — status aktif dan jumlah recovery code tersisa.
- `mfaSetup` — membuat secret sementara.
- `mfaEnable` — verifikasi kode dan mengaktifkan.
- `mfaDisable` — menonaktifkan dengan password + kode.

Semua memakai `requireAdmin`; `mfaSetup`/`mfaEnable`/`mfaDisable` memerlukan `session.adminId`.

### TOTP

Implementasi tanpa dependensi baru di `src/mfa/totp.js`: base32 encode/decode, HMAC-SHA1 via Web Crypto, dynamic truncation, 6 digit, periode 30 detik. Diuji dengan vektor RFC 6238.

## 2. Security headers dan CSP

### Header dasar

`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(), microphone=(), payment=(), usb=()`, `Cross-Origin-Opener-Policy: same-origin`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Robots-Tag: noindex, nofollow`.

### CSP

```
default-src 'self';
script-src 'self' <sha256 inline scripts> 'unsafe-eval';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com data:;
img-src 'self' data: blob:;
connect-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
```

- Hash SHA-256 dihitung dari isi setiap `<script>` inline; `scripts/generate-csp.mjs` menulis `public/_headers`.
- `'unsafe-eval'` diperlukan karena Vue global memakai runtime compiler. Ini batasan yang didokumentasikan; menghapusnya memerlukan precompiled render function dan menjadi pekerjaan terpisah.
- `style-src 'unsafe-inline'` diperlukan karena Vue menulis style dinamis; script tetap tanpa `'unsafe-inline'`.
- Halaman statis memakai `_headers`; respons Worker (API dan redirect) memakai middleware Hono dengan header dasar dan CSP API `default-src 'none'`.

### Verifikasi

`test/security-headers.test.js` menghitung hash dari HTML dan memastikan semuanya ada di `_headers`, serta memeriksa header respons API.

## 3. Audit akses berkas

Setelah `GET /api/files/:id` lolos autentikasi admin, tulis `audit_log`:

- `actor_email`: nama sesi admin.
- `aksi`: `FILE_ACCESS`.
- `target`: ID unggahan.
- `detail`: JSON `{ kind, pengajuanId, mime, size }` (tanpa isi berkas).
- `alasan`: `Akses berkas admin`.

Penulisan bersifat best-effort; kegagalan dicatat (`file_access_audit_failed`) dan tidak menggagalkan unduhan. Akses tanpa sesi tidak menulis audit agar tidak bisa dipakai membanjiri database.

## Rencana test

- TOTP: vektor RFC 6238, base32, jendela waktu, anti-replay.
- Recovery code: hash, verifikasi, sekali pakai.
- Login MFA: password salah, butuh kode, kode salah, kode benar, recovery code, replay.
- RPC MFA: status/setup/enable/disable dengan dan tanpa sesi.
- Header/CSP: hash inline script, header API, `_headers`.
- Audit berkas: akses berhasil menulis `FILE_ACCESS`; akses tanpa sesi tidak menulis.
- Suite penuh harus lulus.

## Rollout

- Migrasi `admin_mfa` + `sessions.admin_id` harus diterapkan bersama deploy.
- Setelah deploy: login admin, buka Keamanan, aktifkan MFA, simpan recovery code.
- Uji login dengan kode salah/benar di lingkungan non-produksi sebelum mengumumkan.
- Deploy menunggu R2 aktif karena config Worker masih memuat binding R2/Workflow.

## Risiko

- Kehilangan perangkat tanpa recovery code berarti akun tidak bisa MFA; admin lain masih bisa menonaktifkan lewat database jika diperlukan (prosedur darurat didokumentasikan).
- `'unsafe-eval'` menurunkan kekuatan CSP terhadap injeksi script; hash tetap mencegah `'unsafe-inline'`.
- Penulisan audit per akses berkas menambah baris `audit_log`; volume dipantau.
