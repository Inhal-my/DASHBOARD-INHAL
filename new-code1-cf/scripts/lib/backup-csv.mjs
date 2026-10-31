/**
 * Utilitas CSV untuk artefak cadangan.
 *
 * Tujuan: menyediakan bentuk data yang bisa dibaca tanpa parser SQL — oleh
 * Google Apps Script (`Utilities.parseCsv`), PHP (`fgetcsv`), maupun Excel.
 * Format mengikuti RFC 4180: pemisah koma, sel dikutip ganda bila memuat
 * koma/kutip/baris baru, dan tiap baris diakhiri CRLF.
 *
 * Catatan: nilai `NULL` menjadi sel kosong (bukan teks "null"), dan boolean
 * ditulis sebagai `1`/`0` supaya konsisten dengan kolom SQLite.
 */

export const CSV_MANIFEST_FILE = 'manifest.csv';

/** Nama folder CSV di dalam direktori artefak, mis. `20261031-0100-csv`. */
export function csvDirName(label) {
  const safe = String(label || 'backup').replace(/[^A-Za-z0-9_-]+/g, '_');
  return safe + '-csv';
}

/** Satu sel CSV: escape kutip, koma, dan baris baru; `NULL` menjadi kosong. */
export function csvCell(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? '1' : '0';
  const text = String(value).replace(/\r\n?/g, '\n');
  if (text === '') return '';
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

/** Header + baris menjadi teks CSV lengkap (akhiran CRLF). */
export function toCsv(columns, rows) {
  const cols = (columns || []).map(String);
  const lines = [cols.map(csvCell).join(',')];
  for (const row of rows || []) {
    lines.push(cols.map((column) => csvCell(row ? row[column] : '')).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

/** Nama berkas aman untuk sebuah tabel. */
export function csvFileName(table) {
  const safe = String(table || '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (safe || 'tabel') + '.csv';
}

/**
 * Daftar berkas CSV dalam bentuk CSV juga, supaya pembaca (Apps Script/PHP)
 * cukup membaca satu berkas untuk mengetahui tabel apa saja yang tersedia
 * beserta hash dan jumlah barisnya.
 *
 * entries: [{ table, file, rows, columns, bytes, sha256 }]
 */
export function buildCsvManifest(entries) {
  const list = (entries || []).map((e) => ({
    tabel: e && e.table,
    file: e && e.file,
    baris: Number(e && e.rows) || 0,
    kolom: Number(e && e.columns) || 0,
    bytes: Number(e && e.bytes) || 0,
    sha256: (e && e.sha256) || ''
  }));
  return toCsv(['tabel', 'file', 'baris', 'kolom', 'bytes', 'sha256'], list);
}

/**
 * Ringkasan blok `csv` untuk `manifest.json`. Semua kunci bersifat aditif agar
 * konsumen lama (backup-report, GAS tahap manifest) tetap kompatibel.
 */
export function buildCsvBlock(label, entries) {
  const list = (entries || []).map((e) => ({
    table: e && e.table,
    file: e && e.file,
    rows: Number(e && e.rows) || 0,
    columns: Number(e && e.columns) || 0,
    bytes: Number(e && e.bytes) || 0,
    sha256: (e && e.sha256) || ''
  }));
  return {
    dir: csvDirName(label),
    manifestFile: csvDirName(label) + '/' + CSV_MANIFEST_FILE,
    tables: list,
    totalRows: list.reduce((sum, t) => sum + t.rows, 0),
    totalBytes: list.reduce((sum, t) => sum + t.bytes, 0)
  };
}
