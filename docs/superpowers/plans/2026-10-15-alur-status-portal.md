# Alur Status Pengajuan & Portal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti model status `Menunggu/Diterima/ACC/Ditolak/Dibatalkan` menjadi `Menunggu/ACC/Ditolak/Dibatalkan`, membuat transisi ke `ACC` menerbitkan nomor surat sekaligus mengirim PDF final ke mahasiswa & Bagian, menjadikan `Ditolak`/`Dibatalkan` sepenuhnya portal-only, dan menyederhanakan portal agar setelah ACC hanya mengunggah bukti bayar.

**Architecture:** Worker Cloudflare (Hono + D1). Perubahan terpusat di lapisan tulis status (`src/write/pengajuanAdmin.js`), email (`src/write/email.js`), portal (`src/portal.js`), konfigurasi status (`src/read/common.js`, `src/pengajuan.js`), lalu UI (`public/dashboard.html`, `public/portal.html`). Migrasi DB aditif/idempotent menormalkan `Diterima` → `ACC`.

**Tech Stack:** JavaScript ESM, Cloudflare Workers + D1 (SQLite), Vitest (`@cloudflare/vitest-pool-workers`), Vue 3 (CDN, opsi API) di `public/*.html`, pdf-lib.

## Global Constraints

- Status valid sistem: `Menunggu`, `ACC`, `Ditolak`, `Dibatalkan`. **`Diterima` dihapus total** dari kode, validasi, default, dropdown, dan hitungan.
- Transisi ke `ACC` dilakukan lewat tombol **Perbarui Status** (bukan otomatis dari event lain). Terbit nomor surat (bila belum ada) + kirim PDF `link_final` + email ke mahasiswa **dan** Bagian. **Hanya** saat transisi (status sebelumnya ≠ `ACC`); simpan ulang ACC tidak mengirim lagi.
- `Ditolak` dan `Dibatalkan`: **portal-only, tanpa email, tanpa PDF, tanpa unduhan**. `catatan` **wajib** diisi.
- `link_acc_inhal` dihentikan penggunaanya di alur baru. `link_final` = PDF ACC resmi. Guard lama `link_acc_inhal` dihapus.
- Portal: setelah status `ACC`, mahasiswa hanya mengunggah **1 berkas bukti bayar** (ACC INHAL tidak lagi). Status ≠ `ACC` → tolak unggah.
- Baris `sumber='Manual'`: status awal tetap `Menunggu`; admin boleh set `ACC` via Perbarui Status (tanpa kirim surat/nomor/email khusus manual — perilaku sama seperti tombol biasa).
- Kolom DB lama (`status_notifikasi_email`, `error_notifikasi_email`) **tidak dihapus**, hanya tidak dipakai/ditampilkan lagi.
- Migrasi DB wajib **idempotent** dan **aditif/UPDATE saja** (tanpa DROP/DELETE tabel). Jangan menimpa data produksi yang sedang berjalan.
- Perintah tes: `npm test` (Vitest). Semua tes lama harus tetap hijau.
- Deploy: `npx wrangler deploy` (lihat bagian akhir). Jangan deploy sampai seluruh task selesai & suite hijau.

---

## File Structure

- `migrations/2026-10-15-status-normalize-diterima-acc.sql` — **Create.** Normalisasi data `Diterima` → `ACC`.
- `test/migration-status-normalize-diterima-acc.test.js` — **Create.** Uji migrasi.
- `src/read/common.js` — **Modify.** Default `getBagianBaStatuses` → `['ACC']`.
- `src/pengajuan.js` — **Modify.** `MANUAL_STATUSES` → `['Menunggu']`.
- `src/write/pengajuanAdmin.js` — **Modify.** `STATUS_VALID`, `updatePengajuanStatus`, `resetUploadBukti`.
- `src/write/master.js` — **Modify.** `STATUS_VALID` (hapus `Diterima`).
- `src/write/email.js` — **Modify.** Hapus guard `link_acc_inhal`, hapus jalur notifikasi status.
- `src/read/dashboard.js` — **Modify.** `getUploadMonitor` query `status = 'ACC'`.
- `src/read/kegiatan.js` — **Modify.** `computeUnitProgress` tanpa `Diterima`.
- `src/rpc.js` — **Modify.** Hapus handler `sendStatusNotificationEmail`.
- `src/portal.js` — **Modify.** `uploadBuktiFiles` (bukti-only + gate ACC), `getStudentPortalData` `hasUpload`.
- `public/dashboard.html` — **Modify.** Dropdown/quick action status, hapus UI notifikasi email lama, default status, validasi catatan, hitungan status.
- `public/portal.html` — **Modify.** `mapStatusCode`, form unggah 1 berkas, gating langkah ACC.

---

### Task 1: Migrasi normalisasi status `Diterima` → `ACC`

**Files:**
- Create: `migrations/2026-10-15-status-normalize-diterima-acc.sql`
- Test: `test/migration-status-normalize-diterima-acc.test.js`

**Interfaces:**
- Consumes: skema `pengajuan(status)`, `status_history(status)`, `config(key,value)`.
- Produces: tidak ada fungsi; hanya data yang ternormalisasi.

- [ ] **Step 1: Write the failing test**

