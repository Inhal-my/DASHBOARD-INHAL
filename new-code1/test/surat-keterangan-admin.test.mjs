import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const business = readFileSync(new URL('../1_business.gs', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../pages/dashboard.html', import.meta.url), 'utf8');

describe('Upload Surat Keterangan oleh admin', () => {
  it('menyediakan backend unggah surat keterangan', () => {
    assert.match(business, /function uploadSuratKeterangan\(/);
    assert.match(business, /uploadSuratKeterangan[\s\S]*?requireAdmin\(/);
    assert.match(business, /uploadSuratKeterangan[\s\S]*?'Link Surat Keterangan'/);
    assert.match(business, /uploadSuratKeterangan[\s\S]*?_saveFileToDrive/);
  });

  it('menampilkan form unggah surat di detail pengajuan', () => {
    assert.match(dashboard, /onSuratFile/);
    assert.match(dashboard, /uploadSurat\(/);
    assert.match(dashboard, /uploadSuratKeterangan/);
    assert.match(dashboard, /suratFile/);
  });
});
