# BA Pendukung: Bulk Peserta + Satu PDF untuk Semua Peserta — Implementation Plan

**Status: TAHAP 1 & TAHAP 2 SUDAH DIIMPLEMENTASI (2026-11-06), belum di-commit / belum deploy.**
Migrasi `2026-11-06-ba-admin-berkas-scope.sql` WAJIB diterapkan sebelum deploy kode Tahap 2.
Tanggal: 2026-11-06
Target produksi: `new-code1-cf` (Worker `inhal-form`, D1 `inhal-poc`)

**Goal:** Admin dapat membuat **satu** BA Pendukung untuk **banyak peserta sekaligus**, lalu mengunggah **satu PDF** yang berlaku untuk semua peserta, tanpa menghilangkan aturan yang sudah ada (1 BA per `kegiatan_key`, banyak peserta, berkas per peserta opsional, batas halaman/ukuran, regenerate, soft delete).

**Architecture:** Dua tahap. Tahap 1 hanya UI + RPC yang sudah ada (`baAdminCreate`, `baAdminAddPeserta`) untuk membuat BA dengan banyak peserta tanpa berkas. Tahap 2 menambah `scope` pada `berita_acara_admin_berkas` agar ada baris berkas "shared" (milik BA, bukan peserta), dipakai saat merakit PDF setelah sampul + dokumen dasar.

**Tech Stack:** JavaScript ESM, Cloudflare Workers + D1, Vitest (`@cloudflare/vitest-pool-workers`), pdf-lib, Vue 3 CDN.

---

## 1. Keputusan yang sudah dikunci

| # | Keputusan |
|---|-----------|
| D1 | Panel peserta default **kosong** (tidak ada centang otomatis). Tombol buat nonaktif bila 0 peserta. |
| D2 | Menambah peserta setelah PDF shared ada → **regenerate otomatis**. |
| D3 | Tombol unggah/scan per peserta **tetap dipertahankan**. |
| D4 | Urutan: Tahap 1 (bulk select, tanpa migrasi) lalu Tahap 2 (PDF shared, dengan migrasi). |
| D5 | Satu BA per kegiatan tetap dijaga; BA tetap tidak boleh dibuat tanpa peserta. |
| D6 | Tahap 1 tidak mengubah semantik `computeUnitProgress.pendukung` (tetap "BA ada"), tetapi UI diberi penanda bila PDF belum ada. |
| D7 | Label/status untuk BA tanpa PDF: **"PDF belum ada"** (badge amber), dipakai konsisten di tabel unit, modal Kelola, dan ekspor XLSX. |
| D8 | Menghapus peserta dari BA **juga memicu regenerate otomatis** (daftar peserta pada sampul ikut berubah). |
| D9 | Mengganti PDF bersama memakai **konfirmasi sederhana** ("Ganti PDF? PDF lama tetap tersimpan sebagai riwayat"), bukan timpa tanpa konfirmasi. |

## 2. Non-tujuan

- Tidak mengubah BA Pelaksanaan (`berita_acara` / `berita_acara_peserta`).
- Tidak menambah editor urutan peserta manual.
- Tidak mengubah alur pembayaran/ACC/portal.
- Tidak menghapus tombol unggah per peserta maupun kolom `id_pengajuan` pada baris `scope='peserta'`.
- Tidak membuat versi/snapshot PDF (perilaku timpa tetap).

## 3. Fakta kode yang jadi dasar

- BA Pendukung berkunci `kegiatan_key` (bagian + blok + nama kegiatan), lihat `src/write/baAdmin.js:20-42` dan index `schema.sql:227`.
- Baris BA baru lahir lewat `addBaAdminPesertaWithBerkas` yang **mewajibkan berkas** (`src/write/baAdmin.js:454-459`).
- Bulk add tanpa berkas sudah ada dan teruji: `addBaAdminPesertaBulk` (`src/write/baAdmin.js:65`), RPC `baAdminAddPeserta` (`src/rpc.js:130`).
- Berkas disimpan per halaman di `berita_acara_admin_berkas` dan selalu membawa `id_pengajuan` (`schema.sql:201-205`).
- Regenerate saat ini `JOIN ... ON p.id_pengajuan = b.id_pengajuan` (`src/write/baAdmin.js:366-370`), menyusun cover → dokumen dasar → (pemisah + berkas) per peserta (`src/baMerge.js:192-241`).
- Indikator per peserta mensyaratkan berkas aktif (`src/read/dashboard.js:107-112`); progres unit hanya melihat keberadaan baris BA (`src/read/kegiatan.js:39`).
- `src/write/baAdmin.js` **belum menulis `audit_log`**; `BA_CREATE`/`BA_UPDATE` hanya datang dari jalur `src/write/beritaAcara.js`.
- UI saat ini: radio satu peserta untuk "Tambah peserta + berkas" (`public/dashboard.html:2540-2544`), upload satu `targetPid` (`:4632`); `openKelolaBaForUnit` memakai peserta pertama sebagai kunci scope (`:4702`, `:4751`).

