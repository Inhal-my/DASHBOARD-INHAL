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

describe('bagian workspace v2 — shell', () => {
  it('compiles without Vue template errors', async () => {
    installDocumentStub();
    const html = await loadBagianHtml();
    compile(extractAppTemplate(html), {
      onError: (e) => { throw new Error(e.message); },
      onWarn: (w) => { throw new Error('warn: ' + w.message); }
    });
  });

  it('memakai empat menu final tanpa menu Peserta', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain("activeTab: 'ringkasan'");
    expect(html).toContain("label: 'Ringkasan'");
    expect(html).toContain("label: 'Jadwal'");
    expect(html).toContain("label: 'Berita Acara'");
    expect(html).toContain("label: 'Riwayat'");
    expect(html).not.toContain('<h2 class="text-base font-bold text-slate-900">Daftar Peserta</h2>');
  });

  it('menyediakan top nav desktop, bottom nav, dan FAB', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('class="top-nav"');
    expect(html).toContain('class="bottom-nav"');
    expect(html).toContain('class="fab"');
    expect(html).toContain('aria-current');
    expect(html).toContain('@media (min-width: 940px)');
    expect(html).toContain('@media (max-width: 939.98px)');
  });

  it('menampilkan kartu Ringkasan', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('Total Peserta');
    expect(html).toContain('Belum Dijadwalkan');
    expect(html).toContain('Draft BA');
    expect(html).toContain('BA Selesai');
    expect(html).toContain('Perlu Tindakan');
    expect(html).toContain('Kelengkapan per Blok');
    expect(html).toContain('Jadwal Terdekat');
    expect(html).toContain("setTab('ba', { filter: 'draft' })");
  });

  it('memuat helper bagian-state sebelum app-common', async () => {
    const html = await loadBagianHtml();
    const stateAt = html.indexOf('<script src="/bagian-state.js"></script>');
    const commonAt = html.indexOf('<script src="/app-common.js"></script>');
    expect(stateAt).toBeGreaterThan(-1);
    expect(commonAt).toBeGreaterThan(stateAt);
  });
});

describe('bagian workspace v2 — jadwal', () => {
  it('memakai split workspace dan panel detail bersama', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('workspace--split');
    expect(html).toContain('class="ws-detail"');
    expect(html).toContain('detail-back');
    expect(html).toContain('visibleJadwalItems');
    expect(html).toContain('selectItem(item.kind, item.key)');
  });

  it('menyediakan aksi dan form jadwal di panel detail', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('startJadwalForGroup');
    expect(html).toContain('jadwalFormGroup');
    expect(html).toContain('startFirstPendingJadwal');
    expect(html).toContain('Buat Jadwal');
    expect(html).toContain('Simpan Jadwal');
  });

  it('menampilkan sisa peserta yang belum terjadwal', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('jadwalPendingGroups');
    expect(html).toContain('unscheduledPeserta');
  });
});

describe('bagian workspace v2 — berita acara', () => {
  it('menampilkan antrean BA tanpa BA selesai', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('baWorkItems');
    expect(html).toContain('visibleBaItems');
    expect(html).toContain("baTabFilter==='draft'");
    expect(html).toContain('Belum dibuat');
  });

  it('menyediakan aksi Buat BA dan Lengkapi', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('goCreateBa');
    expect(html).toContain('Lengkapi');
    expect(html).toContain('saveDraftBa');
    expect(html).toContain('editDraftBa');
  });

  it('menghapus modal lengkapi lama dan merender form draft inline', async () => {
    const html = await loadBagianHtml();
    expect(html).not.toContain('<!-- ===== LENGKAPI DRAFT BA ===== -->');
    expect(html).not.toContain('lengkapiDraft(');
    expect(html).toContain('Simpan &amp; Lengkapi');
  });
});

describe('bagian workspace v2 — riwayat', () => {
  it('menampilkan arsip BA lengkap dengan pencarian dan filter Blok', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('riwayatItems');
    expect(html).toContain('visibleRiwayatItems');
    expect(html).toContain('riwayat-table');
    expect(html).toContain('riwayat-cards');
    expect(html).toContain('blokOptions');
  });

  it('membuka detail read-only dari Riwayat', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain("selectItem('ba', item.key)");
    expect(html).toContain('Buka File BA');
    expect(html).toContain('Belum ada BA lengkap');
  });
});

describe('bagian workspace v2 — guard dan kebersihan', () => {
  it('menyediakan guard buang perubahan', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('confirmDiscard');
    expect(html).toContain('hasFormContent');
    expect(html).toContain('Perubahan belum disimpan. Tinggalkan?');
  });

  it('polling berhenti saat form terbuka', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('this.jadwal.open');
    expect(html).toContain('this.ba.lengkapi');
    expect(html).not.toContain('loadBaList');
  });

  it('menutup form tanpa prompt setelah simpan sukses', async () => {
    const html = await loadBagianHtml();
    expect(html).toMatch(/if \(res\.success\) \{\s*this\.formDirty = false;\s*this\.closeDetail\(\);/);
    expect(html).toContain('if (this.loading) return;');
  });

  it('menutup detail yang datanya hilang setelah refresh', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('ensureSelection');
    expect(html).toContain('Data sudah diperbarui.');
  });
});

describe('bagian workspace v2 - sumber peserta BA Pendukung', () => {
  it('menyediakan saklar sumber Dari BA Pendukung di form BA', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('Dari BA Pendukung');
    expect(html).toContain('togglePendukungSource');
    expect(html).toContain('mergeBaCandidates');
    expect(html).toContain('baCandidates.peserta');
  });

  it('menampilkan alasan peserta BA Pendukung dilewati', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('baCandidates.jumlahTambahan');
    expect(html).toContain('baCandidates.jumlahDitolak');
    expect(html).toContain('baCandidates.jumlahTidakSesuai');
  });

  it('menyediakan koreksi peserta dan berkas di panel draft BA', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('lengkapiCandidates');
    expect(html).toContain('toggleLengkapiPendukung');
    expect(html).toContain('onLengkapiFile');
    expect(html).toContain('lengkapiPesertaBerubah');
  });

  it('menandai BA draft tanpa berkas dan menyediakan hapus draft', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain('Berkas BA belum ada');
    expect(html).toContain('Unggah Berkas');
    expect(html).toContain('deleteDraftBa');
    expect(html).toContain('deleteDraftBeritaAcaraBagian');
    expect(html).toContain('Hapus Draft');
  });
});
