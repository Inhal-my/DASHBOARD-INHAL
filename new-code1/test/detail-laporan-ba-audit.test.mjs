import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../pages/detail-laporan.html', import.meta.url), 'utf8');

describe('detail laporan pemeriksaan BA pelaksanaan', () => {
  it('menyimpan data audit dari bootstrap', () => {
    assert.match(html, /baAudit: \{ rows: \[\], summary: \{\} \}/);
    assert.match(html, /this\.baAudit = data\.baAudit \|\| \{ rows: \[\], summary: \{\} \}/);
  });
  it('mempunyai helper audit', () => {
    assert.match(html, /baAuditRows\(\)/);
    assert.match(html, /baAuditSummary\(\)/);
    assert.match(html, /baAuditExportRows\(\)/);
    assert.match(html, /baAuditGroupFor\(/);
    assert.match(html, /baAuditSessions\(/);
    assert.match(html, /baAuditSessionFor\(/);
  });
  it('menampilkan panel pemeriksaan dan ekspor', () => {
    assert.match(html, /Pemeriksaan BA Pelaksanaan/);
    assert.match(html, /exportBaAudit\(\)/);
    assert.match(html, /'Pemeriksaan BA'/);
    assert.match(html, /Multi-sesi/);
  });
  it('menambah filter dan kolom status sesi pada daftar BA', () => {
    assert.match(html, /baListFilter: \{ bagian: '', jenis: '', dosen: '', sumber: '', kelengkapan: '', sesi: '' \}/);
    assert.match(html, /<label class="label">Status Sesi<\/label>/);
    assert.match(html, /r\.statusSesi/);
    assert.match(html, /r\.sesiKe/);
    assert.match(html, /Kemungkinan duplikat/);
  });

  it('helper sesi berparameter berada di methods, bukan computed', () => {
    const computed = html.slice(html.lastIndexOf('computed: {'), html.lastIndexOf('methods: {'));
    const methods = html.slice(html.lastIndexOf('methods: {'));
    assert.doesNotMatch(computed, /baAuditGroupFor\(g\)\s*\{/);
    assert.doesNotMatch(computed, /baAuditSessions\(g\)\s*\{/);
    assert.doesNotMatch(computed, /baAuditSessionFor\(baId\)\s*\{/);
    assert.match(methods, /baAuditGroupFor\(g\)\s*\{/);
    assert.match(methods, /baAuditSessions\(g\)\s*\{/);
    assert.match(methods, /baAuditSessionFor\(baId\)\s*\{/);
  });
});