---

## 4. File Structure

**Tahap 1**
- `public/dashboard.html` — panel peserta bulk di sheet Pendukung + handler create.
- `test/dashboard-ba-sheet.test.js` — markup & template test.

**Tahap 2**
- `migrations/2026-11-06-ba-admin-berkas-scope.sql` — **Create.**
- `test/migration-ba-admin-berkas-scope.test.js` — **Create.**
- `schema.sql` — **Modify** kolom `scope` + index.
- `src/write/baAdmin.js` — **Modify** shared berkas, regenerate, auto-regen, audit.
- `src/baMerge.js` — **Modify** `sharedFiles`.
- `src/read/dashboard.js` — **Modify** indikator `baPendukungIds`/`baPendukungByPengajuan`.
- `src/rpc.js` — **Modify** `baAdminSetSharedFile`, `baAdminRemoveSharedFile`.
- `src/read/columns.js` — **Modify** hanya bila kolom berkas diekspos (tidak wajib).
- `public/dashboard.html` — **Modify** tombol PDF bersama + tampilan status.
- `test/ba-admin-shared-berkas.test.js` — **Create.**
- `test/ba-admin-regenerate.test.js` — **Modify.**
- `test/dashboard-bootstrap-ba-pendukung.test.js` — **Modify.**

---

# TAHAP 1 — Bulk Peserta (tanpa migrasi)

### Task 1: Panel peserta di sheet Pendukung

**Files:** `public/dashboard.html`, `test/dashboard-ba-sheet.test.js`

**State baru** di sekitar `baSheet` (`public/dashboard.html:2939`):

```js
baSheet: {
  open: false, type: 'pendukung', level: 'blok', blok: '', q: '', loading: false,
  kegiatan: null, pesertaOpsi: [], pesertaIds: [], baAda: false, busy: false
}
```

**Alur UI**

1. `baSheetPickKegiatan(u)` untuk `type==='pendukung'` tidak lagi langsung membuka modal. Ganti menjadi:
   - `this.baSheet.kegiatan = null; this.baSheet.pesertaIds = []; this.baSheet.pesertaOpsi = (u.peserta || []).slice();`
   - `this.baSheet.level = 'peserta';`
   - panggil `baAdminGet(peserta[0].idPengajuan)` untuk mengambil `data.kegiatan` dari server (otoritatif) dan `data.ba`.
     - `baAda = !!data.ba`
     - `pesertaOpsi` tetap dari unit (semua peserta), tetapi yang sudah ada di BA diberi tanda "sudah" (read-only di mode create).
2. Template `v-else-if="baSheet.level==='peserta'"`:
   - Info kegiatan: nama, bagian, blok, jumlah peserta.
   - Bila `baAda`: notice "BA sudah ada untuk kegiatan ini" + tombol **Kelola BA** (memanggil `openKelolaBaPendukung(peserta[0])`) + tombol kembali.
   - Bila belum ada: daftar checkbox `v-model="baSheet.pesertaIds"` + tombol "Pilih Semua/Batal Semua". **Tidak ada centang default** (D1).
   - Checklist hanya menampilkan peserta unit; peserta di luar kegiatan akan dilewati server dan dilaporkan (`skipped`).
3. `baSheetPickKegiatan` versi Pelaksanaan (`_baSheetPickPelaksanaan`) tidak berubah.

**Handler baru**

```js
baSheetPesertaKegiatan: null,
async baSheetLoadPeserta(u) {
  const p = (u && u.peserta) || [];
  const first = p[0] && p[0].idPengajuan;
  if (!first) { this.notify('Kegiatan ini belum punya peserta.', false); return; }
  this.baSheet.loading = true;
  try {
    const res = await this.run('baAdminGet', first);
    if (!res || !res.success) { this.notify((res && res.message) || 'Gagal memuat kegiatan.', false); return; }
    this.baSheet.kegiatan = res.data.kegiatan;
    this.baSheet.baAda = !!res.data.ba;
    this.baSheet.pesertaOpsi = p.slice();
    this.baSheet.pesertaIds = [];
    this.baSheet.level = 'peserta';
  } finally { this.baSheet.loading = false; }
}
```

