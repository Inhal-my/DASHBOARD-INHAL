import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const indexHtml = readFileSync(new URL('../pages/index.html', import.meta.url), 'utf8');
const portalHtml = readFileSync(new URL('../pages/portal.html', import.meta.url), 'utf8');
const appCommonHtml = readFileSync(new URL('../pages/_app-common.html', import.meta.url), 'utf8');

describe('index template parity', () => {
  it('memakai salinan CF dan tetap memakai google.script.run', () => {
    assert.match(indexHtml, /Pengajuan INHAL/);
    assert.match(indexHtml, /Cek status di Pengajuan INHAL/);
    assert.match(indexHtml, /google\.script\.run/);
    assert.match(indexHtml, /const APP_URL = '<\?= appUrl \?>';/);
  });

  it('membatasi ukuran berkas sebelum upload', () => {
    assert.match(indexHtml, /MAX_UPLOAD_FILE_BYTES/);
    assert.match(indexHtml, /onFileSurat[\s\S]*f\.size > MAX_UPLOAD_FILE_BYTES/);
  });

  it('memberi key pada opsi select', () => {
    assert.match(indexHtml, /v-for="b in options\.blok" :key="b"/);
    assert.match(indexHtml, /v-for="o in options\.kegiatanLab" :key="o"/);
  });
});

describe('portal template parity', () => {
  it('memuat AppCommon dan memakai safeUrl untuk tautan final', () => {
    assert.match(portalHtml, /include\('pages\/_app-common'\)/);
    assert.match(portalHtml, /:href="safeUrl\(detailItem\.linkFinal\)"/);
    assert.match(appCommonHtml, /root\.AppCommon/);
    assert.match(appCommonHtml, /function safeUrl/);
  });

  it('hanya mengunggah bukti bayar dan mengirim npm', () => {
    assert.doesNotMatch(portalHtml, /Upload ACC INHAL/);
    assert.doesNotMatch(portalHtml, /upload\.accFile/);
    assert.match(portalHtml, /if \(!this\.upload\.buktiFile\)/);
    assert.match(portalHtml, /npm: \(this\.user && this\.user\.npm\) \|\| ''/);
    assert.doesNotMatch(portalHtml, /accFile:/);
  });

  it('mempertahankan status Diterima dan menyembunyikan fitur jadwal CF', () => {
    assert.match(portalHtml, /s\.indexOf\('diterima'\)/);
    assert.doesNotMatch(portalHtml, /detailItem\.jadwal/);
    assert.doesNotMatch(portalHtml, /uploadResetAt/);
  });

  it('memakai format tanggal AppCommon dan guard ukuran berkas', () => {
    assert.match(portalHtml, /AppCommon\.formatTanggal/);
    assert.match(portalHtml, /AppCommon\.formatTanggalWaktu/);
    assert.match(portalHtml, /uploadFileSizeError/);
  });
});
