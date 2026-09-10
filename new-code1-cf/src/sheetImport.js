export function gvizDateToIso(value) {
  const m = /^Date\((\d+),(\d+)(?:,(\d+))?(?:,(\d+),(\d+),(\d+))?\)$/.exec(String(value));
  if (!m) return null;
  const pad = (n) => String(n).padStart(2, '0');
  const year = Number(m[1]);
  const month = Number(m[2]) + 1;
  const day = m[3] != null ? Number(m[3]) : 1;
  const date = `${year}-${pad(month)}-${pad(day)}`;
  if (m[4] != null) {
    return `${date}T${pad(Number(m[4]))}:${pad(Number(m[5]))}:${pad(Number(m[6]))}`;
  }
  return date;
}

export function cellToValue(cell) {
  if (!cell || cell.v == null) return '';
  const v = cell.v;
  if (typeof v === 'string') {
    const iso = gvizDateToIso(v);
    return iso != null ? iso : v;
  }
  if (cell.f != null && cell.f !== '') return String(cell.f);
  return String(v);
}

export function parseGvizResponse(text) {
  const start = String(text).indexOf('{');
  const end = String(text).lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Respons gviz tidak valid');
  const json = JSON.parse(String(text).slice(start, end + 1));
  if (!json.table) throw new Error('Tabel gviz tidak ditemukan');
  return json.table;
}

export function tableToRecords(table) {
  const labels = (table.cols || []).map((c) => c.label);
  return (table.rows || []).map((row) => {
    const cells = row.c || [];
    const record = {};
    labels.forEach((label, i) => {
      record[label] = cellToValue(cells[i]);
    });
    return record;
  });
}

export function tableToRecordsAuto(table) {
  const labels = (table.cols || []).map((c) => c.label);
  const hasLabels = labels.some((l) => l != null && String(l).trim() !== '');
  if (hasLabels) return tableToRecords(table);

  const rows = table.rows || [];
  if (!rows.length) return [];
  const header = (rows[0].c || []).map((cell) => cellToValue(cell));
  return rows.slice(1).map((row) => {
    const cells = row.c || [];
    const record = {};
    header.forEach((label, i) => {
      if (label !== '') record[label] = cellToValue(cells[i]);
    });
    return record;
  });
}

export function mapRecords(records, columnMap) {
  const labels = Object.keys(columnMap);
  return records.map((record) => labels.map((label) => (record[label] == null ? '' : record[label])));
}

export function sqlValue(value) {
  if (value == null) return 'NULL';
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function quoteIdent(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

export function buildInsertStatements(table, columns, rows, chunkSize = 200) {
  const statements = [];
  const colList = columns.map(quoteIdent).join(', ');
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values = chunk.map((row) => '(' + row.map(sqlValue).join(', ') + ')').join(', ');
    statements.push(`INSERT INTO ${quoteIdent(table)} (${colList}) VALUES ${values};`);
  }
  return statements;
}

export function buildImportSql(specs, options = {}) {
  const parts = [];
  for (const spec of specs) parts.push(`DELETE FROM ${quoteIdent(spec.table)};`);
  for (const spec of specs) {
    const columns = Object.values(spec.columnMap);
    const rows = mapRecords(spec.records, spec.columnMap);
    parts.push(...buildInsertStatements(spec.table, columns, rows, options.chunkSize || 200));
  }
  return parts.join('\n') + '\n';
}