**Butir aksesibilitas/mobile:** checkbox `h-4 w-4 accent-brand-600`, kontainer `max-h-64 overflow-y-auto`, tombol simpan menempel di bawah (`sticky`), mengikuti pola `bab` (`dashboard.html:2735-2748`).

### Task 2: Buat BA dengan peserta terpilih

```js
async baSheetCreateBa() {
  const ids = (this.baSheet.pesertaIds || []).slice();
  if (!ids.length) { this.notify('Pilih minimal satu peserta.', false); return; }
  const kegiatan = this.baSheet.kegiatan;
  if (!kegiatan) { this.notify('Data kegiatan belum siap.', false); return; }
  this.baSheet.busy = true;
  try {
    const created = await this.run('baAdminCreate', kegiatan);
    if (!created || !created.success) { this.notify((created && created.message) || 'Gagal membuat BA.', false); return; }
    const added = await this.run('baAdminAddPeserta', created.baId, ids);
    const msg = (added && added.success)
      ? 'BA ' + created.baId + ': ' + added.added + ' peserta ditambahkan' + (added.skipped ? ', ' + added.skipped + ' dilewati' : '') + '.'
      : ((added && added.message) || 'Gagal menambah peserta.');
    this.notify(msg, !!(added && added.success));
    this.baSheetClose();
    this.loaded.bagian = false;
    await this.loadBagian();
    this.openKelolaBaPendukung(ids[0]);
  } catch (e) {
    this.notify('Gagal membuat BA: ' + e, false);
  } finally { this.baSheet.busy = false; }
}
```

Catatan:
- `baAdminCreate` idempoten; bila BA sudah ada, `created=false` dan alur tetap menambah peserta.
- Setelah sukses, modal Kelola BA dibuka agar admin bisa mengunggah (per peserta sekarang, PDF bersama setelah Tahap 2).
- `refreshBaPendukungIndicators()` dipanggil setelah `loadBagian()` agar badge ikut segar.

### Task 3: Penanda "BA ada, PDF belum"

Tanpa mengubah `computeUnitProgress` (D6), tambahkan pada baris unit tempat badge BA Pendukung:

- Bila `unitHasPendukung(r) && !unitPendukungBa(r).some(b => b.fileUrl)` → teks badge **`PDF belum ada`** dengan warna amber, bukan emerald (D7).
- Chip BA tanpa `fileUrl` tetap dirender (tanpa tautan), sehingga admin bisa klik "Kelola".
- Ekspor XLSX kolom `BA Pendukung` diubah dari `Ada/Belum` menjadi `Ada/Belum/PDF belum ada` (`dashboard.html:5211`, D7).
- Modal Kelola BA menampilkan banner amber bila `kb.data.ba && !kb.data.ba.fileUrl`.

### Task 4: Test Tahap 1

- `test/dashboard-ba-sheet.test.js`: pastikan HTML memuat `level==='peserta'`, `baSheet.pesertaIds`, `baSheetCreateBa`, `baAdminAddPeserta`, dan tidak memakai `type="radio"` untuk daftar peserta pendukung baru.
- Test manual (setelah implementasi): login admin → Buat BA → Pendukung → pilih blok/kegiatan → pastikan semua checkbox kosong → pilih 3 peserta → Buat BA → modal Kelola terbuka dengan 3 peserta "Belum ada berkas".

Run: `npx vitest run test/dashboard-ba-sheet.test.js`

---

# TAHAP 2 — Satu PDF untuk Semua Peserta

### Task 5: Migrasi kolom `scope`

`migrations/2026-11-06-ba-admin-berkas-scope.sql`:

```sql
-- Bedakan berkas milik peserta (default) dari berkas bersama milik BA.
ALTER TABLE berita_acara_admin_berkas ADD COLUMN scope TEXT DEFAULT 'peserta';

UPDATE berita_acara_admin_berkas
  SET scope = 'peserta'
  WHERE scope IS NULL OR trim(scope) = '';

CREATE INDEX IF NOT EXISTS idx_ba_admin_berkas_ba_scope_active
  ON berita_acara_admin_berkas(ba_id, scope, active);
```

`schema.sql` (bagian `CREATE TABLE berita_acara_admin_berkas`) tambah `scope TEXT DEFAULT 'peserta',` dan index yang sama.

**Test migrasi** `test/migration-ba-admin-berkas-scope.test.js` (pola `test/migration-ba-admin-base-file.test.js`):
- Buat tabel versi lama tanpa `scope`, isi 2 baris.
- Jalankan SQL migrasi.
- Assert semua baris lama ber-`scope='peserta'`, kolom baru ada, index terbentuk.

