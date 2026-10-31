/**
 * INHAL Backup Reader (tahap 1 — berbasis manifest).
 *
 * Pembaca darurat berbasis Google Apps Script untuk arsip cadangan D1 INHAL.
 * Tahap 1 sengaja HANYA membaca `manifest.json` (jumlah baris, hash, ukuran,
 * status ambang) sehingga tidak ada data pribadi yang dibaca maupun disimpan.
 *
 * Aturan yang tidak boleh dilanggar (lihat docs/ops/arsitektur-dan-failover.md):
 *   1. hanya membaca — tidak ada penulisan ke database mana pun;
 *   2. terpisah dari bridge produksi (`GAS_DRIVE_URL`);
 *   3. tidak menyimpan kredensial admin.
 *
 * Restore database TIDAK dilakukan dari Apps Script; skrip ini hanya menyiapkan
 * runbook dan mencatat bukti drill.
 */

var READER_VERSION = '1.0.0';
var MENU_TITLE = '🛡️ INHAL Backup';
var SHEET_SUMMARY = 'bk_ringkasan';
var SHEET_COMPARE = 'bk_banding';
var SHEET_CHECKLIST = 'bk_restore';
var SHEET_AUDIT = 'bk_audit';

function onOpen() {
  try {
    installMenu(SpreadsheetApp.getUi());
  } catch (err) {
    // onOpen juga berjalan di konteks tanpa UI (mis. trigger waktu).
  }
}

function showAbout() {
  var ui = SpreadsheetApp.getUi();
  var rows = aboutRows({
    version: READER_VERSION,
    email: currentUserEmail(),
    allowlist: allowlistPatterns(),
    manifestFile: ''
  });
  var text = rows.map(function (row) { return row[0] + ': ' + row[1]; }).join('\n');
  ui.alert('INHAL Backup Reader', text + '\n\nTahap 1 hanya membaca manifest.json (tanpa data pribadi).', ui.ButtonSet.OK);
}

function currentUserEmail() {
  try {
    return String(Session.getEffectiveUser().getEmail() || '');
  } catch (err) {
    return '';
  }
}
