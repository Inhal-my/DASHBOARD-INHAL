/**
 * Akses folder arsip CSV di Drive (mode 3b: folder privat berisi subfolder
 * per label). ID folder disimpan di Script Properties `CSV_ROOT_FOLDER_ID`,
 * jadi reader tidak pernah menebak lokasi arsip.
 *
 * Struktur: <root>/<label>/manifest.csv + <tabel>.csv
 */

var CSV_ROOT_KEY = 'CSV_ROOT_FOLDER_ID';

function csvRootFolderId() {
  var id = '';
  try {
    id = String(PropertiesService.getScriptProperties().getProperty(CSV_ROOT_KEY) || '').trim();
  } catch (err) {
    id = '';
  }
  if (!id) throw new Error('CSV_ROOT_FOLDER_ID belum diisi di Script Properties.');
  return id;
}

/** Daftar subfolder label (urut terbaru dulu) di folder arsip. */
function listLabelFolders() {
  var root = DriveApp.getFolderById(csvRootFolderId());
  var it = root.getFolders();
  var out = [];
  while (it.hasNext()) {
    var folder = it.next();
    out.push({ id: folder.getId(), name: folder.getName() });
  }
  out.sort(function (a, b) { return a.name < b.name ? 1 : -1; });
  return out;
}

/** Berkas bernama tertentu di sebuah folder (null bila tidak ada). */
function findFileInFolder(folderId, name) {
  var folder = DriveApp.getFolderById(String(folderId || ''));
  var it = folder.getFilesByName(String(name || ''));
  return it.hasNext() ? it.next() : null;
}

/** Isi teks sebuah berkas berdasarkan fileId. */
function readFileText(fileId) {
  return DriveApp.getFileById(String(fileId || '')).getBlob().getDataAsString();
}

/** sha256 hex (huruf besar) dari teks, memakai API Apps Script. */
function sha256Hex(text) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8);
  var out = '';
  for (var i = 0; i < bytes.length; i++) {
    var part = (bytes[i] < 0 ? bytes[i] + 256 : bytes[i]).toString(16);
    out += part.length === 1 ? '0' + part : part;
  }
  return out.toUpperCase();
}

/** Manifest.csv di dalam folder label (null bila tidak ada). */
function readManifestFile(folderId) {
  var file = findFileInFolder(folderId, 'manifest.csv');
  if (!file) return null;
  return { fileId: file.getId(), rows: parseManifestCsv(readFileText(file.getId())) };
}

/** manifest.csv -> [{ tabel, file, baris, kolom, bytes, sha256 }] */
function parseManifestCsv(text) {
  var sheet = csvToTable(text);
  var index = {};
  sheet.header.forEach(function (key, i) { index[String(key).toLowerCase()] = i; });
  return sheet.rows.map(function (row) {
    return {
      table: String(row[index.tabel] || ''),
      file: String(row[index.file] || ''),
      rows: Number(row[index.baris]) || 0,
      columns: Number(row[index.kolom]) || 0,
      bytes: Number(row[index.bytes]) || 0,
      sha256: String(row[index.sha256] || '')
    };
  }).filter(function (entry) { return !!entry.table; });
}

/** Daftar berkas CSV di folder label, dipetakan per nama tabel. */
function listCsvFiles(folderId) {
  var folder = DriveApp.getFolderById(String(folderId || ''));
  var it = folder.getFiles();
  var out = [];
  while (it.hasNext()) {
    var file = it.next();
    var name = file.getName();
    if (name.toLowerCase().slice(-4) !== '.csv') continue;
    if (name === 'manifest.csv') continue;
    out.push({ table: name.replace(/\.csv$/i, ''), fileId: file.getId(), name: name });
  }
  return out;
}

/**
 * Membandingkan sha256 tiap CSV di Drive dengan manifest.csv.
 * entries: [{ table, file, sha256 }] -> baris laporan untuk sheet.
 */
function verifyCsvChecksums(entries, reader) {
  var read = reader || readFileText;
  return (entries || []).map(function (entry) {
    var text = '';
    var error = '';
    try {
      text = String(read(entry.fileId) || '');
    } catch (err) {
      error = String((err && err.message) || err);
    }
    var actual = text ? sha256Digest(text) : '';
    var expected = String(entry.sha256 || '').toUpperCase();
    var status = error ? 'gagal baca' : (!expected ? 'tanpa hash' : (actual === expected ? 'cocok' : 'BEDA'));
    return { table: entry.table, expected: expected, actual: actual, bytes: text.length, status: status, error: error };
  });
}

/** sha256 hex dari teks; dipisah agar mudah distub saat uji. */
function sha256Digest(text) {
  return typeof sha256Hex === 'function' ? sha256Hex(text) : '';
}
