import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const gs = readFileSync(new URL('../1_business.gs', import.meta.url), 'utf8');
const bagianHtml = readFileSync(new URL('../pages/bagian.html', import.meta.url), 'utf8');

describe('bagian BA Pendukung admin (read-only)', () => {
  it('membaca BA Pendukung dari BeritaAcaraAdmin pada bootstrap bagian', () => {
    assert.match(gs, /function _computeBaPendukungList\(bagianFilter, kategori\)/);
    assert.match(gs, /_getRowsCachedOptional\('BeritaAcaraAdmin'\)/);
    assert.match(gs, /_getBaPesertaMapAdmin\(\)/);
    assert.match(gs, /_resolveBagian12\(r\.Bagian, '', r\['Nama Kegiatan'\], labs\)/);
    assert.match(gs, /out\.baPendukungList = _computeBaPendukungList\(/);
    assert.match(gs, /baPendukungList: \[\]/);
  });

  it('menampilkan BA Pendukung sebagai informasi read-only di tab BA', () => {
    assert.match(bagianHtml, /baPendukungList: \[\]/);
    assert.match(bagianHtml, /baPendukungFor\(ref\)/);
    assert.match(bagianHtml, /item && item\.kind === 'ba'/);
    assert.match(bagianHtml, /BA Pendukung belum ada/);
    assert.match(bagianHtml, /Belum diunggah admin dashboard/);
    assert.match(bagianHtml, /baPendukungList = res\.baPendukungList/);
    assert.match(bagianHtml, /baPendukungList: this\.baPendukungList/);
    assert.doesNotMatch(bagianHtml, /uploadBeritaAcaraAdmin/);
  });
});