**Urutan deploy: migrasi dulu, baru deploy kode.** Kode baru akan meng-query `scope`.

### Task 6: Backend upload PDF bersama

Di `src/write/baAdmin.js`:

```js
export async function setBaAdminSharedBerkas(db, baId, file, ctx) {
  await requireAdmin(db, ctx.token, ctx.session);
  const id = str(baId);
  const ba = await db.prepare('SELECT * FROM berita_acara_admin WHERE ba_id = ?1').bind(id).first();
  if (!ba) return { success: false, message: 'BA Pendukung tidak ditemukan.' };
  const aktif = (await db.prepare('SELECT COUNT(*) AS n FROM berita_acara_admin_peserta WHERE ba_id = ?1 AND active = 1').bind(id).first()).n || 0;
  if (!aktif) return { success: false, message: 'Tambahkan peserta terlebih dahulu.' };
  if (!(file && file.data)) return { success: false, message: 'Tidak ada berkas yang diunggah.' };

  const mime = resolveMime(file.mimeType, file.data);
  if (['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'].indexOf(mime) === -1) {
    return { success: false, message: 'Format berkas harus PDF, JPG, atau PNG.' };
  }
  const byteSize = decodeBase64Size(file.data);
  let pageCount = 1;
  if (mime === 'application/pdf') {
    try { pageCount = (await PDFDocument.load(base64ToBytes(file.data), { ignoreEncryption: true })).getPageCount(); }
    catch { return { success: false, message: 'PDF tidak dapat dibaca.' }; }
    if (!pageCount) return { success: false, message: 'PDF tidak memiliki halaman.' };
  }
  const otherPages = await countActivePages(db, id, '');   // setelah difilter scope='peserta'
  const sharedPages = await countActiveSharedPages(db, id);
  const otherBytes = await countActiveBytes(db, id, '');   // setelah difilter scope='peserta'
  const sharedBytes = await countActiveSharedBytes(db, id);
  if (otherPages + sharedPages + pageCount > BA_ADMIN_MAX_PAGES) {
    return { success: false, message: 'Batas ' + BA_ADMIN_MAX_PAGES + ' halaman per BA terlampaui.' };
  }
  if (otherBytes + sharedBytes + byteSize > BA_ADMIN_MAX_BYTES) {
    return { success: false, message: 'Total ukuran halaman melebihi 20 MB.' };
  }

  const up = await saveDriveFile(ctx.env,
    { data: file.data, mimeType: mime, name: file.name || 'ba-shared.pdf' },
    'ba-admin-' + id + '-shared',
    { allowedMime: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'], maxBytes: BA_ADMIN_MAX_BYTES, label: 'PDF BA bersama' });
  if (!up.ok) return { success: false, message: up.message };

  const ts = nowIso();
  await db.batch([
    db.prepare("UPDATE berita_acara_admin_berkas SET active = 0, superseded_at = ?1 WHERE ba_id = ?2 AND scope = 'shared' AND active = 1").bind(ts, id),
    db.prepare(
      "INSERT INTO berita_acara_admin_berkas (timestamp, ba_id, id_pengajuan, npm, urutan, page_index, file_name, file_url, page_count, byte_size, active, scope) " +
      "VALUES (?1,?2,'','',0,0,?3,?4,?5,?6,1,'shared')"
    ).bind(ts, id, String(up.name || ''), up.url, pageCount, byteSize)
  ]);

  const regen = await regenerateBaAdminPdf(db, id, ctx);
  await auditAdminBa(db, ctx, 'BA_UPDATE', id, { jenis: 'Pendukung', aksi: 'shared_upload', pages: pageCount });
  return {
    success: true, pages: pageCount, fileUrl: up.url,
    needsRegen: !regen.success, message: regen.success ? 'PDF BA bersama disimpan.' : (regen.message || 'Berkas tersimpan, PDF gagal dirakit.')
  };
}
```

`removeBaAdminSharedBerkas(db, baId, ctx)`: nonaktifkan baris shared aktif, regenerate, audit `BA_UPDATE` aksi `shared_remove`.

Perubahan pembantu:
- `countActivePages`, `countActiveBytes` diberi filter `AND scope = 'peserta'` pada query-nya (parameter `exceptIdPengajuan` tetap).
- Tambah `countActiveSharedPages`, `countActiveSharedBytes` dengan filter `scope = 'shared'`.
- `setBaAdminPesertaBerkas` menulis `scope` eksplisit `'peserta'` pada INSERT (default sudah, tetapi eksplisit lebih aman).

RPC (`src/rpc.js`):