```js
// test/migration-status-normalize-diterima-acc.test.js
import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import migrationSql from '../migrations/2026-10-15-status-normalize-diterima-acc.sql?raw';

const statements = String(migrationSql)
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.replace(/--[^\n]*/g, '').trim());

async function applyMigration() {
  for (const stmt of statements) await env.DB.prepare(stmt).run();
}

describe('migrasi normalisasi Diterima -> ACC', () => {
  it('mengubah status pengajuan dan status_history Diterima menjadi ACC', async () => {
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-10-01T08:00:00','INHAL-1','1001','A','A','SGD','Diterima')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-10-01T08:00:00','INHAL-2','1002','B','A','SGD','ACC')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO status_history (timestamp,id_pengajuan,status,catatan,actor_email) VALUES ('2026-10-01T08:00:00','INHAL-1','Diterima','','Admin')"
    ).run();

    await applyMigration();

    const p1 = await env.DB.prepare("SELECT status FROM pengajuan WHERE id_pengajuan='INHAL-1'").first();
    const p2 = await env.DB.prepare("SELECT status FROM pengajuan WHERE id_pengajuan='INHAL-2'").first();
    const h1 = await env.DB.prepare("SELECT status FROM status_history WHERE id_pengajuan='INHAL-1'").first();
    expect(p1.status).toBe('ACC');
    expect(p2.status).toBe('ACC');
    expect(h1.status).toBe('ACC');
  });

  it('menormalkan nilai config BAGIAN_BA_STATUSES yang memuat Diterima', async () => {
    await env.DB.prepare("INSERT INTO config (key,value) VALUES ('BAGIAN_BA_STATUSES','Diterima,ACC')").run();
    await applyMigration();
    const row = await env.DB.prepare("SELECT value FROM config WHERE key='BAGIAN_BA_STATUSES'").first();
    expect(row.value).toBe('ACC');
  });

  it('idempotent saat dijalankan dua kali', async () => {
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status) VALUES ('2026-10-01T08:00:00','INHAL-9','1009','X','A','SGD','Diterima')"
    ).run();
    await applyMigration();
    await applyMigration();
    const row = await env.DB.prepare("SELECT status FROM pengajuan WHERE id_pengajuan='INHAL-9'").first();
    expect(row.status).toBe('ACC');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/migration-status-normalize-diterima-acc.test.js`
Expected: FAIL — `Cannot find module '../migrations/2026-10-15-status-normalize-diterima-acc.sql?raw'`.

- [ ] **Step 3: Write the migration**

```sql
-- migrations/2026-10-15-status-normalize-diterima-acc.sql
-- Status "Diterima" dihapus dari sistem; digantikan oleh "ACC".
UPDATE pengajuan SET status = 'ACC' WHERE status = 'Diterima';

UPDATE status_history SET status = 'ACC' WHERE status = 'Diterima';

UPDATE config SET value = 'ACC'
  WHERE key = 'BAGIAN_BA_STATUSES' AND value = 'Diterima';

UPDATE config SET value = trim(replace(value, 'Diterima,', ''))
  WHERE key = 'BAGIAN_BA_STATUSES' AND value LIKE 'Diterima,%';

UPDATE config SET value = trim(replace(value, ',Diterima', ''))
  WHERE key = 'BAGIAN_BA_STATUSES' AND value LIKE '%,Diterima';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/migration-status-normalize-diterima-acc.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add migrations/2026-10-15-status-normalize-diterima-acc.sql test/migration-status-normalize-diterima-acc.test.js
git commit -m "feat(status): migrate Diterima to ACC idempotently"
```

---

### Task 2: Ringkas konstanta & default status (hapus `Diterima`)

**Files:**
- Modify: `src/write/pengajuanAdmin.js:7`
- Modify: `src/write/master.js:4`
- Modify: `src/pengajuan.js:17`
- Modify: `src/read/common.js:212-218`
- Modify: `src/read/dashboard.js:373`
- Modify: `src/read/kegiatan.js:19`
- Test: `test/read-common.test.js`, `test/read-kegiatan-progress.test.js`, `test/write-master.test.js`, `test/read-dashboard.test.js`

**Interfaces:**
- Produces: `getBagianBaStatuses(db)` mengembalikan `['ACC']` sebagai default; `STATUS_VALID = ['Menunggu','ACC','Ditolak','Dibatalkan']`.

- [ ] **Step 1: Write the failing tests**

Tambahkan ke `test/read-common.test.js`:

```js
describe('default status BA Bagian', () => {
  it('memakai ACC sebagai satu-satunya status default', async () => {
    const { getBagianBaStatuses } = await import('../src/read/common.js');
    const list = await getBagianBaStatuses(env.DB);
    expect(list).toEqual(['ACC']);
  });
});
```

Ubah ekspektasi lama di `test/write-master.test.js:151-154` menjadi:

```js
    const ok = await saveBagianBaSettings(env.DB, { statuses: ['ACC', 'Menunggu', 'ACC'], finalOnly: false }, ctx);
    expect(ok.success).toBe(true);
    const row = await env.DB.prepare("SELECT value FROM config WHERE key = 'BAGIAN_BA_STATUSES'").first();
    expect(row.value).toBe('ACC,Menunggu');
```

Dan pada `test/write-master.test.js:147-148`, tambahkan sebelum baris `bad`:

```js
    const legacy = await saveBagianBaSettings(env.DB, { statuses: ['ACC', 'Diterima'], finalOnly: true }, ctx);
    expect(legacy.success).toBe(false);
    expect(legacy.message).toContain('Diterima');
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/read-common.test.js test/write-master.test.js`
Expected: FAIL — default masih `['Diterima','ACC']`; `Diterima` masih dianggap valid.

