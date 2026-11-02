/**
 * CSV arsip backup: parser RFC 4180, perencanaan impor, dan SQL restore.
 *
 * Semua fungsi di berkas ini murni (tanpa API Google) supaya bisa diuji Node
 * lewat scripts/__tests__/gas-csv-reader.node.mjs.
 */

var CSV_ROWS_PER_RUN = 2000;
var CSV_MAX_CELLS = 500000;

/** Parser CSV RFC 4180: kutip ganda, escaped quote, newline di dalam sel. */
function parseCsvText(text) {
  var s = String(text == null ? '' : text);
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  var rows = [];
  var row = [];
  var field = '';
  var inQuotes = false;
  var i = 0;
  while (i < s.length) {
    var ch = s.charAt(i);
    if (inQuotes) {
      if (ch === '"') {
        if (s.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += ch; i += 1; continue;
    }
    if (ch === '"') { inQuotes = true; i += 1; continue; }
    if (ch === ',') { row.push(field); field = ''; i += 1; continue; }
    if (ch === '\r') { i += 1; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 1; continue; }
    field += ch; i += 1;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }

  while (rows.length > 0) {
    var last = rows[rows.length - 1];
    if (last.length === 1 && last[0] === '') rows.pop();
    else break;
  }
  return rows;
}

/** CSV menjadi { header, rows }; setiap baris dinormalkan ke panjang header. */
function csvToTable(text) {
  var rows = parseCsvText(text);
  if (!rows.length) return { header: [], rows: [] };
  var header = rows[0].map(function (value) { return String(value); });
  var width = header.length;
  var body = rows.slice(1).map(function (line) {
    var out = [];
    for (var i = 0; i < width; i++) out.push(line[i] === undefined ? '' : String(line[i]));
    return out;
  });
  return { header: header, rows: body };
}

/** Nama sheet hasil impor: `bk_<tabel>` (aman, maksimal 95 karakter). */
function sheetNameForTable(table) {
  var safe = String(table || '').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  if (!safe) safe = 'tabel';
  var name = 'bk_' + safe;
  return name.length > 95 ? name.slice(0, 95) : name;
}

/**
 * Merencanakan impor tabel ke sheet: hanya tabel yang muat batas sel,
 * masing-masing dipecah menjadi pekerjaan per CSV_ROWS_PER_RUN baris.
 *
 * tables: [{ table, file, rows, columns }]
 * hasil:  { jobs: [{ table, sheet, totalRows, from, to, part }], skipped: [...] }
 */
function planImportJobs(tables, opts) {
  var o = opts || {};
  var chunk = Number(o.rowsPerRun) > 0 ? Number(o.rowsPerRun) : CSV_ROWS_PER_RUN;
  var maxCells = Number(o.maxCells) > 0 ? Number(o.maxCells) : CSV_MAX_CELLS;
  var jobs = [];
  var skipped = [];
  (tables || []).forEach(function (entry) {
    var table = String((entry && entry.table) || '');
    if (!table) return;
    var rows = Number(entry.rows) || 0;
    var columns = Number(entry.columns) || 0;
    if (rows * Math.max(columns, 1) > maxCells) {
      skipped.push({ table: table, rows: rows, columns: columns, reason: 'melebihi batas sel ' + maxCells });
      return;
    }
    var parts = Math.max(1, Math.ceil(rows / chunk));
    for (var p = 0; p < parts; p++) {
      jobs.push({
        table: table,
        sheet: sheetNameForTable(table),
        totalRows: rows,
        from: p * chunk,
        to: Math.min(rows, (p + 1) * chunk),
        part: p + 1,
        parts: parts
      });
    }
  });
  return { jobs: jobs, skipped: skipped };
}

/** Literal SQL untuk satu nilai CSV (sel kosong menjadi NULL). */
function sqlValue(value) {
  var text = value === undefined || value === null ? '' : String(value);
  if (text === '') return 'NULL';
  return "'" + text.replace(/'/g, "''") + "'";
}

/** Nama tabel/kolom dikutip ganda agar aman terhadap kata kunci SQL. */
function sqlIdent(name) {
  return '"' + String(name || '').replace(/"/g, '""') + '"';
}

/** Statement INSERT untuk seluruh baris satu tabel CSV. */
function buildInsertSql(table, header, rows) {
  if (!table || !header || !header.length) return [];
  var cols = header.map(sqlIdent).join(', ');
  var prefix = 'INSERT INTO ' + sqlIdent(table) + ' (' + cols + ') VALUES (';
  return (rows || []).map(function (row) {
    var values = header.map(function (_, index) { return sqlValue(row[index]); });
    return prefix + values.join(', ') + ');';
  });
}

/**
 * Menyusun paket restore dari daftar tabel CSV.
 * inputs: [{ table, csv }] -> [{ table, count, statements }]
 */
function buildRestoreStatements(inputs) {
  return (inputs || []).map(function (input) {
    var parsed = csvToTable(input && input.csv);
    var statements = buildInsertSql(input && input.table, parsed.header, parsed.rows);
    return { table: String((input && input.table) || ''), count: statements.length, statements: statements };
  });
}