```js
baAdminSetSharedFile: (db, args, ctx) => setBaAdminSharedBerkas(db, args[0], args[1], ctx),
baAdminRemoveSharedFile: (db, args, ctx) => removeBaAdminSharedBerkas(db, args[0], ctx),
```

Tambahan import di `src/write/baAdmin.js` untuk audit:

```js
import { writeAuditLog } from '../audit.js';
```

Helper audit baru (best-effort, pola `auditBa` di `src/write/beritaAcara.js:26-38`):

```js
async function auditAdminBa(db, ctx, action, baId, detail) {
  try {
    await writeAuditLog(db, {
      actor: str(ctx && ctx.session && ctx.session.nama) || 'Sistem',
      action: action,
      target: baId,
      detail: JSON.stringify(detail || {}),
      alasan: ''
    });
  } catch {}
}
```

Catatan: `deleteBeritaAcaraAdmin` (`src/write/beritaAcara.js:537`) sudah menghapus **semua** baris `berita_acara_admin_berkas` dan men-trash semua `file_url`, termasuk baris `scope='shared'`. Tidak perlu perubahan; cukup dipastikan lewat test regresi.

### Task 7: Regenerate & merge

`runRegenerateBaAdminPdf` (`src/write/baAdmin.js:331-432`):

1. Query per peserta tetap, tambahkan `AND b.scope = 'peserta'`.
2. Query shared:
   ```js
   const sharedRows = (await db.prepare(
     "SELECT * FROM berita_acara_admin_berkas WHERE ba_id = ?1 AND active = 1 AND scope = 'shared' ORDER BY page_index"
   ).bind(id).all()).results || [];
   ```
3. Kondisi kosong: `if (!rows.length && !sharedRows.length && !baseUrl)`.
4. Hitung `totalSourcePages` = base + sum(page_count shared) + sum(page_count per peserta). Batas 50 tetap.
5. Ambil byte shared (download per baris), jumlahkan ke `totalBytes` sebelum merge; batas 20 MB tetap.
6. Panggil merge dengan tambahan `sharedFiles` dan penanda `ba.shared`.

`src/baMerge.js`:

- `const shared = Array.isArray(cfg.sharedFiles) ? cfg.sharedFiles : [];`
- Setelah dokumen dasar, sebelum grup peserta:
  ```js
  for (const f of shared) {
    const bytes = toBytes(f && f.bytes);
    if (!bytes || !bytes.length) continue;
    if (isPdfFile(f)) sourcePages += await copyPdfPages(doc, bytes);
    else { await addImagePage(doc, bytes, String(f.mime || '')); sourcePages += 1; }
  }
  ```
- `addCoverPages` menerima `shared` (boolean). Baris peserta menjadi:
  - bila `shared` dan `pe.halaman` kosong → `- dokumen BA bersama`
  - selain itu perilaku lama.
- Halaman pemisah per peserta tetap dibuat **hanya** untuk grup yang punya berkas per peserta (perilaku lama `withFiles`).
- Footer nomor halaman tetap.

Urutan PDF final: **sampul + daftar peserta → dokumen dasar → PDF bersama → berkas per peserta (bila ada)**.

### Task 8: Indikator dashboard

`src/read/dashboard.js:107-125`:

1. `baPendukungRows` diganti:
   ```sql
   SELECT DISTINCT p.id_pengajuan
   FROM berita_acara_admin_peserta p
   WHERE p.active = 1 AND (
     EXISTS (
       SELECT 1 FROM berita_acara_admin_berkas b
       WHERE b.ba_id = p.ba_id AND b.id_pengajuan = p.id_pengajuan
         AND b.active = 1 AND b.scope = 'peserta'
     )
     OR EXISTS (
       SELECT 1 FROM berita_acara_admin_berkas s
       WHERE s.ba_id = p.ba_id AND s.active = 1 AND s.scope = 'shared'
     )
   )
   ```
2. `baPendukungByPengajuan`:
   - Pertama, BA yang punya shared aktif:
     ```sql
     SELECT a.ba_id, a.file_url, a.base_file_url FROM berita_acara_admin a
     WHERE EXISTS (SELECT 1 FROM berita_acara_admin_berkas s
                   WHERE s.ba_id = a.ba_id AND s.active = 1 AND s.scope = 'shared')
     ORDER BY a.timestamp DESC, a.ba_id DESC
     ```
     Untuk setiap BA, ambil seluruh peserta aktif BA itu dan beri `{ baId, fileUrl: a.file_url || a.base_file_url }` bila `file_url` ada.
   - Lalu jalur per peserta yang sudah ada (tetap, dengan tambahan `b.scope='peserta'`) untuk peserta yang belum terisi.