- [ ] **Step 3: Implement**

`src/read/common.js` (ganti isi `getBagianBaStatuses`):

```js
export async function getBagianBaStatuses(db) {
  const raw = await configValue(db, 'BAGIAN_BA_STATUSES', '');
  const def = ['ACC'];
  if (!raw) return def;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : def;
}
```

`src/write/pengajuanAdmin.js:7`:

```js
const STATUS_VALID = ['Menunggu', 'ACC', 'Ditolak', 'Dibatalkan'];
```

`src/write/master.js:4`:

```js
const STATUS_VALID = ['Menunggu', 'ACC', 'Ditolak', 'Dibatalkan'];
```

`src/pengajuan.js:17`:

```js
const MANUAL_STATUSES = ['Menunggu'];
```

`src/read/dashboard.js:373` (ubah query):

```js
  const rows = (await db.prepare("SELECT * FROM pengajuan WHERE status = 'ACC' ORDER BY id DESC").all()).results || [];
```

`src/read/kegiatan.js:19` (ubah predikat):

```js
    return s === 'ACC' || s === 'Ditolak';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/read-common.test.js test/write-master.test.js test/read-kegiatan-progress.test.js test/read-dashboard.test.js`
Expected: PASS. (Jika ada tes lain yang menyebut `Diterima`, catat dan perbaiki di Step 5.)

- [ ] **Step 5: Bersihkan sisa referensi `Diterima` di sumber non-UI**

Run: `rg -n "Diterima" src/`
Expected: tidak ada hasil. Jika tersisa (mis. komentar/konstanta lain), hapus/ganti dengan `ACC` seperlunya tanpa mengubah perilaku lain.

- [ ] **Step 6: Commit**

```bash
git add src/read/common.js src/write/pengajuanAdmin.js src/write/master.js src/pengajuan.js src/read/dashboard.js src/read/kegiatan.js test/read-common.test.js test/write-master.test.js
git commit -m "feat(status): drop Diterima from status constants and defaults"
```

---

### Task 3: Transisi `ACC` menerbitkan nomor surat + kirim PDF final; `Ditolak`/`Dibatalkan` wajib catatan

**Files:**
- Modify: `src/write/pengajuanAdmin.js:1-3, 215-284`
- Test: `test/write-pengajuan-admin.test.js`

**Interfaces:**
- Consumes: `sendFinalPdfEmails(db, idPengajuan, env, actor)` dari `src/write/email.js` (Task 4 memperbaiki guard-nya). Return: `{ ok, pdfUrl, studentEmailSent, bagianEmailSent, bagianEmail, bagianName, notes }`.
- Produces: `updatePengajuanStatus(db, id, newStatus, catatan, actorEmail, ctx)` mengembalikan `{ success, idPengajuan, nomorSurat, notification?, message }`.

- [ ] **Step 1: Write the failing tests**

Ganti blok `describe('pengajuan admin status and delete', ...)` bagian status di `test/write-pengajuan-admin.test.js` dengan skenario berikut (pertahankan tes delete apa adanya):

```js
describe('pengajuan admin status transitions', () => {
  it('menolak status tak dikenal', async () => {
    await seedPengajuan();
    const ctx = await adminCtx();
    const bad = await updatePengajuanStatus(env.DB, 'INHAL-1', 'Diterima', '', '', ctx);
    expect(bad.success).toBe(false);
  });

  it('ACC menerbitkan nomor surat dan mencatat history', async () => {
    await seedPengajuan();
    const ctx = await adminCtx();
    const ok = await updatePengajuanStatus(env.DB, 'INHAL-1', 'ACC', 'Berkas lengkap', '', ctx);
    expect(ok.success).toBe(true);
    expect(ok.nomorSurat).toMatch(/^\d{3}\/INHAL\/FKIK-UMSU\/[IVX]+\/\d{4}$/);
    const row = await env.DB.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.status).toBe('ACC');
    expect(row.nomor_surat).toBe(ok.nomorSurat);
    const hist = await env.DB.prepare('SELECT * FROM status_history WHERE id_pengajuan = ?1').bind('INHAL-1').all();
    expect(hist.results.map((r) => r.status)).toEqual(['ACC']);
  });

  it('tidak menerbitkan nomor baru saat ACC disimpan ulang', async () => {
    await seedPengajuan();
    const ctx = await adminCtx();
    const first = await updatePengajuanStatus(env.DB, 'INHAL-1', 'ACC', '', '', ctx);
    const second = await updatePengajuanStatus(env.DB, 'INHAL-1', 'ACC', '', '', ctx);
    expect(second.nomorSurat).toBe(first.nomorSurat);
  });

  it('menerbitkan nomor berurutan untuk dua pengajuan', async () => {
    await seedPengajuan();
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,email,no_hp_wa,blok,jenis_kegiatan,status) VALUES ('2026-09-10T08:00:00','INHAL-2','2201010002','Budi','budi@contoh.com','0813','A','SGD','Menunggu')"
    ).run();
    const ctx = await adminCtx();
    const first = await updatePengajuanStatus(env.DB, 'INHAL-1', 'ACC', '', '', ctx);
    const second = await updatePengajuanStatus(env.DB, 'INHAL-2', 'ACC', '', '', ctx);
    const numbers = [first.nomorSurat, second.nomorSurat].map((s) => parseInt(s.slice(0, 3), 10)).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2]);
  });

  it('menolak Ditolak/Dibatalkan tanpa catatan', async () => {
    await seedPengajuan();
    const ctx = await adminCtx();
    const noNote = await updatePengajuanStatus(env.DB, 'INHAL-1', 'Ditolak', '', '', ctx);
    expect(noNote.success).toBe(false);
    expect(noNote.message).toMatch(/[Cc]atatan/);
    const ok = await updatePengajuanStatus(env.DB, 'INHAL-1', 'Ditolak', 'Berkas tidak lengkap', '', ctx);
    expect(ok.success).toBe(true);
    const row = await env.DB.prepare('SELECT status, catatan_admin FROM pengajuan WHERE id_pengajuan = ?1').bind('INHAL-1').first();
    expect(row.status).toBe('Ditolak');
    expect(row.catatan_admin).toBe('Berkas tidak lengkap');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/write-pengajuan-admin.test.js`
