import { env } from 'cloudflare:test';
import { compile } from '@vue/compiler-dom';
import { describe, it, expect } from 'vitest';

function extractAppTemplate(html) {
  const start = html.indexOf('<div id="app"');
  const scriptStart = html.indexOf('<script src="/gs-shim.js"', start);
  const slice = html.slice(start, scriptStart === -1 ? html.length : scriptStart);
  const re = /<div\b|<\/div>/g;
  let depth = 0, end = -1, m;
  while ((m = re.exec(slice))) {
    if (m[0] === '</div>') { depth -= 1; if (depth === 0) { end = re.lastIndex; break; } }
    else depth += 1;
  }
  return slice.slice(0, end);
}
function installDocumentStub() {
  if (globalThis.document) return;
  globalThis.document = {
    createElement: () => ({ _html: '', set innerHTML(v) { this._html = String(v); }, get innerHTML() { return this._html; }, get textContent() { return this._html; }, get children() { const match = this._html.match(/^<div foo="([\s\S]*)">$/); const value = match ? match[1] : this._html; return [{ getAttribute: () => value }]; } })
  };
}
async function loadBagianHtml() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/bagian.html'));
  return res.text();
}
function kalenderSection(html) {
  const start = html.indexOf('<!-- ===== KALENDER LINTAS BAGIAN');
  const end = html.indexOf('<!-- ===== WORKSPACE ===== -->');
  return html.slice(start, end);
}
function kalenderModal(html) {
  const start = html.indexOf('<!-- ===== DETAIL KALENDER');
  const end = html.indexOf('<!-- ===== KONFIRMASI BERITA ACARA');
  return html.slice(start, end);
}

describe('bagian template kalender', () => {
  it('compiles tanpa error template Vue', async () => {
    installDocumentStub();
    const html = await loadBagianHtml();
    const errors = [];
    compile(extractAppTemplate(html), { onError: (e) => errors.push(e.message), onWarn: (w) => errors.push('warn: ' + w.message) });
    expect(errors).toEqual([]);
  });

  it('menambahkan menu Kalender dan tab read-only', async () => {
    const html = await loadBagianHtml();
    expect(html).toContain("{ id: 'kalender', label: 'Kalender'");
    expect(html).toContain("activeTab==='kalender'");
    expect(html).toContain('Kalender Pelaksanaan');
    expect(html).toContain('Read-only');
    expect(html).toContain('getKalenderBagianPelaksanaan');
    expect(html).toContain('ensureKalender()');
  });

  it('memuat navigasi bulan, filter bagian, grid, dan agenda', async () => {
    const html = await loadBagianHtml();
    const section = kalenderSection(html);
    expect(section).toContain('kalenderPrev');
    expect(section).toContain('kalenderNext');
    expect(section).toContain('kalenderToday');
    expect(section).toContain('kalenderMonthLabel');
    expect(section).toContain('kalenderBagianOptions');
    expect(section).toContain('setKalenderFilter(');
    expect(section).toContain('kalenderLegend');
    expect(section).toContain('kal-grid');
    expect(section).toContain('kalenderCells');
    expect(section).toContain('kalenderAgenda');
    expect(section).toContain('kalenderWeekday(');
    expect(section).toContain('kalenderMonthCount');
  });

  it('tidak menyediakan aksi edit di dalam kalender', async () => {
    const html = await loadBagianHtml();
    const section = kalenderSection(html);
    expect(section.length).toBeGreaterThan(500);
    ['saveJadwalPelaksanaan', 'cancelJadwalPelaksanaan', 'Buat Jadwal', 'v-model="jadwal.', 'openBaPicker'].forEach((needle) => {
      expect(section).not.toContain(needle);
    });
    expect(section).toContain('buka menu');
  });

  it('menampilkan nama peserta hanya untuk jadwal bagian sendiri', async () => {
    const html = await loadBagianHtml();
    const modal = kalenderModal(html);
    // Peserta dirender dari jadwalList klien, dijaga oleh kalenderOwnEvent.
    expect(modal).toContain('kalenderPeserta(kalender.selected)');
    expect(modal).toContain('kalenderOwnEvent(kalender.selected)');
    expect(modal).toContain('Rincian nama hanya tersedia di halaman bagian');
    expect(html).toContain('kalenderPeserta(ev) {');
    expect(html).toContain('sortKalenderPeserta');
    // Tetap tanpa aksi edit di dalam modal kalender.
    expect(modal).not.toContain('saveJadwalPelaksanaan');
    expect(modal).not.toContain('toggleJadwalPeserta');
  });

  it('membuka detail event lewat modal read-only', async () => {
    const html = await loadBagianHtml();
    const modal = kalenderModal(html);
    expect(modal.length).toBeGreaterThan(500);
    expect(modal).toContain('kalender.selected');
    expect(modal).toContain('closeKalenderEvent');
    expect(modal).toContain('openKalenderEventInJadwal');
    expect(modal).toContain('Kalender bersifat hanya baca');
    expect(modal).not.toContain('saveJadwalPelaksanaan');
    expect(modal).not.toContain('cancelJadwalPelaksanaan');
  });
});