3. `getBaAdminForPengajuan` menambah `data.ba.shared = { pages, pageCount, fileUrl }` (dari baris shared aktif) agar modal bisa menampilkan status.
4. Halaman laporan (`src/read/laporan.js`) tidak perlu diubah: `baPendukung` di sana adalah baris BA, bukan berkas. Peserta tetap `masukBa` dari keanggotaan BA.

### Task 9: UI Kelola BA — tombol PDF bersama

Di modal Kelola (`public/dashboard.html:2485-2599`), tambah seksi setelah "Dokumen dasar":

```html
<div v-if="kb.data.ba" class="mt-3 rounded-xl bg-indigo-50 p-3 ring-1 ring-indigo-100">
  <div class="text-xs font-bold uppercase tracking-wide text-indigo-500">PDF BA untuk semua peserta</div>
  <div class="mt-1 flex flex-wrap items-center gap-2">
    <a v-if="kb.data.ba.shared && kb.data.ba.shared.fileUrl" :href="safeUrl(kb.data.ba.shared.fileUrl)"
       target="_blank" rel="noopener noreferrer" class="btn-soft !py-1 !px-2 text-[11px]">
      <i class="bi bi-file-earmark-pdf"></i> Lihat PDF ({{ kb.data.ba.shared.pageCount }} hal.)
    </a>
    <span v-else class="text-[11px] text-indigo-700">Belum ada. Satu PDF ini berlaku untuk semua peserta.</span>
    <button class="btn-primary !py-1 !px-2 text-[11px]" :disabled="kb.uploadBusy || !(kb.data.peserta || []).length" @click="kbPickShared()">
      <i class="bi bi-upload"></i> {{ kb.data.ba.shared && kb.data.ba.shared.fileUrl ? 'Ganti PDF' : 'Unggah PDF' }}
    </button>
    <button v-if="kb.data.ba.shared && kb.data.ba.shared.fileUrl" class="btn-soft !py-1 !px-2 text-[11px] !text-rose-600" :disabled="kb.uploadBusy" @click="kbRemoveShared()">
      <i class="bi bi-x-lg"></i> Hapus PDF bersama
    </button>
  </div>
  <p class="mt-1 text-[10px] text-indigo-700">Sampul dan daftar peserta dibuat otomatis. PDF ini ditempatkan setelah dokumen dasar.</p>
</div>
```

Handler: `kbPickShared`, `onKbSharedFile` (baca base64 → `baAdminSetSharedFile`), `kbRemoveShared` (konfirmasi → `baAdminRemoveSharedFile`), semuanya memanggil `loadKelolaBa` + `refreshBaPendukungIndicators` setelah sukses.

Mengganti PDF saat sudah ada memakai `askConfirm` (pola `kbRemoveBase`, `dashboard.html:4694-4699`): "Ganti PDF BA bersama? PDF lama tetap tersimpan sebagai riwayat." (D9). Baris shared lama menjadi `active=0` + `superseded_at`, bukan dihapus.

Input file `ref="kbSharedFile"` (`accept=".pdf,.jpg,.jpeg,.png"`), taruh dekat `kbBaseFile` (`:2561`).

Tampilan peserta: bila shared ada dan peserta belum punya berkas, label "Belum ada berkas" diubah menjadi "Mengikuti PDF bersama" (tanpa mengubah tombol unggah per peserta, D3).

### Task 10: Auto-regenerate & audit

`addBaAdminPesertaBulk` (`src/write/baAdmin.js:65-117`):
- Hitung `beforeCount` sebelum insert.
- Setelah update `jumlah_peserta`, bila `added > 0` dan ada shared aktif:
  ```js
  const shared = (await db.prepare("SELECT COUNT(*) AS n FROM berita_acara_admin_berkas WHERE ba_id = ?1 AND active = 1 AND scope = 'shared'").bind(id).first()).n || 0;
  if (shared) {
    const regen = await regenerateBaAdminPdf(db, id, ctx);
    result.fileUrl = regen.fileUrl || ''; result.needsRegen = !regen.success;
  }
  ```
- Audit: `action = beforeCount === 0 ? 'BA_CREATE' : 'BA_UPDATE'`, detail `{ jenis: 'Pendukung', aksi: 'peserta', added, skipped }`.
- `removeBaAdminPeserta`: bila shared aktif → regenerate setelah update (D8); audit `BA_UPDATE` aksi `peserta_hapus`.
- `auditAdminBa` helper baru memakai `writeAuditLog` best-effort (pola `auditBa` di `src/write/beritaAcara.js:26-38`), dengan `ctx.session.nama`.
- Jangan mengaudit bila `added === 0 && skipped === 0`.

