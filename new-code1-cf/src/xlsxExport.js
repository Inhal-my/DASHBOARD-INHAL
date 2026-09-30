export const EXCEL_MAX_CELL = 32767;

export function prepareCell(value) {
  if (value == null) return { text: '', truncated: false };
  const text = String(value);
  if (text.length <= EXCEL_MAX_CELL) return { text, truncated: false };
  return { text: text.slice(0, EXCEL_MAX_CELL), truncated: true };
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colLetter(n) {
  let s = '';
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

function normalizeColumns(columns) {
  return (columns || []).map((c) => {
    if (c && typeof c === 'object') {
      const key = String(c.key == null ? '' : c.key);
      return { key, label: c.label == null ? key : String(c.label), numeric: !!c.numeric };
    }
    const key = String(c);
    return { key, label: key, numeric: false };
  });
}

function isNumericString(value) {
  return /^-?\d+(\.\d+)?$/.test(String(value).trim());
}

function textCell(ref, text, style) {
  return '<c r="' + ref + '" s="' + style + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEscape(text) + '</t></is></c>';
}

function numberCell(ref, num, style) {
  return '<c r="' + ref + '" s="' + style + '"><v>' + num + '</v></c>';
}

function renderDataCell(ref, value, column) {
  if (value != null && typeof value === 'number' && Number.isFinite(value)) {
    return numberCell(ref, value, 0);
  }
  if (column && column.numeric && value != null && value !== '' && isNumericString(value)) {
    return numberCell(ref, Number(value), 0);
  }
  return textCell(ref, prepareCell(value).text, 0);
}

function columnWidths(columns, rows) {
  return columns.map((column) => {
    let max = column.label ? String(column.label).length : 0;
    for (const row of rows) {
      const cell = prepareCell(row[column.key]);
      if (cell.text.length > max) max = cell.text.length;
    }
    return Math.min(Math.max(max + 2, 10), 50);
  });
}

function sheetXml(table) {
  const columns = normalizeColumns(table.columns);
  const rows = table.rows || [];
  const lastCol = colLetter(Math.max(columns.length, 1));
  const lastRow = rows.length + 1;
  const parts = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    '<dimension ref="A1:' + lastCol + lastRow + '"/>',
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>',
    '<sheetFormatPr defaultRowHeight="15"/>'
  ];
  if (columns.length) {
    const widths = columnWidths(columns, rows);
    parts.push('<cols>' + columns.map((c, i) =>
      '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + widths[i] + '" customWidth="1"/>'
    ).join('') + '</cols>');
  }
  parts.push('<sheetData>');
  let header = '<row r="1" s="1" customFormat="1">';
  columns.forEach((col, i) => {
    header += textCell(colLetter(i + 1) + '1', col.label, 1);
  });
  header += '</row>';
  parts.push(header);
  rows.forEach((row, ri) => {
    const r = ri + 2;
    let xml = '<row r="' + r + '">';
    columns.forEach((col, i) => {
      xml += renderDataCell(colLetter(i + 1) + r, row[col.key], col);
    });
    xml += '</row>';
    parts.push(xml);
  });
  parts.push('</sheetData>');
  parts.push('<autoFilter ref="A1:' + lastCol + lastRow + '"/>');
  parts.push('</worksheet>');
  return parts.join('');
}

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n) {
  return new Uint8Array([n & 255, (n >>> 8) & 255]);
}

function u32(n) {
  return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
}

function concatBytes(chunks) {
  let len = 0;
  for (const c of chunks) len += c.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function zipStore(entries) {
  const encoder = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const e of entries) {
    const nameBytes = encoder.encode(e.name);
    const data = typeof e.data === 'string' ? encoder.encode(e.data) : e.data;
    const crc = crc32(data);
    const local = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      data
    ]);
    locals.push(local);
    const central = concatBytes([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes
    ]);
    centrals.push(central);
    offset += local.length;
  }
  const centralDir = concatBytes(centrals);
  const end = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDir.length),
    u32(offset),
    u16(0)
  ]);
  return concatBytes(locals.concat([centralDir, end]));
}

function stylesXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2">' +
    '<font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
    '</fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';
}

export function buildXlsx(tables) {
  const list = Array.isArray(tables) ? tables : [];
  const sheets = list.map((t, i) => ({
    name: t.name,
    path: 'xl/worksheets/sheet' + (i + 1) + '.xml',
    xml: sheetXml(t)
  }));
  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets>' +
    sheets.map((s, i) => '<sheet name="' + xmlEscape(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') +
    '</sheets></workbook>';
  const stylesRelId = 'rId' + (sheets.length + 1);
  const workbookRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
    '<Relationship Id="' + stylesRelId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';
  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    sheets.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') +
    '</Types>';
  const entries = [
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rootRels },
    { name: 'xl/workbook.xml', data: workbook },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRels },
    { name: 'xl/styles.xml', data: stylesXml() }
  ];
  sheets.forEach((s) => entries.push({ name: s.path, data: s.xml }));
  return zipStore(entries);
}