Expected: FAIL — status `Diterima` masih diterima; `Ditolak` tanpa catatan belum ditolak.

- [ ] **Step 3: Implement**

`src/write/pengajuanAdmin.js` — ganti baris import `processStatusNotification` (baris 3) menjadi:

```js
import { sendFinalPdfEmails } from './email.js';
```

Ganti seluruh fungsi `updatePengajuanStatus` (baris 215-284) dengan:

```js
export async function updatePengajuanStatus(db, idPengajuan, newStatus, catatan, actorEmail, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const id = str(idPengajuan);
  const status = str(newStatus);
  if (STATUS_VALID.indexOf(status) === -1) {
    return { success: false, message: 'Status tidak valid: ' + status };
  }
  if (!id) return { success: false, message: 'ID Pengajuan wajib diisi.' };

  const existing = await db.prepare('SELECT * FROM pengajuan WHERE id_pengajuan = ?1').bind(id).first();
  if (!existing) return { success: false, message: 'Pengajuan tidak ditemukan.' };

  const catatanVal = str(catatan);
  if ((status === 'Ditolak' || status === 'Dibatalkan') && !catatanVal) {
    return { success: false, message: 'Catatan wajib diisi untuk status ' + status + '.' };
  }

  const prevStatus = str(existing.status);
  const ts = nowIso();
  let nomorSurat = str(existing.nomor_surat);
  const sets = ['status = ?1', 'updated_at = ?2'];
  const vals = [status, ts];
  if (catatanVal !== '') { sets.push('catatan_admin = ?' + (vals.length + 1)); vals.push(catatanVal); }
  const claimNumber = status === 'ACC' && !nomorSurat;
  if (claimNumber) {
    nomorSurat = await nextSuratNumberYearly(db, 'INHAL');
    sets.push('nomor_surat = ?' + (vals.length + 1));
    vals.push(nomorSurat);
  }
  const actor = str(actorEmail) || str(ctx.session && ctx.session.nama) || 'Admin';
  const updateSql = 'UPDATE pengajuan SET ' + sets.join(', ') + ' WHERE id_pengajuan = ?' + (vals.length + 1)
    + (claimNumber ? " AND (nomor_surat IS NULL OR nomor_surat = '')" : '');
  const historyStmt = claimNumber
    ? db.prepare(
      'INSERT INTO status_history (timestamp, id_pengajuan, status, catatan, actor_email) ' +
      'SELECT ?1, ?2, ?3, ?4, ?5 WHERE EXISTS (SELECT 1 FROM pengajuan WHERE id_pengajuan = ?2 AND nomor_surat = ?6)'
    ).bind(ts, id, status, catatanVal, actor, nomorSurat)
    : db.prepare(
      'INSERT INTO status_history (timestamp, id_pengajuan, status, catatan, actor_email) VALUES (?1, ?2, ?3, ?4, ?5)'
    ).bind(ts, id, status, catatanVal, actor);
  await db.batch([db.prepare(updateSql).bind(...vals, id), historyStmt]);

  if (claimNumber) {
    const after = await db.prepare('SELECT nomor_surat FROM pengajuan WHERE id_pengajuan = ?1').bind(id).first();
    if (str(after && after.nomor_surat) !== nomorSurat) {
      return {
        success: false,
        idPengajuan: id,
        nomorSurat: str(after && after.nomor_surat),
        message: 'Pengajuan ini sudah diproses admin lain (nomor surat sudah terbit).'
      };
    }
  }

  let notification = null;
  const transitionToAcc = status === 'ACC' && prevStatus !== 'ACC';
  if (transitionToAcc) {
    try {
      const final = await sendFinalPdfEmails(db, id, ctx.env, actor);
      notification = final.ok
        ? { ok: true, pdfUrl: final.pdfUrl }
        : { ok: false, error: (final.notes && final.notes.join(' ')) || 'Gagal mengirim email final.' };
    } catch (e) {
      notification = { ok: false, error: (e && e.message) ? e.message : String(e) };
    }
  }

  const baseMessage = 'Status diperbarui menjadi ' + status + '.';
  if (notification) {
    return {
      success: true,
      idPengajuan: id,
      nomorSurat: nomorSurat,
      notification: notification,
      message: baseMessage + (notification.ok ? ' Surat ACC final terkirim.' : ' Pengiriman surat ACC final gagal: ' + notification.error)
    };
  }
  return { success: true, idPengajuan: id, nomorSurat: nomorSurat, message: baseMessage };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/write-pengajuan-admin.test.js`