### Task 11: Test Tahap 2

`test/ba-admin-shared-berkas.test.js`:
- Migrasi: kolom `scope` default `'peserta'`, backfill benar.
- `setBaAdminSharedBerkas` menolak BA tanpa peserta dan format salah.
- Upload sukses menyimpan **satu** baris `scope='shared'`, `id_pengajuan=''`, `page_count` sesuai PDF.
- Upload ulang menonaktifkan baris shared lama (`active=0`, `superseded_at` terisi).
- Batas 50 halaman/20 MB tetap berlaku (shared + per peserta dijumlahkan).
- `removeBaAdminSharedBerkas` menonaktifkan dan regenerate.

`test/ba-admin-regenerate.test.js` (tambahan):
- PDF final memuat halaman sampul + halaman shared + halaman per peserta (bila keduanya ada).
- Sampul menyebut "dokumen BA bersama" untuk peserta tanpa berkas saat shared ada.
- Tanpa shared, output identik dengan perilaku lama.

`test/dashboard-bootstrap-ba-pendukung.test.js` (tambahan):
- Peserta aktif dengan shared aktif masuk `baPendukungIds` walaupun tidak punya berkas per peserta.
- BA dengan shared tetapi `file_url` kosong tidak mengisi `baPendukungByPengajuan`.
- Peserta tanpa shared dan tanpa berkas tetap tidak masuk.

`test/ba-admin-peserta.test.js` (tambahan):
- Bulk add saat shared ada memicu regenerate (mock `fetch` Drive) dan mengembalikan `fileUrl`.
- Bulk add tanpa shared tidak memanggil regenerate (perilaku lama, tes lama tetap lulus).

`test/dashboard-ba-sheet.test.js` (tahap 2): HTML memuat `baAdminSetSharedFile`, `PDF BA untuk semua peserta`, dan tombol per peserta tetap ada.

---

## 5. Verifikasi & Deploy

```bash
cd /workspace/new-code1-cf
npm test
npm run csp:check
npm run migrations:check
```

Smoke lokal (opsional):

```bash
npx wrangler dev --local --persist-to /tmp/opencode/inhal-smoke --port 8787 --config wrangler.toml
```

Deploy (setelah arahan eksplisit, **urutan wajib**):

```bash
cd /workspace/new-code1-cf
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler d1 migrations apply inhal-poc --remote
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy
```

Verifikasi pasca-deploy:
1. Buat BA baru dengan 3 peserta → daftar tampil "Belum ada berkas".
2. Unggah satu PDF bersama → PDF final berisi sampul + daftar 3 peserta + PDF tersebut.
3. Tambah peserta ke-4 → PDF otomatis diperbarui dan daftar di sampul memuat 4 nama.
4. Hapus peserta → PDF diperbarui.
5. Cek `audit_log` memuat `BA_CREATE`/`BA_UPDATE` untuk aksi ini.
6. Cek `/detail-laporan` menampilkan link BA Pendukung untuk semua peserta BA tersebut.
7. Unduh BA per peserta (tombol lama) tetap berfungsi bila ada berkas per peserta.

---

## 6. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Deploy kode sebelum migrasi → query `scope` gagal | Terapkan migrasi lebih dulu; migrasi aditif dan aman diulang. |
| Data lama tanpa `scope` | Backfill `UPDATE ... SET scope='peserta'` + default kolom. |
| Regenerate gagal (Drive/limit) | `needs_regen=1`, berkas & baris tetap; tombol Regenerate lama tetap ada. |
| PDF ganda (shared + per peserta) membingungkan | Urutan tetap: shared dulu, lalu per peserta; UI memberi label sumber. |
| BA tanpa PDF dianggap selesai | Penanda "Ada, PDF belum" di UI; `computeUnitProgress` tidak diubah (D6). |
| Duplikasi audit | Audit hanya saat ada perubahan nyata (`added>0`, upload, hapus). |

## 7. Status keputusan

Semua pertanyaan terbuka sudah dijawab dan dikunci pada tabel D1–D9:

1. Label BA tanpa PDF = **"PDF belum ada"** (amber) → D7.
2. Hapus peserta = **regenerate otomatis** → D8.
3. Ganti PDF bersama = **konfirmasi sederhana**, riwayat berkas lama tetap tersimpan (`active=0`, `superseded_at`) → D9.

Tidak ada pertanyaan terbuka lain. Implementasi menunggu arahan eksplisit dari user.

---

