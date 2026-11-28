import { env } from 'cloudflare:test';
import { compile } from '@vue/compiler-dom';
import { describe, it, expect } from 'vitest';

function extractAppTemplate(html) {
  const start = html.indexOf('<div id="app"');
  if (start === -1) throw new Error('#app root not found');
  const scriptStart = html.indexOf('<script src="/gs-shim.js"', start);
  const slice = html.slice(start, scriptStart === -1 ? html.length : scriptStart);
  const re = /<div\b|<\/div>/g;
  let depth = 0;
  let end = -1;
  let m;
  while ((m = re.exec(slice))) {
    if (m[0] === '</div>') {
      depth -= 1;
      if (depth === 0) { end = re.lastIndex; break; }
    } else {
      depth += 1;
    }
  }
  if (end === -1) throw new Error('#app root close not found');
  return slice.slice(0, end);
}

function installDocumentStub() {
  if (globalThis.document) return;
  globalThis.document = {
    createElement: () => {
      const el = {
        _html: '',
        set innerHTML(v) { this._html = String(v); },
        get innerHTML() { return this._html; },
        get textContent() { return this._html; },
        get children() {
          const match = this._html.match(/^<div foo="([\s\S]*)">$/);
          const value = match ? match[1] : this._html;
          return [{ getAttribute: () => value }];
        }
      };
      return el;
    }
  };
}

async function loadBagianHtml() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/bagian.html'));
  expect(res.status).toBe(200);
  return res.text();
}

describe('bagian template', () => {
  it('compiles without Vue template errors', async () => {
    installDocumentStub();
    const html = await loadBagianHtml();
    const template = extractAppTemplate(html);
    const errors = [];
    compile(template, {
      onError: (e) => errors.push(e.message),
      onWarn: (w) => errors.push('warn: ' + w.message)
    });
    expect(errors).toEqual([]);
  });

  it('shell melebar penuh dengan konten mengisi viewport', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('class="flex min-h-screen w-full flex-col bg-slate-50"');
    expect(html).toContain('mx-auto flex min-h-screen w-full max-w-md flex-col');
    expect(html).toContain('flex h-14 w-full items-center justify-between px-4 sm:px-6 md:px-8');
    expect(html).toContain('<div class="w-full">');
  });

  it('memakai shell workspace dengan bottom nav', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('class="space-y-5"');
    expect(html).toContain('class="workspace"');
    expect(html).toContain('class="bottom-nav"');
  });

  it('kartu Upload BA hanya tampil pada tab Berita Acara', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain(`v-if="activeTab==='ba'" class="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100"`);
  });

  it('input file BA punya tombol pilih file yang terlihat dan target sentuh cukup', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('ref="baFile"');
    expect(html).toContain('Pilih File PDF');
    expect(html).toContain('class="hidden" @change="onBaFile"');
    expect(html).not.toContain('text-[11px] text-transparent');
  });

  it('konfirmasi upload tetap terbuka dan menampilkan progres sampai selesai', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('Mengunggah file... mohon tunggu.');
    expect(html).toContain(':disabled="loading" @click="ba.confirm=false"');
    const start = html.indexOf('async doUploadBa()');
    const end = html.indexOf('async doUploadBa()') + 1800;
    const body = html.slice(start, end);
    expect(body).not.toContain('this.ba.confirm = false;\n                    this.loading = true;');
    expect(body).toContain('const fileEl = this.$refs.baFile;');
  });

  it('menampilkan BA Pendukung admin sebagai informasi read-only', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('baPendukungList');
    expect(html).toContain('selectedPendukung');
    expect(html).toContain('BA Pendukung belum ada');
    expect(html).toContain('Belum diunggah admin dashboard.');
    expect(html).toContain('rel="noopener noreferrer" class="font-semibold text-indigo-600 hover:underline" @click.stop');
  });
});