Expected: PASS. (Bridge gagal di lingkungan tes tanpa `fetch` — `notification.ok` false, tetapi status/nomor tetap benar.)

- [ ] **Step 5: Commit**

```bash
git add src/write/pengajuanAdmin.js test/write-pengajuan-admin.test.js
git commit -m "feat(status): ACC transition issues nomor surat and sends final PDF"
```

---

### Task 4: `email.js` — hapus guard `link_acc_inhal`, pensiunkan jalur notifikasi status

**Files:**
- Modify: `src/write/email.js:114-166, 168-185`
- Modify: `src/rpc.js` (handler `sendStatusNotificationEmail`)
- Test: `test/write-email.test.js`

**Interfaces:**
- Produces: `sendFinalPdfEmails` tidak lagi memerlukan `link_acc_inhal`; `sendStatusNotificationEmail` dan `processStatusNotification` dihapus.
- `buildEnhanced(pengajuan, details, status)` tetap tersedia (dipakai tes & final).

- [ ] **Step 1: Write the failing test**

Di `test/write-email.test.js`, tambahkan:

```js
import { sendFinalPdfEmails } from '../src/write/email.js';

describe('sendFinalPdfEmails tanpa link_acc_inhal', () => {
  it('tidak menolak hanya karena ACC INHAL kosong', async () => {
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,email,blok,jenis_kegiatan,status) VALUES ('2026-10-01T08:00:00','INHAL-1','1001','Aisyah','a@x.id','A','SGD','ACC')"
    ).run();
    const res = await sendFinalPdfEmails(env.DB, 'INHAL-1', {}, 'Admin');
    const joined = (res.notes || []).join(' ');
    expect(joined).not.toContain('ACC INHAL');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/write-email.test.js`
Expected: FAIL — notes memuat `"Berkas ACC INHAL belum diunggah..."`.

- [ ] **Step 3: Implement**

Di `src/write/email.js` **hapus** fungsi `updateNotifikasiColumns` (114-118), `processStatusNotification` (126-152), dan `sendStatusNotificationEmail` (154-166).

Di `sendFinalPdfEmails`, **hapus blok guard** (baris 173 `const accInhal = ...` dan blok `if (!accInhal) { ... }` baris 179-185). Sisakan mulai dari `const bagian = await resolveBagianEmail(...)`.

Hasil bagian awal fungsi menjadi:

```js
export async function sendFinalPdfEmails(db, idPengajuan, env, actor) {
  const pengajuan = await getPengajuan(db, idPengajuan);
  if (!pengajuan) return { ok: false, pdfUrl: '', studentEmailSent: false, bagianEmailSent: false, bagianEmail: '', bagianName: '', notes: ['Pengajuan tidak ditemukan.'] };

  const details = await getDetailRows(db, idPengajuan);
  const bagian = await resolveBagianEmail(db, pengajuan, details);
  const nama = str(pengajuan.nama_lengkap);
  const npm = str(pengajuan.npm);
  const studentEmail = str(pengajuan.email);

  if (str(pengajuan.status) !== 'ACC') {
    // tetap set ACC bila dipanggil dari tombol kirim ulang
    await db.prepare('UPDATE pengajuan SET status = ?1, updated_at = ?2 WHERE id_pengajuan = ?3')
      .bind('ACC', nowIso(), str(idPengajuan)).run();
    await db.prepare('INSERT INTO status_history (timestamp, id_pengajuan, status, catatan, actor_email) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(nowIso(), str(idPengajuan), 'ACC', '', str(actor) || str(env && env.actor) || 'Admin').run();
    pengajuan.status = 'ACC';
  }
  // ... lanjutkan seperti semula (buildEnhanced -> callDriveBridge -> update link_final)
```

