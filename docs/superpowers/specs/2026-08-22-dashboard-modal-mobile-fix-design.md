# Desain: Perbaikan Modal Mobile di `dashboard.html`

Tanggal: 2026-08-22
Status: Disetujui user (22 Agu 2026)

## Latar Belakang

Di handphone (Chrome & Brave), modal di tab Berita Acara dan tab Pengajuan pada halaman `dashboard.html` tampak "terlalu full": bagian bawah konten modal tidak terlihat dan tidak bisa digeser ke atas. User meminta analisis lalu perbaikan, dengan target responsif untuk **semua ukuran layar** (HP kecil 320px, HP standar 360-412px, tablet, desktop) tanpa merusak tampilan desktop.

### Akar Masalah

1. **Modal lebih tinggi dari layar + centering flexbox.** Semua overlay memakai `fixed inset-0 flex items-center justify-center`. Saat isi modal (khususnya form Upload BA) lebih tinggi dari viewport, flexbox memusatkannya → bagian atas keluar layar dan bagian bawah keluar layar. Karena panel Upload BA (baris 1069-1072) dan Konfirmasi BA (baris 649-652) **tidak punya `max-height` maupun internal scroll**, bagian bawah (termasuk tombol aksi) tidak bisa dijangkau.
2. **`vh` ≠ tinggi layar HP yang terlihat.** Di Chrome/Brave mobile, `100vh` menghitung viewport penuh termasuk area yang tertutup URL bar. `max-h-[92vh]` / `max-h-[88vh]` yang dipakai Detail Pengajuan (895) dan Master Data (1030) bisa lebih tinggi dari area yang benar-benar terlihat → bagian bawah tertutup URL bar, dan karena panel `position: fixed`, scroll halaman tidak bisa menjangkaunya. Unit yang benar untuk layar dinamis adalah `dvh`.
3. **Tidak ada scroll-lock body.** Saat modal terbuka, background ikut ter-scroll, memperparah kesan "geser atas-bawah".

### Struktur Modal Saat Ini

| Modal | Baris | Panel saat ini | Body scroll |
|---|---|---|---|
| Detail Pengajuan | 892-895 | `relative flex max-h-[92vh] ... flex-col overflow-hidden` | `flex-1 overflow-y-auto` (ada) |
| Master Data | 1027-1030 | `relative flex max-h-[88vh] ... flex-col overflow-hidden` | `flex-1 overflow-y-auto` (ada) |
| Upload BA | 1069-1072 | `relative w-full max-w-xl overflow-hidden` (tanpa max-h) | **tidak ada** |
| Konfirmasi BA | 649-652 | `relative w-full max-w-lg overflow-hidden` (tanpa max-h) | **tidak ada** |

Catatan: compiled CSS Tailwind sudah punya `items-start`, `overflow-y-auto`, `shrink-0`, tetapi **tidak** punya kelas `100dvh`, `my-auto`, `m-auto`, `max-h-full`, `overscroll-contain`. Kelas baru harus ditulis sebagai CSS custom di blok `<style>` (pola yang sama seperti kelas skeleton pada task loading-speed).

## Solusi (Pendekatan C — CSS + scroll-lock body)

Ganti pola centering `items-center justify-center` (yang memotong konten lebih tinggi dari viewport) dengan pola **overlay scrollable + panel `margin:auto`**, lalu beri setiap modal body internal-scroll dan kunci scroll body via JS saat modal terbuka.

### 1. CSS custom di blok `<style>` (setelah baris 55)

```css
.modal-overlay {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 1rem;
    overflow-y: auto;
    overscroll-behavior: contain;
}
.modal-panel {
    position: relative;
    width: 100%;
    max-height: calc(100vh - 2rem);   /* fallback browser lama */
    max-height: calc(100dvh - 2rem);  /* mobile: ikuti tinggi viewport dinamis */
    margin: auto;                     /* pusat vertikal saat pendek; menempel atas saat tinggi */
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 1rem;
    background: #fff;
}
.modal-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
}
```

**Mengapa `margin: auto`:** saat panel lebih pendek dari layar → tampil di tengah (perilaku sama seperti `items-center` sekarang); saat lebih tinggi → margin mengecil ke 0 sehingga panel menempel ke atas dan **bisa di-scroll** karena overlay punya `overflow-y: auto`. Ini menghapus masalah "atas & bawah terpotong, tidak bisa digeser".

**`100dvh` fallback:** deklarasi `max-height: calc(100vh - 2rem)` ditulis dulu, lalu `calc(100dvh - 2rem)` setelahnya; browser lama yang tidak mengenal `dvh` mengabaikan deklarasi kedua.

