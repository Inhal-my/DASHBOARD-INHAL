import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const code = readFileSync(new URL('../0_code.gs', import.meta.url), 'utf8');
const business = readFileSync(new URL('../1_business.gs', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../pages/dashboard.html', import.meta.url), 'utf8');

describe('Kelola Unggahan GAS', () => {
  it('menyimpan jejak reset unggahan pada pengajuan', () => {
    assert.match(code, /'Upload Reset At'/);
    assert.match(code, /'Upload Reset By'/);
    assert.match(code, /'Upload Reset Note'/);
  });

  it('menyediakan monitor dan reset unggahan khusus admin', () => {
    assert.match(business, /function getUploadMonitor\(/);
    assert.match(business, /function resetUploadBukti\(/);
    assert.match(business, /function resetUploadBukti\([\s\S]*?requireAdmin\(/);
    assert.match(business, /resetUploadBukti[\s\S]*?'Upload Reset At'/);
    assert.match(business, /resetUploadBukti[\s\S]*?'Link ACC INHAL': ''/);
    assert.match(business, /resetUploadBukti[\s\S]*?appendRowSafe\('LogUpload'/);
    assert.match(business, /resetUploadBukti[\s\S]*?action: 'RESET_UPLOAD'/);
  });

  it('menampilkan tab Kelola Unggahan di dashboard', () => {
    assert.match(dashboard, /key: 'kelolaUnggahan'/);
    assert.match(dashboard, /loadUploadMonitor/);
    assert.match(dashboard, /uploadMonitorRows/);
    assert.match(dashboard, /canResetUpload/);
    assert.match(dashboard, /confirmResetUpload/);
    assert.match(dashboard, /resetUploadBukti/);
  });
});
