import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../pages/dashboard.html', import.meta.url), 'utf8');

describe('dashboard pemeriksaan BA pelaksanaan', () => {
  it('mempunyai state audit', () => {
    assert.match(html, /baAudit: \{ summary: \{\} \}/);
    assert.match(html, /auditExpanded: \{\}/);
  });
  it('mempunyai helper dan aksi audit', () => {
    assert.match(html, /bagianAuditRows\(\)/);
    assert.match(html, /bagianAuditSummary\(\)/);
    assert.match(html, /bagianAuditExportRows\(\)/);
    assert.match(html, /toggleBagianAudit\(key\)/);
    assert.match(html, /exportBagianAudit\(\)/);
  });
  it('menampilkan panel dan chip multi-sesi', () => {
    assert.match(html, /Pemeriksaan BA Pelaksanaan/);
    assert.match(html, /@click="setBagianChip\('multi'\)"/);
    assert.match(html, /Pemeriksaan BA/);
  });
});
