/**
 * Handler menu tahap 2: impor CSV dari folder privat, telusuri, cek hash,
 * dan paket restore. Semua penulisan hanya ke spreadsheet ini (tidak ada
 * penulisan ke Drive maupun ke D1).
 */

var IMPORT_STATE_KEY = 'IMPORT_STATE';
var IMPORT_TIME_BUDGET_MS = 4 * 60 * 1000;

function findLabelFolder(name) {
  var wanted = String(name || '').trim();
  if (!wanted) throw new Error('Label arsip kosong.');
  var folders = listLabelFolders();
  for (var i = 0; i < folders.length; i++) {
    if (folders[i].name === wanted) return folders[i];
  }
  throw new Error('Subfolder label "' + wanted + '" tidak ada di folder arsip.');
}

function loadImportState() {
  var raw = '';
  try {
    raw = String(PropertiesService.getScriptProperties().getProperty(IMPORT_STATE_KEY) || '');
  } catch (err) {
    raw = '';
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function saveImportState(state) {
  try {
    PropertiesService.getScriptProperties().setProperty(IMPORT_STATE_KEY, JSON.stringify(state || {}));
  } catch (err) {
    // state gagal disimpan tidak boleh menggagalkan impor yang sudah tertulis
  }
}

function clearImportState() {
  try {
    PropertiesService.getScriptProperties().deleteProperty(IMPORT_STATE_KEY);
  } catch (err) {
    // abaikan
  }
}

/**
 * Mengimpor satu tabel CSV ke sheet `bk_<tabel>` mulai baris tertentu.
 * Mengembalikan { sheet, written, nextOffset, total }.
 */
function importTableSlice(label, folderId, entry, offset, limit) {
  var file = findFileInFolder(folderId, entry.file || (entry.table + '.csv'));
  if (!file) throw new Error('Berkas CSV tidak ditemukan: ' + entry.table);
  var parsed = csvToTable(readFileText(file.getId()));
  var start = Math.max(0, Number(offset) || 0);
  var size = Math.max(1, Number(limit) || CSV_ROWS_PER_RUN);
  var slice = parsed.rows.slice(start, start + size);
  var name = sheetNameForTable(entry.table);
  var sheet = ensureSheet(name, parsed.header);
  if (start === 0) {
    writeTable(name, parsed.header, [], 'Diimpor dari arsip ' + label + ' (' + entry.table + ').');
    sheet = ensureSheet(name, parsed.header);
  }
  if (slice.length) {
    sheet.getRange(2 + start, 1, slice.length, parsed.header.length).setValues(slice);
  }
  return { sheet: name, written: slice.length, nextOffset: start + slice.length, total: parsed.rows.length };
}

/**
 * Mengimpor seluruh tabel sebuah label, dicicil sampai batas waktu eksekusi.
 * state: { label, folderId, tableIndex, rowOffset, imported, skipped }
 */
function importLabel(label, opts) {
  var o = opts || {};
  var folder = findLabelFolder(label);
  var manifest = readManifestFile(folder.id);
  if (!manifest || !manifest.rows.length) {
    throw new Error('manifest.csv tidak ditemukan/kosong di folder ' + label + '.');
  }

  var plan = planImportJobs(manifest.rows, o);
  var state = loadImportState();
  if (!state || state.label !== label) {
    state = { label: label, folderId: folder.id, tableIndex: 0, rowOffset: 0, imported: 0, skipped: plan.skipped };
  }
  state.folderId = folder.id;

  var started = Date.now();
  var budget = Number(o.timeBudgetMs) > 0 ? Number(o.timeBudgetMs) : IMPORT_TIME_BUDGET_MS;
  var chunk = Number(o.rowsPerRun) > 0 ? Number(o.rowsPerRun) : CSV_ROWS_PER_RUN;

  while (state.tableIndex < plan.jobs.length && (Date.now() - started) < budget) {
    var job = plan.jobs[state.tableIndex];
    var done = importTableSlice(label, folder.id, job, state.rowOffset, chunk);
    state.rowOffset = done.nextOffset;
    state.imported += done.written;
    if (state.rowOffset >= done.total) {
      state.tableIndex += 1;
      state.rowOffset = 0;
    }
  }

  saveImportState(state);
  var remaining = 0;
  for (var i = state.tableIndex; i < plan.jobs.length; i++) {
    remaining += Math.max(0, plan.jobs[i].totalRows - (i === state.tableIndex ? state.rowOffset : 0));
  }
  return {
    label: label,
    imported: state.imported,
    remaining: remaining,
    done: state.tableIndex >= plan.jobs.length,
    skipped: plan.skipped || []
  };
}

/** Ringkasan hasil impor untuk dialog. */
function importSummaryText(result) {
  var r = result || {};
  var lines = [];
  lines.push('Label: ' + (r.label || '-'));
  lines.push('Baris diimpor: ' + (r.imported || 0));
  lines.push('Sisa baris: ' + (r.remaining || 0));
  if (r.done) lines.push('Status: SELESAI');
  else lines.push('Status: belum selesai - jalankan menu "Lanjutkan Impor"');
  if (r.skipped && r.skipped.length) {
    lines.push('Dilewati: ' + r.skipped.map(function (s) { return s.table; }).join(', '));
  }
  return lines.join('\n');
}

/** Menu: Impor CSV… */
function showImportCsv() {
  assertAllowed();
  var ui = SpreadsheetApp.getUi();
  var folders = listLabelFolders();
  if (!folders.length) {
    ui.alert('Folder arsip kosong', 'Tidak ada subfolder label di CSV_ROOT_FOLDER_ID.', ui.ButtonSet.OK);
    return;
  }
  var daftar = folders.slice(0, 10).map(function (f) { return f.name; }).join('\n');
  var jawab = ui.prompt('Impor CSV', 'Label arsip (subfolder) yang diimpor:\n' + daftar, ui.ButtonSet.OK_CANCEL);
  if (jawab.getSelectedButton() !== ui.Button.OK) return;
  var label = String(jawab.getResponseText() || '').trim() || (folders[0] && folders[0].name);
  var result = importLabel(label, {});
  ui.alert('Impor CSV', importSummaryText(result), ui.ButtonSet.OK);
}

/** Menu: Lanjutkan Impor */
function showResumeImport() {
  assertAllowed();
  var ui = SpreadsheetApp.getUi();
  var state = loadImportState();
  if (!state || !state.label) {
    ui.alert('Lanjutkan Impor', 'Tidak ada impor yang tertunda.', ui.ButtonSet.OK);
    return;
  }
  var result = importLabel(state.label, {});
  ui.alert('Lanjutkan Impor', importSummaryText(result), ui.ButtonSet.OK);
}

/**
 * Mencari kata kunci pada data sheet hasil impor (murni, mudah diuji).
 * sheets: [{ name, values: [[...]] }] -> [{ sheet, row, cells }]
 */
function searchImportedRows(sheets, query, limit) {
  var needle = String(query || '').trim().toLowerCase();
  var max = Number(limit) > 0 ? Number(limit) : 200;
  if (!needle) return [];
  var out = [];
  (sheets || []).forEach(function (sheet) {
    var values = (sheet && sheet.values) || [];
    for (var r = 1; r < values.length && out.length < max; r++) {
      var cells = values[r] || [];
      var joined = cells.join(' ').toLowerCase();
      if (joined.indexOf(needle) === -1) continue;
      out.push({ sheet: sheet.name, row: r + 1, cells: cells });
    }
  });
  return out;
}

/** Menu: Telusuri Data… */
function showSearch() {
  assertAllowed();
  var ui = SpreadsheetApp.getUi();
  var jawab = ui.prompt('Telusuri Data', 'Cari NPM / ID pengajuan / jadwal / nomor surat:', ui.ButtonSet.OK_CANCEL);
  if (jawab.getSelectedButton() !== ui.Button.OK) return;
  var query = String(jawab.getResponseText() || '').trim();
  if (!query) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets().filter(function (s) { return s.getName().indexOf('bk_') === 0; }).map(function (s) {
    return { name: s.getName(), values: s.getDataRange().getValues() };
  });
  var rows = searchImportedRows(sheets, query, 200);
  var data = rows.map(function (row) { return [row.sheet, row.row, row.cells.join(' | ')]; });
  writeTable('bk_cari', ['Sheet', 'Baris', 'Isi baris'], data, 'Hasil pencarian "' + query + '" pada sheet bk_* hasil impor.');
  ui.alert('Telusuri Data', rows.length + ' baris cocok untuk "' + query + '". Lihat sheet bk_cari.', ui.ButtonSet.OK);
}

/** Menu: Cek Berkas (sha256)… */
function showChecksum() {
  assertAllowed();
  var ui = SpreadsheetApp.getUi();
  var jawab = ui.prompt('Cek Berkas', 'Label arsip yang diperiksa:', ui.ButtonSet.OK_CANCEL);
  if (jawab.getSelectedButton() !== ui.Button.OK) return;
  var folder = findLabelFolder(String(jawab.getResponseText() || '').trim());
  var manifest = readManifestFile(folder.id);
  if (!manifest) throw new Error('manifest.csv tidak ditemukan.');
  var files = listCsvFiles(folder.id);
  var byTable = {};
  files.forEach(function (f) { byTable[f.table] = f.fileId; });
  var entries = manifest.rows.map(function (row) {
    return { table: row.table, file: row.file, sha256: row.sha256, fileId: byTable[row.table] || '' };
  });
  var report = verifyCsvChecksums(entries, function (fileId) {
    return fileId ? readFileText(fileId) : '';
  });
  var data = report.map(function (r) { return [r.table, r.status, r.expected, r.actual, r.error]; });
  writeTable('bk_cek', ['Tabel', 'Status', 'sha256 manifest', 'sha256 berkas', 'Error'], data, 'Status "cocok" berarti isi CSV di Drive identik dengan manifest.csv.');
  var beda = report.filter(function (r) { return r.status !== 'cocok'; }).length;
  ui.alert('Cek Berkas', report.length + ' berkas diperiksa, ' + beda + ' tidak cocok. Lihat sheet bk_cek.', ui.ButtonSet.OK);
}

/** Perintah wrangler yang menyertai paket restore (untuk disalin operator). */
function restoreCommandRows(label) {
  var name = String(label || '<label>');
  return [
    ['1', 'npx wrangler d1 create inhal-poc-restore'],
    ['2', 'npx wrangler d1 execute inhal-poc-restore --remote --file=restore-' + name + '.sql'],
    ['3', 'npx wrangler d1 export inhal-poc-restore --remote --output=restored.sql'],
    ['4', 'node scripts/verify-backup.mjs restored.sql'],
    ['5', 'ganti database_id pada wrangler.production.toml lalu deploy'],
    ['6', 'smoke test: /api/health, /api/registration-options, /portal']
  ];
}

/** Menu: Siapkan Paket Restore */
function showRestorePackage() {
  assertAllowed();
  var ui = SpreadsheetApp.getUi();
  var jawab = ui.prompt('Paket Restore', 'Label arsip:', ui.ButtonSet.OK_CANCEL);
  if (jawab.getSelectedButton() !== ui.Button.OK) return;
  var label = String(jawab.getResponseText() || '').trim();
  var folder = findLabelFolder(label);
  var manifest = readManifestFile(folder.id);
  if (!manifest) throw new Error('manifest.csv tidak ditemukan.');

  var inputs = manifest.rows.map(function (row) {
    var file = findFileInFolder(folder.id, row.file || (row.table + '.csv'));
    return { table: row.table, csv: file ? readFileText(file.getId()) : '' };
  });
  var packs = buildRestoreStatements(inputs);
  var lines = [];
  var total = 0;
  packs.forEach(function (pack) {
    lines.push('-- tabel ' + pack.table + ' (' + pack.count + ' baris)');
    pack.statements.forEach(function (sql) { lines.push(sql); });
    total += pack.count;
  });

  writeTable('bk_restore_sql', ['Statement'], lines.map(function (l) { return [l]; }),
    'Paket restore ' + label + ': ' + total + ' statement. Simpan sebagai restore-' + label + '.sql lalu jalankan perintah di sheet bk_restore_perintah.');
  writeTable('bk_restore_perintah', ['Langkah', 'Perintah'], restoreCommandRows(label),
    'Restore selalu ke database BARU, tidak pernah in-place ke inhal-poc.');
  ui.alert('Paket Restore', total + ' statement siap di sheet bk_restore_sql untuk label ' + label + '.', ui.ButtonSet.OK);
}

/** Menu: Bersihkan Hasil Impor… */
function clearImportedSheets() {
  assertAllowed();
  var ui = SpreadsheetApp.getUi();
  var konfirmasi = ui.alert('Bersihkan Hasil Impor',
    'Hapus seluruh sheet bk_<tabel>, bk_cari, bk_cek, bk_restore_sql, dan bk_restore_perintah?',
    ui.ButtonSet.YES_NO);
  if (konfirmasi !== ui.Button.YES) return;

  var hapus = ['bk_cari', 'bk_cek', 'bk_restore_sql', 'bk_restore_perintah'];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dihapus = 0;
  ss.getSheets().forEach(function (sheet) {
    var name = sheet.getName();
    var target = name.indexOf('bk_') === 0 && [SHEET_SUMMARY, 'bk_tabel', SHEET_CHECKLIST, SHEET_AUDIT].indexOf(name) === -1;
    if (!target) return;
    ss.deleteSheet(sheet);
    dihapus += 1;
  });
  clearImportState();
  ui.alert('Bersihkan Hasil Impor', dihapus + ' sheet dihapus.', ui.ButtonSet.OK);
}
