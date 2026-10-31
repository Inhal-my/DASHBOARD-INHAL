/**
 * Penulisan sheet ringkasan.
 *
 * `bk_ringkasan` berisi pasangan kunci–nilai dari manifest, `bk_tabel` berisi
 * rincian jumlah baris per tabel. Keduanya hanya berisi metadata (tanpa data
 * pribadi), jadi aman dibagikan ke pengelola.
 */

var LAST_MANIFEST_KEY = 'LAST_MANIFEST_ID';

function ensureSheet(name, header) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (header && header.length) {
    var first = sheet.getRange(1, 1, 1, header.length).getValues()[0];
    var kosong = first.every(function (v) { return v === '' || v === null; });
    if (kosong) {
      sheet.getRange(1, 1, 1, header.length).setValues([header]);
      sheet.getRange(1, 1, 1, header.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

/** Menulis ulang isi sheet dengan header + baris + catatan di bawah tabel. */
function writeTable(name, header, rows, note) {
  var sheet = ensureSheet(name, header);
  sheet.clear();
  var cols = header.length;
  var values = [header].concat(rows || []);
  sheet.getRange(1, 1, values.length, cols).setValues(values);
  sheet.getRange(1, 1, 1, cols).setFontWeight('bold');
  sheet.setFrozenRows(1);
  if (note) sheet.getRange(values.length + 2, 1).setValue(note);
  return sheet;
}

function lastManifestId() {
  try {
    return String(PropertiesService.getScriptProperties().getProperty(LAST_MANIFEST_KEY) || '');
  } catch (err) {
    return '';
  }
}

function rememberManifestId(fileId) {
  try {
    PropertiesService.getScriptProperties().setProperty(LAST_MANIFEST_KEY, String(fileId || ''));
  } catch (err) {
    // Properti gagal disimpan bukan alasan menggagalkan pembacaan manifest.
  }
}

/** Meminta fileId manifest, dengan tawaran memakai manifest terakhir. */
function promptManifestId(ui) {
  var last = lastManifestId();
  var pesan = last
    ? 'fileId manifest.json (kosongkan untuk memakai manifest terakhir: ' + last + '):'
    : 'fileId manifest.json (unduh dari artefak backup atau Drive):';
  var jawab = ui.prompt('Manifest backup', pesan, ui.ButtonSet.OK_CANCEL);
  if (jawab.getSelectedButton() !== ui.Button.OK) return '';
  var id = String(jawab.getResponseText() || '').trim();
  return id || last;
}

function showSummary() {
  assertAllowed();
  var ui = SpreadsheetApp.getUi();
  var fileId = promptManifestId(ui);
  if (!fileId) return;

  var manifest = manifestFromDrive(fileId);
  rememberManifestId(fileId);

  writeTable(SHEET_SUMMARY, ['Kunci', 'Nilai'], manifestSummaryRows(manifest),
    'Sumber: manifest.json (metadata saja, tanpa data pribadi). Dibuat oleh scripts/backup-snapshot.mjs.');
  writeTable('bk_tabel', ['Tabel', 'Baris', 'Kolom', 'Ukuran CSV', 'Ketersediaan'], manifestTableRows(manifest),
    'Kolom "Baris" berasal dari manifest; angka ini yang dipakai untuk membandingkan hasil restore.');

  var ringkas = 'Label ' + manifest.label + '\nTotal baris: ' + manifest.totalRows +
    '\nIntegritas: ' + (manifest.integrity || '-') +
    '\nPeringatan: ' + (manifest.warnings.length ? manifest.warnings.length : 0);
  ui.alert('Ringkasan dimuat', ringkas, ui.ButtonSet.OK);
}
