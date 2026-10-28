import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

async function loadHtml() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/detail-laporan.html'));
  expect(res.status).toBe(200);
  return res.text();
}

function block(html, startNeedle, endNeedle) {
  const start = html.indexOf(startNeedle);
  expect(start, `anchor tidak ditemukan: ${startNeedle}`).toBeGreaterThan(-1);
  const end = html.indexOf(endNeedle, start);
  expect(end, `anchor akhir tidak ditemukan: ${endNeedle}`).toBeGreaterThan(start);
  return html.slice(start, end);
}

describe('paginasi tabel detail laporan: state & helper', () => {
  it('menyediakan state pagers untuk setiap tabel', async () => {
    const html = await loadHtml();
    for (const key of ['rekap', 'dosen', 'bagian', 'bagianMatrix', 'baKegiatan', 'baAudit',
      'daftarba', 'jadwal', 'bayarTabel', 'bayarAntrean', 'bayarSelisih']) {
      expect(html, key).toContain(`${key}: { page: 1, perPage: 10 }`);
    }
  });

  it('menyediakan helper paginasi di methods', async () => {
    const html = await loadHtml();
    for (const name of ['pagerState(key) {', 'pagerInfo(key, total) {', 'pagerRows(key, rows) {',
      'pagerItems(key, total) {', 'pagerGo(key, page, total, pages) {',
      'pagerSetPerPage(key, value) {', 'resetPagers() {']) {
      expect(html, name).toContain(name);
    }
  });

  it('mendaftarkan komponen pager-bar', async () => {
    const html = await loadHtml();
    expect(html).toContain('const PagerBar = {');
    expect(html).toContain('components: { ExpandedDetail, PagerBar },');
    expect(html).toContain("emits: ['go', 'size'],");
  });

  it('menyediakan opsi jumlah per halaman termasuk Semua', async () => {
    const html = await loadHtml();
    for (const s of ['10 / halaman', '25 / halaman', '50 / halaman', '100 / halaman', '>Semua<']) {
      expect(html, s).toContain(s);
    }
    expect(html).toContain('const allowed = [0, 10, 25, 50, 100];');
  });
});

describe('paginasi tabel detail laporan: pemakaian per tabel', () => {
  it('memotong daftar tabel utama lewat pagerRows', async () => {
    const html = await loadHtml();
    for (const key of ['rekap', 'dosen', 'bagianMatrix', 'baKegiatan', 'baAudit',
      'daftarba', 'jadwal', 'bayarTabel', 'bayarAntrean', 'bayarSelisih']) {
      expect(html, key).toContain(`pagerRows('${key}'`);
    }
  });

  it('memasang pager-bar pada setiap tabel', async () => {
    const html = await loadHtml();
    for (const id of ['rekap', 'dosen', 'bagian', 'bagianMatrix', 'baKegiatan', 'baAudit',
      'daftarba', 'jadwal', 'bayarTabel', 'bayarAntrean', 'bayarSelisih']) {
      expect(html, id).toContain(`id="pg-${id}"`);
    }
  });

  it('memakai satu state pager untuk tabel desktop dan kartu mobile', async () => {
    const html = await loadHtml();
    expect(html).toContain(`<template v-for="r in pagerRows('rekap', filteredRows)"`);
    expect(html).toContain(`<article v-for="r in pagerRows('rekap', filteredRows)"`);
    expect(html).toContain(`<article v-for="r in pagerRows('daftarba', filteredDaftarBa)"`);
    expect(html).toContain(`<article v-for="r in pagerRows('jadwal', jadwalRealisasiFiltered)"`);
    expect(html).toContain(`<article v-for="it in pagerRows('bayarTabel', pembayaranFiltered)"`);
  });

  it('tidak memotong tampilan papan kanban', async () => {
    const html = await loadHtml();
    expect(html).toContain('v-for="it in bayarColumnItems(col.key)"');
  });
});

describe('paginasi tabel detail laporan: pengelompokan bagian', () => {
  it('memaginasi per blok bagian, bukan potongan mentah', async () => {
    const html = await loadHtml();
    for (const name of ['bagianDetailBlocks() {', 'bagianPageSlices() {', 'bagianPageInfo() {', 'bagianPagedSections() {']) {
      expect(html, name).toContain(name);
    }
    expect(html).toContain('<template v-for="s in bagianPagedSections"');
    expect(html).not.toContain("pagerRows('bagian',");
    expect(html).toContain(`@go="pagerGo('bagian', $event, bagianDetailRows.length, bagianPageInfo.pages)"`);
  });

  it('tetap menampilkan subtotal dan grand total', async () => {
    const html = await loadHtml();
    const table = block(html, '<template v-for="s in bagianPagedSections"', '</table>');
    expect(table).toContain('bagianDetailGrandTotal');
    expect(table).toContain('bagianDetailPesertaTotal');
    expect(block(html, 'bagianDetailBlocks() {', 'bagianPageSlices() {')).toContain("type: 'subtotal'");
    expect(block(html, 'bagianPagedSections() {', 'bagianDetailGrandTotal() {')).toContain('sections.push(b.subtotal)');
  });
});