Di `src/rpc.js`, hapus entri `sendStatusNotificationEmail` dari `HANDLERS`. Cari dengan:
Run: `rg -n "sendStatusNotificationEmail" src/rpc.js`
Lalu hapus baris handler tersebut beserta importnya bila tidak terpakai.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/write-email.test.js test/rpc.test.js`
Expected: PASS.

- [ ] **Step 5: Verifikasi tidak ada sisa pemakaian**

Run: `rg -n "sendStatusNotificationEmail|processStatusNotification" src/`
Expected: tidak ada hasil.

- [ ] **Step 6: Commit**

```bash
git add src/write/email.js src/rpc.js test/write-email.test.js
git commit -m "refactor(email): drop link_acc_inhal guard and status notification path"
```

---

### Task 5: Portal — unggah hanya bukti bayar & gate `ACC`

**Files:**
- Modify: `src/portal.js:35-94, 126, 138`
- Test: `test/portal-upload.test.js`

**Interfaces:**
- Produces: `uploadBuktiFiles` menerima `{ idPengajuan, npm, buktiFile }` saja; menolak bila status bukan `ACC`; mengembalikan `{ success, message, linkBukti }`.
- `getStudentPortalData` mengembalikan `hasUpload` berdasarkan `link_bukti_bayar`.

- [ ] **Step 1: Write the failing tests**

Ganti/tambahkan di `test/portal-upload.test.js`:

```js
describe('portal upload bukti-only', () => {
  async function seed(status, withBukti = '') {
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,email,blok,jenis_kegiatan,status,link_bukti_bayar) VALUES ('2026-10-01T08:00:00','INHAL-1','1001','Aisyah','a@x.id','A','SGD',?1,?2)"
    ).bind(status, withBukti).run();
  }

  it('menolak unggah saat status bukan ACC', async () => {
    await seed('Menunggu');
    const res = await uploadBuktiFiles(env.DB, { idPengajuan: 'INHAL-1', npm: '1001', buktiFile: { data: btoa('%PDF-1.4'), name: 'b.pdf' } }, {});
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/ACC/);
  });

  it('menerima unggah bukti tanpa file ACC', async () => {
    await seed('ACC');
    // stub Drive upload agar tidak memanggil jaringan
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true, url: 'https://drive/b', name: 'b.pdf' }), { status: 200, headers: { 'content-type': 'application/json' } })));
    const res = await uploadBuktiFiles(env.DB, { idPengajuan: 'INHAL-1', npm: '1001', buktiFile: { data: btoa('%PDF-1.4'), name: 'b.pdf' } }, {});
    expect(res.success).toBe(true);
    const row = await env.DB.prepare("SELECT link_bukti_bayar FROM pengajuan WHERE id_pengajuan='INHAL-1'").first();
    expect(row.link_bukti_bayar).toBe('https://drive/b');
    vi.unstubAllGlobals();
  });
});
```

Pastikan import `uploadBuktiFiles` dan `vi` tersedia di file tes.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/portal-upload.test.js`
Expected: FAIL — masih mewajibkan dua berkas; belum ada gate ACC.

- [ ] **Step 3: Implement**

Ganti seluruh fungsi `uploadBuktiFiles` (`src/portal.js:35-94`) dengan:

```js
export async function uploadBuktiFiles(db, payload, env) {
  const idPengajuan = str(payload && payload.idPengajuan);
  if (!idPengajuan) return { success: false, message: 'ID Pengajuan tidak tersedia.' };
  const existing = await db.prepare('SELECT id, npm, nama_lengkap, blok, jenis_kegiatan, status, link_bukti_bayar FROM pengajuan WHERE id_pengajuan = ?1').bind(idPengajuan).first();
  if (!existing) return { success: false, message: 'Pengajuan tidak ditemukan.' };

  const ownerNpm = normalizeNpm(existing.npm);
  const payloadNpm = normalizeNpm(payload && payload.npm);
  if (!ownerNpm || payloadNpm !== ownerNpm) {
    return { success: false, message: 'NPM tidak cocok dengan pengajuan ini.' };
  }

  if (str(existing.status) !== 'ACC') {
    return { success: false, message: 'Unggah bukti bayar hanya tersedia setelah pengajuan ACC.' };
  }

  const hasBukti = !!(payload && payload.buktiFile && payload.buktiFile.data);
  if (!hasBukti) {
    return { success: false, message: 'Tidak ada file bukti bayar yang diunggah.' };
  }

  const bukti = parseFileInput(payload && payload.buktiFile);
  const buktiMode = await getBuktiMode(db);
  if (bukti && buktiMode === 'strict' && !startsWithPdf(bukti.data)) {
    return { success: false, message: 'Maaf, bukti bayar bukan PDF portal. Gunakan PDF asli.' };
  }

  const upBukti = await saveDriveFile(env, payload.buktiFile, 'bukti-' + idPengajuan, { allowedMime: PORTAL_MIME, maxBytes: PORTAL_MAX_BYTES, label: 'bukti bayar' });
  if (!upBukti.ok) return { success: false, message: upBukti.message };

  const buktiUrl = upBukti.url || str(existing.link_bukti_bayar);

  await db.prepare("UPDATE pengajuan SET link_bukti_bayar = ?1, upload_reset_at = '', upload_reset_by = '', upload_reset_note = '', updated_at = ?2 WHERE id_pengajuan = ?3")
    .bind(buktiUrl, nowIso(), idPengajuan).run();

  const summary = await getUploadLogDetail(db, idPengajuan);
  await writeLogUpload(db, {
    idPengajuan: idPengajuan,
    npm: str(existing.npm),
    namaLengkap: str(existing.nama_lengkap),
    blok: str(existing.blok),
    jenisKegiatan: str(existing.jenis_kegiatan),
    detail: summary.detail,
    tanggal: summary.tanggal,
    linkAcc: '',
    linkBukti: buktiUrl
  });

  await sendReceiptEmail(db, idPengajuan, '', buktiUrl, env);

  return { success: true, message: 'Bukti bayar berhasil disimpan.', linkBukti: buktiUrl };
}
```

Di `getStudentPortalData` (`src/portal.js:126`) ubah:

```js
    const hasUpload = !!str(p.link_bukti_bayar);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/portal-upload.test.js test/portal.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/portal.js test/portal-upload.test.js
git commit -m "feat(portal): bukti-only upload gated on ACC"
```

---

### Task 6: `resetUploadBukti` hanya untuk `ACC`

**Files:**
- Modify: `src/write/pengajuanAdmin.js:366-424`
- Test: `test/write-pengajuan-admin.test.js`

**Interfaces:**
- Produces: `resetUploadBukti` menolak bila status ≠ `ACC`; tetap mengosongkan `link_acc_inhal` (legacy), `link_bukti_bayar`, `link_final`.

- [ ] **Step 1: Write the failing test**