describe('notifikasi peserta disetujui', () => {
  it('menempatkan lonceng sebelum tombol Keluar tanpa kata di-ACC', async () => {
    const html = await loadBagianHtml();
    const bell = html.indexOf('class="ntf-bell"');
    const logout = html.indexOf('> Keluar');
    expect(bell).toBeGreaterThan(-1);
    expect(logout).toBeGreaterThan(bell);
    expect(html).toContain('aria-label="Notifikasi peserta disetujui');
    expect(html).toContain('Peserta disetujui');
    expect(html).not.toContain('di-ACC');
  });

  it('menyediakan tab, badge, dan aksi tandai semua dibaca', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('notifTabs');
    expect(html).toContain('Belum dibaca');
    expect(html).toContain('Tandai semua dibaca');
    expect(html).toContain('markAllNotifRead');
    expect(html).toContain('ntf-badge');
  });

  it('memakai format tanggal dan jam WIB, bukan label relatif', async () => {
    const html = await loadBagianHtml();
    const start = html.indexOf('function notifTime(v)');
    expect(start).toBeGreaterThan(-1);
    const body = html.slice(start, start + 900);
    expect(html).toContain('const WIB_OFFSET_MS = 7 * 60 * 60 * 1000');
    expect(body).toContain('WIB');
    expect(body).toContain('BULAN_SINGKAT');
    expect(html).not.toContain('Kemarin');
  });

  it('menyimpan status dibaca di localStorage dan memuat dari bootstrap', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('inhal_bagian_notif_read');
    expect(html).toContain('loadNotifRead');
    expect(html).toContain('res.notifikasiList');
    expect(html).toContain('notifikasiList: this.notifikasiList');
  });
});

describe('guard BA Pelaksanaan multi', () => {
  it('menyediakan input label dan menyaring baMember', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('ba.label');
    expect(html).toContain('/bagian-state.js');
    expect(html).not.toContain('Diterima / ACC');
  });
});

describe('dosen searchable picker', () => {
  it('memakai komponen dosen-picker dan bukan input teks bebas', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('/dosen-picker.js');
    expect(html).toContain('<dosen-picker v-model="jadwal.dosenList[i]"');
    expect(html).toContain('<dosen-picker v-model="ba.lengkapi.dosenList[i]"');
    expect(html).toContain('<dosen-picker v-model="ba.dosenList[i]"');
    expect(html).toContain('DosenPicker.install(app)');
    expect(html).not.toContain('@input="dosenPick.jadwal = i"');
    expect(html).not.toContain('@input="dosenPick.lengkapi = i"');
    expect(html).not.toContain('@input="dosenPick.ba = i"');
  });
});

describe('panduan jadwal dan BA Pelaksanaan', () => {
  it('menampilkan panduan lengkap di bawah halaman', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('Panduan Jadwal &amp; Berita Acara');
    expect(html).toContain('Cara membuat jadwal');
    expect(html).toContain('Cara membuat BA Pelaksanaan');
    expect(html).toContain('Teknis memilih peserta');
    expect(html).toContain('Peserta dari beda ajuan');
    expect(html).toContain('tanggal BA wajib sama dengan tanggal sesi paling awal');
    expect(html).toContain('bagian, blok, dan nama kegiatan sama');
    expect(html).toContain('Buat BA terpisah untuk masing-masing kegiatan/blok');
    expect(html).toContain('Jadwal lewat tanpa BA');
    expect(html).toContain('sesi paling awal yang belum punya BA');
    expect(html).toContain('Peserta yang belum punya jadwal tampil di bagian');
    expect(html).toContain('peserta belum dijadwalkan tetap tercentang');
    expect(html).toContain('simpan diblokir sampai satu sesi dipilih');
  });
});