describe('paginasi tabel detail laporan: baris total matriks', () => {
  it('baris Total matriks tetap di luar potongan', async () => {
    const html = await loadHtml();
    const dosen = block(html, "pagerRows('dosen', dosenMatrix.rows)", '</table>');
    expect(dosen).toContain('dosenMatrix.grandTotal');
    const matrix = block(html, "pagerRows('bagianMatrix', bagianMatrixRows)", '</table>');
    expect(matrix).toContain('matrixGrandTotal');
  });
});

describe('paginasi tabel detail laporan: export & ringkasan utuh', () => {
  it('computed/ringkasan tidak memakai baris yang sudah dipotong', async () => {
    const html = await loadHtml();
    const appStart = html.indexOf('const app = createApp({');
    const computedStart = html.indexOf('computed: {', appStart);
    const methodsStart = html.indexOf('methods: {', computedStart);
    const computedBlock = html.slice(computedStart, methodsStart);
    expect(computedBlock).toContain('baAuditExportRows() {');
    expect(computedBlock).not.toContain('pagerRows(');
  });

  it('export memakai data terfilter penuh', async () => {
    const html = await loadHtml();
    const daftarBa = block(html, 'exportDaftarBa() {', 'exportBaAudit() {');
    expect(daftarBa).toContain('filteredDaftarBa');
    expect(daftarBa).not.toContain('pagerRows(');
    const baTable = block(html, 'exportBaTable() {', 'exportDaftarBa() {');
    expect(baTable).toContain('baKegiatanRows');
    expect(baTable).not.toContain('pagerRows(');
    const dosen = block(html, 'exportDosenMatrix() {', 'baReportRows(filter, q) {');
    expect(dosen).toContain('dosenMatrix');
    expect(dosen).not.toContain('pagerRows(');
  });
});

describe('paginasi tabel detail laporan: reset saat filter berubah', () => {
  it('watcher filter global mereset halaman', async () => {
    const html = await loadHtml();
    const watch = block(html, 'watch: {', 'methods: {');
    expect(watch).toContain("'filters.search': function () { this.activeDosenCell = null; this.resetPagers(); }");
    expect(watch).toContain("'filters.blok': function () {");
    expect((watch.match(/this\.resetPagers\(\);/g) || []).length).toBeGreaterThanOrEqual(5);
  });

  it('watcher filter per tab mereset pager terkait', async () => {
    const html = await loadHtml();
    const watch = block(html, 'watch: {', 'methods: {');
    for (const key of ['bagian', 'bagianMatrix', 'dosen', 'baKegiatan', 'baAudit',
      'daftarba', 'jadwal', 'bayarTabel', 'bayarAntrean', 'bayarSelisih']) {
      expect(watch, key).toContain(`this.pagers.${key}.page = 1;`);
    }
    expect(watch).toContain('deep: true');
  });

  it('reset filter global juga mereset semua pager', async () => {
    const html = await loadHtml();
    const reset = block(html, 'resetGlobalFilters() {', 'animateNumbers() {');
    expect(reset).toContain('this.resetPagers();');
  });
});

describe('paginasi tabel detail laporan: tampilan & aksesibilitas', () => {
  it('menyediakan CSS pager dan menyembunyikannya saat cetak', async () => {
    const html = await loadHtml();
    for (const s of ['.in-pager-bar {', '.in-pager {', '.in-pager-size {', '.in-pager button.is-active {']) {
      expect(html, s).toContain(s);
    }
    expect(html).toContain('@media print { .in-pager-bar { display:none !important; } }');
  });

  it('memberi label aksesibel pada navigasi halaman', async () => {
    const html = await loadHtml();
    const component = block(html, 'const PagerBar = {', 'const { createApp } = Vue;');
    expect(component).toContain('<nav class="in-pager" role="navigation" :aria-label="navLabel">');
    expect(component).toContain(':aria-current="p === meta.page ? \'page\' : null"');
    expect(component).toContain('aria-label="Halaman sebelumnya"');
    expect(component).toContain('aria-label="Halaman berikutnya"');
    expect(component).toContain('aria-label="Jumlah baris per halaman"');
    expect(component).toContain('Menampilkan {{ meta.start }}–{{ meta.end }} dari {{ meta.total }} {{ unit }}');
  });

  it('menyembunyikan pager bila data sedikit', async () => {
    const html = await loadHtml();
    const component = block(html, 'const PagerBar = {', 'const { createApp } = Vue;');
    expect(component).toContain('<div v-if="meta.total > 10" class="in-pager-bar">');
  });

  it('menggulir ke tabel setelah pindah halaman', async () => {
    const html = await loadHtml();
    const go = block(html, 'pagerGo(key, page, total, pages) {', 'pagerSetPerPage(key, value) {');
    expect(go).toContain("document.getElementById('pg-' + key)");
    expect(go).toContain('scrollIntoView');
  });
});