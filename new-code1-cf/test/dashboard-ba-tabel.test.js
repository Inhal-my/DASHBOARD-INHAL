import { env } from 'cloudflare:test';
import { compile } from '@vue/compiler-dom';
import { describe, it, expect } from 'vitest';

async function loadHtml() {
  const res = await env.ASSETS.fetch(new Request('http://local/dashboard.html'));
  return res.text();
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

function scriptBlock(html) {
  const start = html.indexOf('computed: {');
  const watchStart = html.indexOf('watch: {', start);
  const methodsStart = html.indexOf('methods: {', watchStart);
  return {
    computed: html.slice(start, watchStart),
    watch: html.slice(watchStart, methodsStart),
    methods: html.slice(methodsStart)
  };
}

describe('dashboard tabel Kelengkapan per Blok', () => {
  it('template tetap valid', async () => {
    installDocumentStub();
    const html = await loadHtml();
    const errors = [];
    compile(extractAppTemplate(html), { onError: (e) => errors.push(e) });
    expect(errors).toEqual([]);
  });

  it('memakai 8 kolom ringkas dengan kolom kegiatan sticky', async () => {
    const html = await loadHtml();
    for (const s of [
      '<th class="lead cursor-pointer p-3"',
      '<th class="p-3">Tanggal · Realisasi</th>',
      '<th class="p-3">BA Pendukung</th>',
      '<th class="p-3">Keputusan</th>',
      '<th class="p-3">BA Pelaksanaan</th>',
      '<th class="p-3">Progres</th>',
      '<th class="p-3">Dosen</th>',
      '<th class="p-3">Aksi</th>',
      '<td class="lead min-w-[220px] p-3">',
      '<td colspan="8" class="p-4">'
    ]) {
      expect(html).toContain(s);
    }
    expect(html).not.toContain('<td class="whitespace-nowrap p-3 text-xs text-slate-500">');
    expect(html).toContain('.ba-tbl th.lead, .ba-tbl td.lead { position: sticky; left: 0;');
    expect(html).toContain('<div class="ba-scroll hidden md:block">');
  });

  it('tanggal tampil dua per baris plus chip realisasi ekstra', async () => {
    const html = await loadHtml();
    expect(html).toContain('.ba-date-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(html).toContain('class="ba-date-grid"');
    expect(html).toContain(":class=\"{ 'is-ok': d.ada }\"");
    expect(html).toContain('class="ba-date-extra"');
    expect(html).toContain('r.__tanggal.rencana');
    expect(html).toContain('r.__tanggal.ekstra');
    expect(html).toContain('{{ r.__tanggal.total }} sesi');
  });

  it('dosen diringkas dua nama dengan penanda sisa', async () => {
    const html = await loadHtml();
    expect(html).toContain('dosenRingkas(');
    expect(html).toContain('tampil: list.slice(0, 2),');
    expect(html).toContain('sisa: Math.max(0, list.length - 2),');
    expect(html).toContain('r.__dosen.tampil');
    expect(html).toContain('r.__dosen.sisa');
  });

  it('menyediakan paginasi dengan ukuran halaman', async () => {
    const html = await loadHtml();
    for (const s of [
      'page: 1, perPage: 10',
      'bagianPageInfo() {',
      'bagianPagedRows() {',
      'bagianPageList() {',
      'bagianSetPage(p) {',
      'bagianSetPerPage(v) {',
      'v-for="r in bagianPagedRows"',
      'class="ba-pager-bar ba-pager-desk"',
      'class="ba-pager-bar ba-pager-mob"',
      'Menampilkan {{ bagianPageInfo.start }}–{{ bagianPageInfo.end }} dari {{ bagianPageInfo.n }} kegiatan'
    ]) {
      expect(html).toContain(s);
    }
    expect(html).toContain('.ba-pager button.is-active { background: #4f46e5;');
    expect(html).toContain('.ba-pager-size {');
    expect(html).toContain('.ba-pager-bar.ba-pager-desk { display: none; }');
  });

  it('filter pencarian ikut mempersempit daftar dan mereset halaman', async () => {
    const html = await loadHtml();
    expect(html).toContain('v-model="bagian.q"');
    expect(html).toContain('placeholder="Cari kegiatan, bagian, blok, kode BA, atau dosen…"');
    expect(html).toContain('class="input ba-select"');
    expect(html).toContain('resetBagianFilter');
    expect(html).toContain('const q = this.normBagian(this.bagian.q);');
    expect(html).toContain('if (q) units = units.filter(u => this.unitMatchesQuery(u, q));');
    const { watch } = scriptBlock(html);
    for (const key of ["'bagian.q'()", "'bagian.fBagian'()", "'bagian.fBlok'()", "'bagian.perPage'()", "'bagianPageInfo.pages'(pages)"]) {
      expect(watch).toContain(key);
    }
    expect(watch).toContain('this.bagian.page = 1;');
    expect(html).toContain('if (this.bagian.page > pages) this.bagian.page = pages;');
  });

  it('paginasi memotong baris sesuai halaman aktif', async () => {
    const html = await loadHtml();
    expect(html).toContain('const pages = Math.max(1, Math.ceil(n / perPage));');
    expect(html).toContain('const page = Math.min(Math.max(1, Number(this.bagian.page) || 1), pages);');
    expect(html).toContain('return this.bagianTableRows.slice(from, from + info.perPage);');
    expect(html).toContain('this.bagian.perPage = [10, 25, 50, 100].indexOf(n) !== -1 ? n : 10;');
    expect(html).toContain('start: n ? (page - 1) * perPage + 1 : 0,');
    expect(html).toContain('end: Math.min(page * perPage, n)');
  });

  it('helper berargumen tetap methods, bukan computed', async () => {
    const html = await loadHtml();
    const { computed, methods } = scriptBlock(html);
    const parameterized = computed.match(/\n {16}[A-Za-z_$][A-Za-z0-9_$]*\s*\([^)]/g) || [];
    expect(parameterized).toEqual([]);
    expect(methods).toMatch(/\n\s+tanggalSesiInfo\s*\(r\)/);
    expect(methods).toMatch(/\n\s+dosenRingkas\s*\(r\)/);
    expect(html).toContain('__tanggal: this.tanggalSesiInfo(r),');
    expect(html).toContain('__dosen: this.dosenRingkas(r)');
  });

  it('kartu mobile memakai data dan pager yang sama', async () => {
    const html = await loadHtml();
    expect(html).toContain('<div v-for="r in bagianPagedRows" :key="\'m\' + r.key" class="p-4">');
    expect(html).toContain('class="ba-date-grid mt-2"');
    expect(html).toContain("{{ unitHasPendukung(r) ? 'BA Pendukung ada' : 'BA Pendukung belum' }}");
    expect(html).toContain("{{ unitHasPelaksanaan(r) ? 'BA Pelaksanaan ada' : 'BA Pelaksanaan belum' }}");
  });
});