### 2. Perubahan markup per modal

**Penting — urutan CSS:** blok compiled Tailwind (baris 66) muncul *setelah* blok `<style>` custom (baris 11-55). Dengan specificity yang sama, kelas Tailwind menimpa kelas custom. Oleh karena itu overlay harus **menghapus** `flex items-center justify-center p-4` (digantikan kelas `modal-overlay`), dan panel harus **menghapus** kelas layout yang nilainya diatur ulang oleh `modal-panel` (`relative w-full flex flex-col overflow-hidden rounded-2xl bg-white`).

| Modal | Overlay | Panel | Body |
|---|---|---|---|
| Detail Pengajuan (892) | `fixed inset-0 z-50 modal-overlay` (hapus `flex items-center justify-center p-4`) | `modal-panel max-w-4xl shadow-lift` | `modal-body px-6 py-5` (mengganti `flex-1 overflow-y-auto`) |
| Master Data (1027) | `fixed inset-0 z-50 modal-overlay` | `modal-panel max-w-3xl shadow-lift` | `modal-body px-6 py-4` |
| Upload BA (1069) | `fixed inset-0 z-50 modal-overlay` | `modal-panel max-w-xl shadow-lift` | `modal-body px-6 py-4` (baru dapat scroll) |
| Konfirmasi BA (649) | `fixed inset-0 z-50 modal-overlay` | `modal-panel max-w-lg shadow-lift` | `modal-body px-6 py-4` |

Serta tambahkan `shrink-0` pada header dan footer tiap modal agar tidak mengecil saat body scroll.

Aturan kelas yang digunakan:
- Overlay: `fixed inset-0 z-50` (Tailwind) + `modal-overlay`; kelas `flex items-center justify-center p-4` dihapus.
- Panel: `modal-panel` + `max-w-*` + `shadow-lift`; kelas layout lama dihapus.
- Body: `modal-body` + padding; `flex-1 overflow-y-auto` dihapus.
- Header/footer: `shrink-0` + padding yang sudah ada.

### 3. Scroll-lock body via JS (Vue app, dekat `computed:` baris 1216)

```js
computed: {
    // ...yang sudah ada...
    anyModalOpen() {
        return !!(this.detail.open || this.ba.modal || this.master.modal || this.bab.ba.confirm);
    }
},
watch: {
    anyModalOpen(open) {
        document.body.style.overflow = open ? 'hidden' : '';
    }
}
```

- Saat salah satu dari 4 modal terbuka → `body { overflow: hidden }` (background tidak ikut scroll).
- Saat semua modal tertutup → overflow dikembalikan `''`.
- Watcher memantau gabungan keempat state, aman jika ada modal terbuka di atas modal lain.
- Tidak perlu sentuh lifecycle `unmounted`; jika user refresh halaman saat modal terbuka, state modal hilang dan overflow kembali normal otomatis.

## Cakupan & Batasan

- Hanya `new-code1/pages/dashboard.html` yang berubah.
- Modal yang diperbaiki: Detail Pengajuan, Master Data, Upload BA, Konfirmasi BA.
- Overlay loading (`v-if="loading"`, baris 74) dan overlay sidebar (`v-if="sidebarOpen"`, baris 124) **tidak** diubah — bukan bagian dari masalah yang dilaporkan.
- Tidak mengubah logika data, payload, atau endpoint.

## Pengujian & Verifikasi

Halaman ini PHP (`<?= ... ?>`), pengujian lewat deploy-website lalu manual di browser.

1. **Verifikasi statis:** tag balance (4 `transition` + 4 overlay tetap utuh); tidak ada kelas lama tertinggal (`items-center justify-center` di 4 modal, `max-h-[88vh]`, `max-h-[92vh]`).
2. **Responsif (DevTools):** 320px, 375px, 414px, dan desktop ≥1024px.
3. **Skenario tiap modal:**
   - Detail Pengajuan & Master Data → panel tidak melebihi layar, body scroll internal jalan, footer selalu terlihat.
   - Upload BA → dengan isi form panjang, **bagian bawah (tombol Upload) dapat digeser**, tidak terpotong.
   - Konfirmasi BA → daftar peserta panjang bisa scroll, tombol Batal/Upload terlihat.
4. **Scroll-lock:** saat modal terbuka background tidak ikut scroll; setelah tutup scroll kembali normal.
5. **HP asli (Chrome/Brave):** verifikasi ulang di perangkat user — kriteria sukses utama.

**Kriteria sukses:** semua konten modal dapat dijangkau (termasuk bagian bawah), background terkunci saat modal terbuka, tidak ada regresi di desktop.