Di `test/write-pengajuan-admin.test.js` (blok `reset upload bukti`) ubah tes "rejects when status is not Diterima or ACC" menjadi:

```js
  it('menolak saat status bukan ACC', async () => {
    await seedWithLinks('Menunggu');
    const ctx = await adminCtx();
    const res = await resetUploadBukti(env.DB, 'INHAL-1', {}, ctx);
    expect(res.success).toBe(false);
    expect(res.message).toContain('ACC');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/write-pengajuan-admin.test.js`
Expected: FAIL — pesan lama menyebut "Diterima atau ACC".

- [ ] **Step 3: Implement**

`src/write/pengajuanAdmin.js` ganti baris 374-377:

```js
  const status = str(p.status);
  if (status !== 'ACC') {
    return { success: false, message: 'Reset unggahan hanya untuk pengajuan berstatus ACC.' };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/write-pengajuan-admin.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/write/pengajuanAdmin.js test/write-pengajuan-admin.test.js
git commit -m "feat(status): reset upload only for ACC"
```

---

### Task 7: UI dashboard — dropdown/quick action & hapus notifikasi email lama

**Files:**
- Modify: `public/dashboard.html` (blok status, blok email actions, default status, `updateStatus`, `quickStatus`, kartu hitungan status)
- Test: `test/dashboard-template.test.js`

**Interfaces:**
- Consumes: RPC `updatePengajuanStatus(db, id, status, catatan, actorEmail)` — tidak berubah signature.
- Produces: dropdown status tanpa `Diterima`; tidak ada tombol "Kirim Ulang Email Notifikasi".

- [ ] **Step 1: Write the failing template test**

Tambahkan kasus di `test/dashboard-template.test.js` (pola mengimpor `dashboard.html?raw` dan meng-assert string):

```js
describe('guard alur status dashboard', () => {
  it('tidak lagi menyediakan status atau aksi Diterima/notifikasi lama', async () => {
    const html = (await import('../public/dashboard.html?raw')).default;
    expect(html).not.toContain('<option>Diterima</option>');
    expect(html).not.toContain('>Diterima<');
    expect(html).not.toContain('Kirim Ulang Email Notifikasi');
    expect(html).toContain('<option>Menunggu</option>');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/dashboard-template.test.js`
Expected: FAIL — masih ada `<option>Diterima</option>`.

- [ ] **Step 3: Implement di `public/dashboard.html`**

1. Dropdown status (baris 1962-1967) menjadi:

```html
                                        <select v-model="detail.status" class="input">
                                            <option>Menunggu</option>
                                            <option>ACC</option>
                                            <option>Ditolak</option>
                                            <option>Dibatalkan</option>
                                        </select>
```

2. Label catatan wajib (baris 1970) untuk Ditolak **dan** Dibatalkan:

```html
                                        <label class="label">Catatan <span class="text-rose-400" v-if="detail.status==='Ditolak' || detail.status==='Dibatalkan'">(wajib)</span></label>
```

3. Hapus tombol `quickStatus('Diterima')` (baris 1976).

4. Hapus grid kolom notifikasi email lama (baris 1986-1991) dan tombol "Kirim Ulang Email Notifikasi" (baris 1993). Blok email actions menjadi:

```html
                            <!-- email actions -->
                            <div class="mt-5">
                                <div class="label mb-2"><i class="bi bi-envelope-check"></i> Email ACC Final</div>
                                <div class="flex flex-wrap gap-2">
                                    <button v-if="!isManual(detail.p) && detail.p.Status==='ACC'" class="btn-soft" @click="sendFinalEmail()"><i class="bi bi-envelope-paper"></i>Kirim Ulang Email ACC Final</button>
                                    <button v-if="detail.p.Status==='ACC'" class="btn-soft" @click="sendAccFinalToBagian()"><i class="bi bi-send"></i>Kirim Ulang Khusus ke Bagian</button>
                                    <span v-if="isManual(detail.p)" class="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-600 ring-1 ring-inset ring-violet-200"><i class="bi bi-info-circle"></i>Pengajuan manual tanpa email — notifikasi email dinonaktifkan.</span>
                                </div>
                            </div>
```

5. Default status saat buka detail (baris 3356):

```js
                    this.detail.status = p.Status || 'Menunggu';
```

6. State awal modal (baris 2312) `status: 'Diterima'` → `status: 'Menunggu'`.

7. `updateStatus()` (baris 3716-3736) — wajib catatan untuk Ditolak/Dibatalkan:

```js
                async updateStatus() {
                    const status = this.detail.status;
                    const catatan = this.detail.catatan.trim();
                    if ((status === 'Ditolak' || status === 'Dibatalkan') && !catatan) {
                        this.notify('Catatan wajib diisi untuk status ' + status + '.', false);
                        return;
                    }
                    this.loading = true;
                    try {
                        const res = await this.run('updatePengajuanStatus', this.detail.p['ID Pengajuan'], status, catatan, '');
                        this.notify((res && res.message) || 'Status diperbarui.');
                        if (res && res.success) {
                            this.detail.open = false;
                            await Promise.all([this.loadStats(), this.loadPengajuan()]);
                        }
                    } catch (e) {
                        this.notify('Gagal: ' + e, false);
                    } finally {
                        this.loading = false;
                    }
                },
```

