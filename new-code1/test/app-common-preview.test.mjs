import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../pages/_app-common.html', import.meta.url), 'utf8');

describe('partial bersama preview bukti', () => {
  it('mengekspor helper drive dan mixin', () => {
    assert.match(html, /driveFileId: driveFileId/);
    assert.match(html, /driveThumbUrl: driveThumbUrl/);
    assert.match(html, /buktiPreview: BUKTI_PREVIEW/);
    assert.match(html, /buktiPreviewMixin: buktiPreviewMixin/);
  });
  it('thumbnail drive memakai endpoint thumbnail', () => {
    assert.match(html, /drive\.google\.com\/thumbnail\?id=/);
    assert.match(html, /sz=w/);
  });
  it('posisi kiri lalu kanan lalu bawah/atas', () => {
    assert.match(html, /placement = 'left'/);
    assert.match(html, /placement = 'right'/);
    assert.match(html, /placement = 'above'/);
    assert.match(html, /BUKTI_PREVIEW\.maxWidth/);
  });
  it('event viewport non-Node tidak memanggil contains', () => {
    assert.match(html, /typeof target\.nodeType === 'number'/);
    assert.match(html, /const target = event && event\.target;/);
  });
  it('hanya aktif untuk pointer mouse presisi', () => {
    assert.match(html, /pointerType !== 'mouse'/);
    assert.match(html, /\(hover: hover\) and \(pointer: fine\)/);
  });
  it('menyertakan CSS preview dan ikon BA', () => {
    assert.match(html, /\.bukti-preview \{ position: fixed/);
    assert.match(html, /\.ba-ic\.is-p/);
    assert.match(html, /\.ba-menu \{ position: fixed/);
  });
});