describe('peringatan validasi form jadwal dan BA', () => {
  it('menampilkan checklist pemeriksaan dan pesan field pada form jadwal', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('Pemeriksaan sebelum simpan');
    expect(html).toContain('jadwalChecks');
    expect(html).toContain('jadwalFieldIssue');
    expect(html).toContain('Tanggal ini sudah lewat');
    expect(html).toContain('Dosen belum diisi. BA Pelaksanaan nanti wajib memilih dosen.');
    expect(html).toContain(`class="input" :class="{ 'field-invalid': !!jadwalFieldIssue.tanggal }"`);
  });

  it('menampilkan checklist pemeriksaan dan pesan field pada form BA', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('Pemeriksaan sebelum upload');
    expect(html).toContain('baChecks');
    expect(html).toContain('baFieldIssue');
    expect(html).toContain('Tanggal BA harus sama dengan tanggal sesi paling awal');
    expect(html).toContain('Semua peserta satu blok dan berstatus');
    expect(html).toContain('Berkas BA (PDF) tersedia');
    expect(html).toContain(`class="input" :class="{ 'field-invalid': !!baFieldIssue.tanggal }"`);
  });

  it('menampilkan ringkasan multi-sesi di konfirmasi upload', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('BA mencakup {{ baSessionsSelected.length }} sesi.');
    expect(html).toContain('Tanggal BA mengikuti sesi paling awal');
  });

  it('menampilkan checklist ringkas saat melengkapi draft BA', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('lengkapiChecks');
    expect(html).toContain('lengkapiCheckState');
  });
});

describe('edit BA selesai di Riwayat', () => {
  it('menyediakan tombol Edit di samping Buka File BA dan form edit', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('Buka File BA');
    expect(html).toContain('@click="startEditBa"');
    expect(html).toContain('Edit Berita Acara');
    expect(html).toContain('Simpan Perubahan');
    expect(html).toContain('ba.editingSelesai');
  });

  it('memakai flag reopenBaId agar seleksi BA tidak tereset setelah simpan', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('reopenBaId');
    expect(html).toContain('cancelEditBa');
  });
});

describe('auto-jadwal peserta belum dijadwalkan', () => {
  it('menampilkan bagian peserta belum dijadwalkan dan mengirim flag auto-jadwal', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('Belum dijadwalkan');
    expect(html).toContain('baUnscheduled');
    expect(html).toContain('baUnscheduledSelected');
    expect(html).toContain('baPesertaTerjadwal');
    expect(html).toContain('autoJadwalkanBelumDijadwalkan');
    expect(html).toContain('Akan otomatis dijadwalkan ke sesi paling awal yang dipilih');
  });

  it('memakai sesi paling awal yang belum punya BA saat membuka BA dari grup', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('earliestBaSession');
    expect(html).toContain('applySessionToggleWithRelease');
  });
});

describe('penghematan rows read (Level 0A)', () => {
  it('memakai interval polling 5 menit dan konstanta TTL/idle', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('const CACHE_TTL_MS = 5 * 60 * 1000;');
    expect(html).toContain('const POLL_INTERVAL_MS = 5 * 60 * 1000;');
    expect(html).toContain('const IDLE_STOP_MS = 30 * 60 * 1000;');
    expect(html).toContain('setInterval(() => this.silentRefresh(), POLL_INTERVAL_MS)');
    expect(html).not.toContain('setInterval(() => this.silentRefresh(), 30000)');
  });

  it('menghentikan polling saat tab tersembunyi dan melewati fetch bila cache masih segar', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain("document.addEventListener('visibilitychange', this.visibilityHandler)");
    expect(html).toContain('if (document.hidden) {');
    expect(html).toContain('if (this.cacheFresh()) return;');
    expect(html).toContain('if (Date.now() - this.lastActivityAt > IDLE_STOP_MS)');
  });

  it('menyimpan dan membaca cap waktu cache untuk perbandingan TTL', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('cacheTs: 0');
    expect(html).toContain('this.cacheTs = Date.now();');
    expect(html).toContain('this.cacheTs = Number(cached.ts) || 0;');
    expect(html).toContain('cacheFresh() {');
  });

  it('melepas listener polling saat komponen dibongkar', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('this.stopPolling();\n                this.unbindLifecycle();');
    expect(html).toContain("document.removeEventListener('visibilitychange', this.visibilityHandler)");
  });
});