## 8. Catatan implementasi (hasil aktual)

- Tahap 1: level `peserta` + `baPesertaCount` (menampilkan "N peserta di BA" saat BA sudah ada), checkbox default kosong, badge 3 status.
- Tahap 2: `scope` + index; `setBaAdminSharedBerkas` / `removeBaAdminSharedBerkas`; RPC `baAdminSetSharedFile` / `baAdminRemoveSharedFile`.
- `baAdminRemovePeserta` sekarang melakukan regenerate sendiri (sebelumnya di RPC), sehingga auto-regen juga berlaku saat dipanggil langsung dari worker.
- Audit `BA_CREATE`/`BA_UPDATE` ditulis dari `baAdmin.js` untuk: tambah peserta (hanya bila `added`/`skipped` > 0), hapus peserta, unggah/ganti PDF bersama, hapus PDF bersama.
- `getBaAdminForPengajuan` mengecualikan baris `scope='shared'` dari daftar berkas peserta dan mengembalikan `ba.shared = { pages, pageCount, fileUrl, fileName }`.
- Indikator dashboard: peserta dianggap ber-BA bila punya berkas `scope='peserta'` aktif **atau** BA punya baris `scope='shared'` aktif; link PDF memakai `file_url`/`base_file_url` BA dan dibagikan ke semua peserta aktif BA tersebut.
- UI modal Kelola: seksi "PDF BA untuk semua peserta", label "Mengikuti PDF bersama", konfirmasi ganti/hapus, tombol unggah/scan per peserta tetap.
- Tes: 108 file / 881 tes lulus (termasuk migrasi, shared berkas, regenerate urutan shared, indikator bootstrap, auto-regen bulk, audit, RPC, UI).
- Smoke lokal (mock Drive): buat BA 3 peserta → unggah PDF bersama 2 hal. → PDF final 3 hal. (sampul + 2 shared); ganti PDF → baris lama `active=0` + `superseded_at`; hapus PDF → kembali "Belum ada berkas"; hapus peserta → PDF auto-regenerate ke 3 hal. (sampul + 2 shared); `audit_log` berisi BA_CREATE + BA_UPDATE (shared_upload/shared_remove/peserta_hapus); tanpa error JS.

## 9. Ringkasan delta perubahan per file

| File | Sebelum | Sesudah |
|---|---|---|
| `public/dashboard.html` (sheet Pendukung) | Klik kegiatan langsung membuka modal Kelola; peserta pertama jadi kunci | Level `peserta`: checkbox (default kosong) + Pilih Semua, lalu `baAdminCreate` + `baAdminAddPeserta` |
| `public/dashboard.html` (badge unit) | `Ada` / `Belum` | `Ada` / `PDF belum ada` (amber) / `Belum`; ekspor XLSX ikut |
| `public/dashboard.html` (modal Kelola) | Hanya dokumen dasar + berkas per peserta | Tambah seksi "PDF BA untuk semua peserta" (lihat/ganti/hapus, konfirmasi ganti) |
| `migrations/2026-11-06-ba-admin-berkas-scope.sql` | Tidak ada | `ALTER TABLE ... ADD COLUMN scope TEXT DEFAULT 'peserta'` + backfill + index |
| `schema.sql` | Tabel berkas tanpa `scope` | Tambah `scope` + index `(ba_id, scope, active)` |
| `src/write/baAdmin.js` | Baris berkas selalu milik peserta; tanpa audit | Baris `scope='shared'` didukung; cap dihitung gabungan; bulk/remove peserta auto-regenerate; audit `BA_CREATE`/`BA_UPDATE` |
| `src/baMerge.js` | Cover → dokumen dasar → per peserta | Cover (+penanda "dokumen BA bersama") → dokumen dasar → `sharedFiles` → per peserta |
| `src/read/dashboard.js` | Peserta dianggap ber-BA hanya bila punya berkas per peserta | Peserta ber-BA bila punya berkas per peserta **atau** BA punya shared aktif; link PDF sama untuk semua peserta BA |
| `src/rpc.js` | Tidak ada RPC shared | `baAdminSetSharedFile`, `baAdminRemoveSharedFile` (tetap `requireAdmin`) |
| `src/read/columns.js` | — | Tidak berubah (kolom berkas tidak diekspos ke klien) |

**Yang tidak berubah:** `computeUnitProgress`, alur BA Pelaksanaan, `deleteBeritaAcaraAdmin` (sudah menghapus semua baris berkas termasuk shared), rumus `kegiatan_key`, dan batas `BA_ADMIN_MAX_PAGES`/`BA_ADMIN_MAX_BYTES`.
