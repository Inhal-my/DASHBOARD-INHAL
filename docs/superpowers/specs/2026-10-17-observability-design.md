# Desain Observability INHAL (Poin 3)

Tanggal: 2026-10-17
Status: implementasi selesai dan teruji lokal; deploy produksi menunggu aktivasi R2.

## Tujuan

Membuat kegagalan produksi terdeteksi dan bisa ditelusuri tanpa menambah SDK pihak ketiga:

1. Error tracking terstruktur untuk RPC, unggahan, dan error tak tertangani.
2. Alert untuk error berulang dan health check yang gagal.
3. Pemantauan kesehatan aplikasi dan database.

## Non-goals

- APM/tracing distribusi penuh dan metrik bisnis.
- Penyimpanan log jangka panjang (Workers Logs hanya 3 hari untuk Free, 7 hari untuk Paid).
- Pengiriman alert lewat layanan berbayar baru atau integrasi Sentry.
- Pengganti backup D1 (tetap Poin 2).

## Audit kondisi awal

- `GET /api/health` selalu mengembalikan `{ ok: true }` tanpa memeriksa D1, sehingga database bermasalah tidak terdeteksi.
- Error RPC hanya dicatat sebagai teks bebas (`console.error`) tanpa ID permintaan, fungsi, atau durasi.
- Beberapa kegagalan non-fatal (audit log, log unggah, opsi BA, master biaya) juga hanya berupa teks bebas.
- Tidak ada `[observability]` di `wrangler.toml`, sehingga Workers Logs tidak dijamin aktif.
- Error tak tertangani mengandalkan handler bawaan Hono; tidak ada log terstruktur atau respons JSON yang konsisten.
- Cloudflare Issues (beta, gratis) membutuhkan Wrangler >= 4.134.0; proyek masih memakai 4.130.0.
- Cloudflare Notifications tidak menyediakan alert khusus Workers untuk akun ini; jalur yang tersedia adalah Issues automations dan monitor eksternal untuk uptime.

## Arsitektur

### 1. Log terstruktur

Modul baru `src/obs/log.js`:

- `logEvent(level, event, fields)` menulis satu baris JSON ke `console`.
- `logError(event, err, fields)` membungkus error menjadi `{ message, stack }` yang dipotong.
- Redaksi otomatis untuk kunci yang mengandung `token`, `password`, `secret`, `authorization`, `cookie`, `api_key`, `credential`.
- Kedalaman objek dibatasi, string panjang dipotong, circular reference diberi penanda.

Field standar: `ts`, `level`, `event`, `requestId`, `method`, `path`, `status`, `durationMs`.
Tidak pernah mencatat body permintaan, token sesi, isi berkas, atau data pribadi.

Event yang dipakai:

| Event | Level | Kapan |
|---|---|---|
| `http_request_failed` | error | Permintaan `/api/*` selesai dengan status >= 500 |
| `http_request_rejected` | warn | Permintaan `/api/*` selesai dengan status 4xx |
| `unhandled_error` | error | Hono `onError` |
| `rpc_failed` | error | `dispatchRpc` menangkap exception tak terduga |
| `rpc_rejected` | warn | Penolakan autentikasi/otorisasi yang memang diharapkan |
| `health_check_failed` | error | Query kesehatan D1 gagal |
| `audit_log_write_failed` / `upload_log_write_failed` | error | Penulisan log audit/unggah gagal |
| `master_biaya_read_failed` / `biaya_override_read_failed` | error | Fallback pembacaan master |
| `ba_options_read_failed` | error | Fallback opsi BA |
| `admin_upload_log_write_failed` | error | Log unggah bukti admin gagal |
| `portal_upload_failed` | warn | Unggahan portal ditolak (kesalahan pengguna) |

### 2. Request ID

Middleware `/api/*`:

- Memakai header `x-request-id` bila ada, atau `crypto.randomUUID()`.
- Menyimpan ID di context Hono dan mengembalikannya pada header respons.
- Menambahkan `requestId` pada respons error RPC agar laporan pengguna bisa dicocokkan dengan log.

### 3. Health check

`GET /api/health`:

- Menjalankan `SELECT 1` ke D1.
- Sukses: HTTP 200 `{ ok: true, db: "ok", latencyMs, ts }`.
- Gagal: HTTP 503 `{ ok: false, db: "error", ts }` dan log `health_check_failed`.
- `Cache-Control: no-store`.

Endpoint tetap publik dan tidak membocorkan detail internal.

### 4. Error tak tertangani

`app.onError` mencatat `unhandled_error` (dengan `requestId`, method, path) dan mengembalikan JSON generik HTTP 500.

### 5. Aktivasi platform

`wrangler.toml`:

```toml
[observability]
enabled = true
head_sampling_rate = 1

[observability.issues]
enabled = true
```

Wrangler dinaikkan ke versi yang mendukung Issues (>= 4.134.0). Sampling 100% karena trafik aplikasi kecil.

### 6. Alert dan pemantauan

- **Error berulang:** Cloudflare Issues automations (beta, gratis) dikonfigurasi di dashboard untuk mengirim email atau webhook saat issue baru/berulang. Konfigurasi akun ini dicatat sebagai langkah manual.
- **Uptime:** monitor eksternal (mis. UptimeRobot) memanggil `https://inhal-form.prodi.workers.dev/api/health` setiap 5 menit; alert bila status bukan 200 atau latency melewati ambang.
- **Database:** health check mengembalikan 503 saat D1 tidak bisa di-query, sehingga monitor uptime sekaligus mendeteksi gangguan database.
- **Backup:** kegagalan Workflow backup tetap terlihat lewat Workers Logs/Issues dan objek `status/last-failure.json` di R2.

Retensi log mengikuti paket Cloudflare (3/7 hari). Untuk investigasi lebih lama, gunakan ekspor log manual atau Time Travel D1; arsip log jangka panjang bukan bagian Poin 3.

## Rencana test

- `test/obs-log.test.js`: format JSON, level, redaksi token/password, pemotongan string, circular reference.
- `test/api.test.js`: health sehat (200, `db: ok`), health gagal (503, `db: error`), header `x-request-id`.
- `test/rpc.test.js`: error RPC tetap aman, log `rpc_failed` terstruktur, `requestId` diteruskan.
- Suite penuh harus tetap lulus.

## Rollout

1. Implementasi kode dan test; jalankan suite penuh.
2. Validasi `wrangler deploy --dry-run`.
3. Deploy produksi digabung dengan Poin 2 setelah R2 aktif, karena `wrangler.toml` sudah memuat binding R2/Workflow yang belum bisa dipakai.
4. Setelah deploy: aktifkan automation Issues dan monitor uptime; verifikasi log `http_request`/`health_check_failed` di dashboard.

## Risiko

- Naik versi Wrangler berpotensi mengubah perilaku test; dikunci dengan suite penuh.
- Volume log bertambah untuk setiap respons 4xx/5xx; permintaan sukses tetap tercakup invocation log bawaan Workers Logs tanpa baris tambahan.
- Monitor uptime eksternal bergantung pada layanan pihak ketiga; alternatifnya cek manual atau Issues automation.
