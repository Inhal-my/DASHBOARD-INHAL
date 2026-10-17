# Laporan, Pembersihan Sisa Status, & Bridge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menjadikan Laporan menampilkan kelengkapan berbasis keanggotaan BA Pelaksanaan (bukan `link_final`), membersihkan sisa-sisa status `Diterima` yang tertinggal setelah Plan A, dan memperbaiki teks email tanda terima pada bridge GAS.

**Architecture:** `getLaporanBootstrap` menambahkan penanda `masukBa` pada setiap peserta unit (dari `berita_acara` + `berita_acara_peserta`); `computeUnitProgress` menghitung tahap `final` dari penanda itu. Referensi status `Diterima` yang masih ada di server laporan & UI `detail-laporan.html` disapu menjadi `ACC`. Teks `Link ACC INHAL` pada `new-code1/3_drive_bridge.gs` diganti.

**Tech Stack:** JavaScript ESM, Cloudflare Workers + D1, Vitest, Vue 3 CDN, Google Apps Script (bridge).

## Global Constraints

- **Prasyarat:** Plan A, B, C sudah dieksekusi. Plan D mengasumsikan status `Diterima` sudah dihapus dari model (status valid: `Menunggu`, `ACC`, `Ditolak`, `Dibatalkan`) dan `berita_acara.label` sudah ada.
- "Keanggotaan final BA" = peserta yang terdaftar di salah satu baris BA Pelaksanaan (`berita_acara` dengan `sumber='Bagian'`) untuk `kegiatan_key` unit tersebut, **lintas tanggal & label**.
- `masukBa` dihitung dari `berita_acara_peserta.id_pengajuan` (bukan `npm`) + `berita_acara.kegiatan_key`.
- Fallback identitas: bila `kegiatan_key` kosong (data lama), pakai `kegiatanKey(bagian, blok, nama_kegiatan)`.
- Perubahan bridge GAS **tidak otomatis ter-deploy** — butuh deploy manual dari editor Apps Script.
- Migrasi tidak diperlukan pada plan ini (hanya kode + UI).
- Perintah tes: `npm test`. Semua tes lama harus tetap lulus.
- **Catatan koordinasi:** `src/read/dashboard.js:373` (`getUploadMonitor`, filter `status IN ('Diterima','ACC')`) juga merupakan titik sisa. Bila Plan A sudah mengubahnya, lewati; bila belum, tangani di Task 2.

---

## File Structure

- `src/read/laporan.js` — **Modify.** `masukBa` per peserta unit + hapus `totalDiterima`.
- `src/read/kegiatan.js` — **Modify.** `computeUnitProgress.final` dari `masukBa`; sisa `Diterima`.
- `test/read-laporan.test.js` — **Modify.** Uji keanggotaan BA + status ACC.
- `public/detail-laporan.html` — **Modify.** Hapus sisa status `Diterima` + kartu `totalDiterima`.
- `test/detail-laporan-template.test.js` — **Modify.** Guard tidak ada sisa `Diterima`.
- `new-code1/3_drive_bridge.gs` — **Modify.** Teks email tanda terima.
- `new-code1-cf/public/dashboard.html` — **Modify (bila belum dari Plan A).** Sisa `Diterima` pada default status/stat.

---

### Task 1: Laporan memakai keanggotaan BA Pelaksanaan sebagai "final" unit

**Files:**
- Modify: `src/read/laporan.js:19-26, 93-138`
- Modify: `src/read/kegiatan.js:12-33`
- Test: `test/read-laporan.test.js`

**Interfaces:**
- Produces:
  - `units[].peserta[]` memiliki properti `masukBa: boolean`.
  - `computeUnitProgress(unit).final` = `stage(peserta.filter(masukBa).length, total)`.
  - `counts.final` = jumlah peserta yang masuk BA Pelaksanaan.

- [ ] **Step 1: Write the failing tests**

Ubah `test/read-laporan.test.js`:

a) Pada tes `'mengembalikan unit kegiatan dengan progres'`, tambahkan baris peserta BA setelah insert `berita_acara` (baris `:34-35`):

```js
    await env.DB.prepare(
      "INSERT INTO berita_acara_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok) VALUES ('2026-09-11T08:00:00','BA-2026-0001','INHAL-1','2201010001','Aisyah','A')"
    ).run();
```

b) Tambahkan tes baru di akhir `describe`:

```js
  it("final mengikuti keanggotaan BA Pelaksanaan, bukan link_final", async () => {
    const token = await createSession(env.DB, { role: 'admin', nama: 'Admin' });
    await env.DB.prepare(
      "INSERT INTO pengajuan (timestamp,id_pengajuan,npm,nama_lengkap,blok,jenis_kegiatan,status,link_final) VALUES ('2026-09-10T08:00:00','INHAL-1','2201010001','Aisyah','A','SGD','ACC','http://final')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO detail_kegiatan (timestamp,id_pengajuan,jenis_kegiatan,pilihan,detail,tanggal_pelaksanaan,bagian) VALUES ('2026-09-10T08:00:00','INHAL-1','SGD','SGD 1','','2026-09-20','')"
    ).run();
    const before = await getLaporanBootstrap(env.DB, { token });
    const u0 = before.kegiatan.find((u) => u.key === 'sgd|a|sgd 1');
    expect(u0.peserta[0].masukBa).toBe(false);
    expect(u0.progress.final).toBe('none');

    await env.DB.prepare(
      "INSERT INTO berita_acara (timestamp,ba_id,bagian,blok,nama_kegiatan,tanggal_pelaksanaan,jam,dosen,jumlah_peserta,file_url,catatan,sumber,kegiatan_key) VALUES ('2026-09-11T08:00:00','BA-PEL-2026-0001','SGD','A','SGD 1','2026-09-20','08:00','dr. Andi','1','http://ba','','Bagian','sgd|a|sgd 1')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO berita_acara_peserta (timestamp,ba_id,id_pengajuan,npm,nama_lengkap,blok) VALUES ('2026-09-11T08:00:00','BA-PEL-2026-0001','INHAL-1','2201010001','Aisyah','A')"
    ).run();
    const after = await getLaporanBootstrap(env.DB, { token });
    const u1 = after.kegiatan.find((u) => u.key === 'sgd|a|sgd 1');
    expect(u1.peserta[0].masukBa).toBe(true);
    expect(u1.progress.final).toBe('all');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/read-laporan.test.js`
Expected: FAIL — `masukBa` belum ada; `progress.final` masih memakai `link_final`.

- [ ] **Step 3: Implement di `src/read/laporan.js`**

a) Setelah membangun `pesertaMap` (baris `:20-26`), tambahkan pemetaan keanggotaan BA:

```js
  const baMemberByKey = {};
  const baKeyByBaId = {};
  for (const b of ba) {
    const c = toClientRow('berita_acara', b);
    if (baSumber(c) !== 'Bagian') continue;
    const id = String(b.ba_id || '').trim();
    if (!id) continue;
    baKeyByBaId[id] = String(b.kegiatan_key || '').trim() || kegiatanKey(c.Bagian, c.Blok, c['Nama Kegiatan']);
  }
  for (const r of baPeserta) {
    const key = baKeyByBaId[String(r.ba_id || '').trim()];
    const idp = String(r.id_pengajuan || '').trim();
    if (!key || !idp) continue;
    if (!baMemberByKey[key]) baMemberByKey[key] = new Set();
    baMemberByKey[key].add(idp);
  }
```

b) Di loop `units` (`:95-120`), saat mendorong peserta unit (`:110-118`), tambahkan `masukBa`:

```js
      const u = units[unitIndex[key]];
      if (!u.peserta.some((x) => x.idPengajuan === idp)) {
        const memberSet = baMemberByKey[key];
        u.peserta.push({
          idPengajuan: idp,
          npm: String(p.NPM || '').trim(),
          namaLengkap: String(p['Nama Lengkap'] || '').trim(),
          statusPengajuan: String(p.Status || '').trim(),
          linkFinal: String(p['Link Final'] || '').trim(),
          masukBa: !!(memberSet && memberSet.has(idp))
        });
      }
```

