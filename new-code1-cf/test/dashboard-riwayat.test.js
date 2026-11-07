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

async function loadDashboardHtml() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/dashboard.html'));
  expect(res.status).toBe(200);
  return res.text();
}

function riwayatSection(html) {
  const start = html.indexOf("<!-- ============ TAB: RIWAYAT ============ -->");
  const end = html.indexOf("<!-- ============ DRAWER: DETAIL AKTIVITAS ============ -->");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end);
}

describe('tab Riwayat', () => {
  it('template tetap valid setelah menambah tab', async () => {
    installDocumentStub();
    const html = await loadDashboardHtml();
    const errors = [];
    compile(extractAppTemplate(html), {
      onError: (e) => errors.push(e.message),
      onWarn: (w) => errors.push('warn: ' + w.message)
    });
    expect(errors).toEqual([]);
  });

  it('mendaftarkan tab riwayat setelah Master Data', async () => {
    const html = await loadDashboardHtml();
    expect(html).toContain("const TAB_KEYS = ['pengajuan', 'manual', 'stats', 'ba', 'master', 'riwayat']");
    const nav = html.slice(html.indexOf('navItems() {'), html.indexOf('statusChips() {'));
    expect(nav).toContain("key: 'master', icon: 'bi-sliders', label: 'Master Data'");
    expect(nav).toContain("key: 'riwayat', icon: 'bi-clock-history', label: 'Riwayat'");
    expect(nav.indexOf("label: 'Riwayat'")).toBeGreaterThan(nav.indexOf("label: 'Master Data'"));
    expect(html).toContain("if (tab === 'riwayat' && !this.loaded.riwayat) this.loadActivity();");
  });

  it('memuat feed per hari, filter, chip, pager, ekspor, dan drawer', async () => {
    const html = await loadDashboardHtml();
    const sec = riwayatSection(html);
    expect(sec).toContain('Riwayat Aktivitas');
    expect(sec).toContain('@click="exportActivityLog()"');
    expect(sec).toContain('v-model="act.filters.dari"');
    expect(sec).toContain('v-model="act.filters.sampai"');
    expect(sec).toContain('v-model="act.filters.aktor"');
    expect(sec).toContain('v-model="act.filters.jenis"');
    expect(sec).toContain('v-model="act.filters.q"');
    expect(sec).toContain('applyActivityFilter()');
    expect(sec).toContain('resetActivityFilter()');
    expect(sec).toContain('v-for="g in act.groups"');
    expect(sec).toContain('setActivityGroup(g.key)');
    expect(sec).toContain('class="act-day"');
    expect(sec).toContain('class="act-item"');
    expect(sec).toContain('openActivity(e)');
    expect(sec).toContain('goActivityPage(act.page - 1)');
    expect(sec).toContain('goActivityPage(act.page + 1)');
    expect(html).toContain('Detail Aktivitas');
    expect(html).toContain('activityDiffRows(act.detail.e)');
    expect(html).toContain('activityRawText(act.detail.e)');
    expect(html).toContain('closeActivityDetail()');
  });

  it('tidak menyediakan tombol aksi tulis di tab riwayat', async () => {
    const html = await loadDashboardHtml();
    const sec = riwayatSection(html);
    for (const marker of ['updatePengajuan', 'deletePengajuan', 'updateBeritaAcara', 'saveMaster', 'verifyPembayaran']) {
      expect(sec).not.toContain(marker);
    }
  });

  it('memakai helper berargumen sebagai methods', async () => {
    const html = await loadDashboardHtml();
    const computedStart = html.indexOf('computed: {');
    const watchStart = html.indexOf('watch: {', computedStart);
    const computedBlock = html.slice(computedStart, watchStart);
    expect(computedBlock).not.toMatch(/\n {16}activity[A-Za-z]*\s*\([^)]/);
    for (const name of ['activityLabel', 'activityBadge', 'activityDot', 'activityClock', 'activityMetaRows', 'activityDiffRows', 'activityDayKey']) {
      expect(html).toMatch(new RegExp('\\n\\s+' + name + '\\s*\\([^)]'));
    }
  });
});