8. Bersihkan sisa `Diterima` di daftar/hitungan status (baris 2411, 2415, 2426, 2622, 2643, 3896, 3984, 4281, 1687, 1078). Hapus entri `'Diterima'` dan sesuaikan label/urutan; bila sebuah kartu statistik kehilangan makna, hapus kartunya. Untuk `3984` (`isApproved`-style) ganti menjadi `return k === 'ACC';`. Untuk `4281` ganti `(r.Status === 'Diterima' || r.Status === 'ACC')` menjadi `r.Status === 'ACC'`. Untuk `3896` urutan status ganti menjadi `['Ditolak', 'Dibatalkan', 'Menunggu', 'ACC']`.

9. Manual form status select (baris 947-950) hapus `<option value="Diterima">Diterima</option>`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/dashboard-template.test.js`
Expected: PASS.

- [ ] **Step 5: Verifikasi manual**

Run: `rg -n "Diterima" public/dashboard.html`
Expected: tidak ada hasil.

- [ ] **Step 6: Commit**

```bash
git add public/dashboard.html test/dashboard-template.test.js
git commit -m "feat(dashboard): status dropdown without Diterima and drop legacy email UI"
```

---

### Task 8: UI portal — 1 berkas bukti & gating ACC

**Files:**
- Modify: `public/portal.html` (`mapStatusCode`, form unggah, teks/langkah)
- Test: `test/vue-defer-boot.test.js` (pola guard template) atau tes baru `test/portal-template.test.js`

**Interfaces:**
- Consumes: `uploadBuktiFiles({ idPengajuan, npm, buktiFile })`.
- Produces: portal mengirim hanya `buktiFile`; tombol unggah aktif hanya saat `statusCode==='approved'`.

- [ ] **Step 1: Write the failing test**

Buat `test/portal-template.test.js`:

```js
import { describe, it, expect } from 'vitest';

describe('guard template portal', () => {
  it('tidak menyebut Diterima dan tidak meminta berkas ACC INHAL', async () => {
    const html = (await import('../public/portal.html?raw')).default;
    expect(html).not.toContain('diterima');
    expect(html).not.toContain('accFile');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/portal-template.test.js`
Expected: FAIL — masih ada `diterima` dan `accFile`.

- [ ] **Step 3: Implement di `public/portal.html`**

1. `mapStatusCode` (baris 647-653) hapus cabang `diterima`:

```js
                mapStatusCode(status) {
                    const s = String(status || '').toLowerCase();
                    if (s.indexOf('acc') !== -1 || s.indexOf('disetujui') !== -1) return 'approved';
                    if (s.indexOf('ditolak') !== -1) return 'rejected';
                    if (s.indexOf('dibatalkan') !== -1) return 'cancelled';
                    return 'pending';
                },
```

2. Form unggah: hapus field input ACC INHAL dan state `accFile`/`accName`, sisakan hanya input `buktiFile`. Ubah handler unggah agar payload hanya `{ idPengajuan, npm, buktiFile }` (cari fungsi yang memanggil `uploadBuktiFiles`, hapus properti `accFile`).

3. Pastikan blok unggah hanya tampil saat `detailItem.statusCode === 'approved'` (sudah ada di baris 257) dan tidak lagi menyebut ACC INHAL pada teks (baris 257-266). Ganti teks langkah agar menyebut "unggah bukti bayar".

Run untuk menemukan semua titik: `rg -n "ACC INHAL|accFile|diterima|Link ACC" public/portal.html`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/portal-template.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/portal.html test/portal-template.test.js
git commit -m "feat(portal): bukti-only upload UI gated on ACC"
```

---

### Task 9: Verifikasi menyeluruh

- [ ] **Step 1: Jalankan seluruh suite**

Run: `npm test`
Expected: seluruh tes PASS (jumlah file bisa berubah karena tes baru).

- [ ] **Step 2: Pindai sisa referensi `Diterima` & `link_acc_inhal` yang tidak dikehendaki**

Run: `rg -n "Diterima" src/ public/`
Expected: tidak ada hasil.

Run: `rg -n "link_acc_inhal" src/`
Expected: hanya sisa di `pengajuanAdmin.js` (`resetUploadBukti` legacy) — tidak ada di alur baru portal/status.

- [ ] **Step 3: Commit (bila ada penyesuaian sisa)**

```bash
git add -A
git commit -m "chore(status): final sweep after status/portal refactor"
```

---

## Catatan Deploy (dijalankan manual user, bukan bagian task kode)

```bash
cd /workspace/new-code1-cf
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler d1 execute inhal-poc --remote --file=migrations/2026-10-15-status-normalize-diterima-acc.sql
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy
```

## Self-Review

- **Spec coverage:** hapus `Diterima` (Task 1,2,7,8); ACC→nomor+email+PDF (Task 3,4); Ditolak/Dibatalkan portal-only + catatan wajib (Task 3,7); portal bukti-only (Task 5,8); `link_acc_inhal` dihentikan (Task 4,5); reset upload ACC (Task 6); hapus UI notifikasi lama (Task 7). Laporan/agregasi status dipindah ke Plan D.
- **Placeholder scan:** tidak ada TODO; setiap langkah berisi kode/perintah.
- **Type consistency:** `sendFinalPdfEmails(db, idPengajuan, env, actor)` dipakai konsisten (Task 3 & 4); `uploadBuktiFiles({ idPengajuan, npm, buktiFile })` konsisten (Task 5 & 8).