- [ ] **Step 4: Implement di `src/read/kegiatan.js`**

Ganti (baris `:17-21`):

```js
  const decided = peserta.filter((p) => {
    const s = String(p.statusPengajuan || '').trim();
    return s === 'ACC' || s === 'Ditolak';
  }).length;
  const finalCount = peserta.filter((p) => p.masukBa).length;
```

(Pastikan `finalCount` tidak lagi memakai `p.linkFinal`.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/read-laporan.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/read/laporan.js src/read/kegiatan.js test/read-laporan.test.js
git commit -m "feat(laporan): final stage from BA Pelaksanaan membership"
```

---

### Task 2: Bersihkan sisa status `Diterima` di laporan & UI

**Files:**
- Modify: `src/read/laporan.js:41, 48, 141`
- Modify: `public/detail-laporan.html:1737, 1747, 1756, 1865, 1890, 1955, 1969, 1971, 1982, 2747`
- Test: `test/read-laporan.test.js`, `test/detail-laporan-template.test.js`

**Interfaces:**
- Produces: `summary.totalDiterima` dihapus; UI `detail-laporan.html` tidak lagi memuat status `Diterima` maupun kartu `totalDiterima`.

- [ ] **Step 1: Write the failing guard test**

Tambahkan ke `test/detail-laporan-template.test.js`:

```js
describe('sisa status Diterima', () => {
  it('detail-laporan tidak memuat Diterima / totalDiterima', async () => {
    const html = (await import('../public/detail-laporan.html?raw')).default;
    expect(html).not.toContain("'Diterima'");
    expect(html).not.toContain('totalDiterima');
    expect(html).not.toContain('>Diterima<');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/detail-laporan-template.test.js`
Expected: FAIL.

- [ ] **Step 3: Ubah `src/read/laporan.js`**

a) Baris `:41` hapus `totalDiterima`:

```js
  let totalPendaftar = 0, totalDitolak = 0, totalMenunggu = 0, totalAcc = 0, totalBiaya = 0;
```

b) Baris `:48` hapus `if (status === 'Diterima') totalDiterima++;`.

c) Baris `:141` hapus `totalDiterima` dari objek `summary`:

```js
    summary: { totalPendaftar, totalDitolak, totalMenunggu, totalAcc, totalBiaya, perJenis, perBlok, perStatus },
```

- [ ] **Step 4: Ubah `public/detail-laporan.html`**

a) `statusBadgeCls` (`:1735-1741`): hapus entri `'Diterima': 'recv',`.
b) `statusChipCls` (`:1745-1751`): hapus entri `'Diterima': ...`.
c) `statusColor` (`:1754-1760`): hapus entri `'Diterima': '#10b981',`.
d) `data()` `animated` (`:1865`): hapus `totalDiterima: 0`.
e) Status key list (`:1890`, `:1971`, `:1982`): hapus `'Diterima'` dari array.
f) `summaryCards` (`:1952-1959`): hapus kartu `{ label: 'Diterima', ... }`.
g) `dot` map (`:1969`): hapus `'Diterima': '#0284c7',`.
h) Pemetaan animasi (`:2747`): hapus baris `totalDiterima: s.totalDiterima || 0,`.
i) Cari sisa `Diterima` lain dengan `rg -n "Diterima" public/detail-laporan.html` dan hapus semuanya.

- [ ] **Step 5: Perbarui `test/read-laporan.test.js`**

- Baris `:9` ganti status `'Diterima'` → `'ACC'`.
- Baris `:15` ganti `expect(boot.summary.totalDiterima).toBe(1);` → `expect(boot.summary.totalAcc).toBe(1);`.
- Baris `:48` ganti status `'Diterima'` → `'ACC'`.

- [ ] **Step 6: Cek sisa `Diterima` server**

Run: `rg -n "Diterima" src`
Expected: tidak ada hasil (bila masih ada di `src/read/dashboard.js:373`, ubah `status IN ('Diterima','ACC')` → `status = 'ACC'`; sesuaikan tes `getUploadMonitor` yang terkait).

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run test/read-laporan.test.js test/detail-laporan-template.test.js test/read-dashboard.test.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/read/laporan.js public/detail-laporan.html test/read-laporan.test.js test/detail-laporan-template.test.js
git commit -m "chore(laporan): remove legacy Diterima status"
```

---

### Task 3: Perbaiki teks email tanda terima bridge GAS

**Files:**
- Modify: `new-code1/3_drive_bridge.gs:149, 169`

**Interfaces:**
- Produces: label email `Link Berkas ACC` (menggantikan `Link ACC INHAL`) pada plain text & HTML.

- [ ] **Step 1: Ubah baris plain text (`:149`)**

```js
        'Link Berkas ACC: ' + accUrl,
```

- [ ] **Step 2: Ubah baris HTML (`:169`)**

```js
        'Link Berkas ACC: <a href="' + accUrl + '" target="_blank">' + accUrl + '</a>',
```

- [ ] **Step 3: Verifikasi tidak ada sisa teks lama**

Run: `rg -n "Link ACC INHAL" new-code1/3_drive_bridge.gs`
Expected: tidak ada hasil.

- [ ] **Step 4: Commit**

```bash
git add new-code1/3_drive_bridge.gs
git commit -m "fix(bridge): rename receipt email link label"
```

- [ ] **Step 5: Deploy bridge (manual oleh user)**

Buka editor Apps Script proyek bridge, tempel ulang `3_drive_bridge.gs`, lalu **Deploy > Manage deployments > Edit > New version > Deploy**. Tanpa langkah ini perubahan teks belum berlaku di produksi.

---

### Task 4: Verifikasi menyeluruh

- [ ] **Step 1: Jalankan seluruh suite**

Run: `npm test`
Expected: seluruh tes PASS.

- [ ] **Step 2: Pastikan tidak ada sisa status `Diterima` di produksi kode**

Run: `rg -n "Diterima" src public`
Expected: tidak ada hasil (kecuali penjelasan/komentar historis; hapus bila ada).

- [ ] **Step 3: Pastikan tes lama tetap hijau**

Run: `npx vitest run`
Expected: seluruh file tes PASS.

- [ ] **Step 4: Commit (bila ada sisa penyesuaian)**

```bash
git add -A
git commit -m "chore: final sweep after laporan + bridge fixes"
```

---

## Catatan Deploy (manual oleh user)

```bash
cd /workspace/new-code1-cf
CLOUDFLARE_API_TOKEN="$(cat /root/.cf_token)" npx wrangler deploy
```

Bridge GAS: deploy manual dari editor Apps Script (lihat Task 3 Step 5).

## Asumsi yang Perlu Dikonfirmasi

- **Semantik "final" laporan.** Plan ini mengartikan "laporan pakai keanggotaan final BA" sebagai: peserta unit dianggap **final** bila terdaftar di BA Pelaksanaan (`berita_acara_peserta`), menggantikan patokan `link_final`. Bila maksudnya lain (mis. `link_final` ATAU masuk BA), sesuaikan `computeUnitProgress` dan tes.
- **Teks email bridge.** Plan ini mengganti `Link ACC INHAL` → `Link Berkas ACC`. Bila label lain yang diinginkan, ganti di Task 3.

## Self-Review

- **Spec coverage:** keanggotaan BA untuk `final` (Task 1); sapu status `Diterima` server + UI (Task 2); teks email bridge (Task 3); verifikasi (Task 4).
- **Placeholder scan:** tidak ada TODO; setiap langkah berisi kode/perintah.
- **Type consistency:** `masukBa` boolean konsisten di `laporan.js` & `kegiatan.js`; `summary.totalAcc` konsisten setelah `totalDiterima` dihapus.
