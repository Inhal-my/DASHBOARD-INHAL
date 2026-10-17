# Observability dan Alert INHAL

Dokumen operasional untuk Poin 3. Desain lengkap: `docs/superpowers/specs/2026-10-17-observability-design.md`.

## Ringkasan

- **Workers Logs** aktif lewat `wrangler.toml` (`[observability]`), sampling 100%.
- **Workers Issues** (beta, gratis) aktif lewat `[observability.issues]` untuk mengelompokkan error produksi.
- **Log aplikasi** berupa JSON terstruktur dengan `requestId`, tanpa token/body/data pribadi.
- **Health check** `GET /api/health` memeriksa D1 dan mengembalikan 503 bila database gagal.
- **Alert** memakai Issues automation (email/webhook) dan monitor uptime eksternal ke endpoint health.

## Health check

```bash
curl -s -i https://inhal-form.prodi.workers.dev/api/health
```

Respons sehat:

```json
{"ok":true,"db":"ok","latencyMs":3,"ts":"2026-10-17T13:00:00.000Z"}
```

Respons gagal: HTTP 503

```json
{"ok":false,"db":"error","ts":"2026-10-17T13:00:00.000Z"}
```

- `Cache-Control: no-store`.
- Setiap respons memiliki header `x-request-id`; kirim header yang sama untuk menelusuri satu permintaan.
- Endpoint ini publik dan tidak menampilkan detail internal.

## Event log

Semua log berupa satu baris JSON. Field umum: `ts`, `level`, `event`, `requestId`.

| Event | Level | Arti |
|---|---|---|
| `http_request_failed` | error | Endpoint `/api/*` mengembalikan 5xx |
| `http_request_rejected` | warn | Endpoint mengembalikan 4xx |
| `unhandled_error` | error | Exception tak tertangani di Worker |
| `rpc_failed` | error | Exception tak terduga pada dispatcher RPC |
| `rpc_rejected` | warn | Penolakan autentikasi/otorisasi yang normal |
| `health_check_failed` | error | Query kesehatan D1 gagal |
| `audit_log_write_failed` | error | Gagal menulis `audit_log` |
| `upload_log_write_failed` | error | Gagal menulis `log_upload` |
| `admin_upload_log_write_failed` | error | Gagal menulis log unggah bukti admin |
| `master_biaya_read_failed` | error | Gagal membaca `master_biaya` |
| `biaya_override_read_failed` | error | Gagal membaca override biaya |
| `ba_options_read_failed` | error | Gagal menyiapkan opsi BA |
| `portal_upload_failed` | warn | Unggahan portal ditolak (kesalahan pengguna) |

Redaksi otomatis berlaku untuk kunci yang mengandung `token`, `password`, `secret`, `authorization`, `cookie`, `api_key`, atau `credential`.

## Melihat log dan issue

1. Buka Cloudflare Dashboard > **Workers & Pages** > Worker `inhal-form`.
2. Pilih **Observability** untuk mencari log berdasarkan `event`, `requestId`, `fn`, atau status.
3. Pilih **Issues** untuk melihat error yang dikelompokkan; buka satu issue untuk melihat stack dan permintaan terkait.

Atau lewat CLI:

```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler tail inhal-form --format json
```

Retensi: 3 hari (Workers Free) atau 7 hari (Workers Paid). Untuk investigasi lebih lama, simpan kutipan log ke tiket/insiden.

## Mengaktifkan alert

### 1. Issues automation

1. Dashboard > **Workers & Pages** > `inhal-form` > **Issues**.
2. Buka **Automations** dan buat automation baru.
3. Pilih pemicu issue baru atau issue berulang.
4. Tujuan: email admin dan/atau webhook (mis. Google Chat/Slack).
5. Simpan, lalu uji dengan memicu error terkendali di lingkungan non-produksi bila memungkinkan.

### 2. Monitor uptime

1. Buat monitor HTTP di layanan pilihan (mis. UptimeRobot).
2. URL: `https://inhal-form.prodi.workers.dev/api/health`.
3. Interval: 5 menit.
4. Anggap gagal bila status bukan 200 atau latency melewati ambang (mis. 5 detik).
5. Tujuan alert: email admin.
6. Simpan kontak penerima di SOP tim, bukan di repositori.

Monitor ini sekaligus mendeteksi gangguan D1 karena health check mengembalikan 503.

## Tindak lanjut alert

| Alert | Langkah awal |
|---|---|
| `health_check_failed` / uptime 503 | Cek status Cloudflare, lalu `wrangler d1 execute inhal-poc --remote --command "SELECT 1"`. Bila D1 bermasalah, ikuti `docs/ops/backup-restore.md`. |
| Issues: `rpc_failed` | Cari `requestId` di Workers Logs, lihat `fn` dan stack, reproduksi di lokal/staging. |
| `unhandled_error` | Cari `requestId`, periksa route dan stack; tambahkan test regresi sebelum memperbaiki. |
| Lonjakan `http_request_rejected` | Periksa apakah ada klien/automation yang salah; jangan perlakukan sebagai error server. |
| `audit_log_write_failed` / `upload_log_write_failed` | Periksa kapasitas/health D1 dan constraint tabel; operasi utama mungkin sudah berhasil. |
| `portal_upload_failed` | Biasanya validasi pengguna; periksa `message` dan ukuran berkas. |

Saat melaporkan insiden, sertakan: waktu (UTC), `requestId`, `event`, endpoint, status, dan kutipan log JSON.

## Deploy

Observability baru aktif setelah deploy Worker. Deploy Poin 3 digabung dengan deploy Poin 2 dan menunggu R2 aktif, karena `wrangler.toml` sudah memuat binding R2/Workflow. Setelah R2 aktif:

```bash
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy
```

Lalu verifikasi:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://inhal-form.prodi.workers.dev/api/health
```

## Batasan

- Workers Logs bukan penyimpanan jangka panjang.
- Belum ada tracing terdistribusi atau metrik bisnis.
- Automation Issues dan monitor uptime dikonfigurasi manual di dashboard, bukan dari repositori.
- Alert email/webhook bergantung pada layanan yang dipilih admin.
