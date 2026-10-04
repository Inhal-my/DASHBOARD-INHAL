import { describe, it, expect } from 'vitest';
import {
  gvizDateToIso,
  cellToValue,
  parseGvizResponse,
  tableToRecords,
  tableToRecordsAuto,
  tableToPositionalRecords,
  mapRecords,
  buildImportSql
} from '../src/sheetImport.js';

const FIXTURE = `/*O_o*/
google.visualization.Query.setResponse({"version":"0.6","table":{"cols":[
{"id":"A","label":"Timestamp","type":"datetime"},
{"id":"B","label":"NPM","type":"number"},
{"id":"C","label":"Tanggal","type":"date"},
{"id":"D","label":"Nama Lengkap","type":"string"}
],"rows":[{"c":[
{"v":"Date(2026,7,16,20,52,51)","f":"8/16/2026 20:52:51"},
{"v":2.408260111E9,"f":"2408260111"},
{"v":"Date(2026,7,22)","f":"8/22/2026"},
{"v":"O'Neil"}
]}]}});`;

describe('gvizDateToIso', () => {
  it('converts datetime constructs with zero-based month', () => {
    expect(gvizDateToIso('Date(2026,7,16,20,52,51)')).toBe('2026-08-16T20:52:51');
  });
  it('converts date-only constructs', () => {
    expect(gvizDateToIso('Date(2026,7,22)')).toBe('2026-08-22');
  });
  it('returns null for non-date values', () => {
    expect(gvizDateToIso('hello')).toBeNull();
  });
});

describe('cellToValue', () => {
  it('uses formatted string for numeric cells to keep leading digits', () => {
    expect(cellToValue({ v: 2.408260111e9, f: '2408260111' })).toBe('2408260111');
  });
  it('converts date cells to ISO', () => {
    expect(cellToValue({ v: 'Date(2026,7,22)', f: '8/22/2026' })).toBe('2026-08-22');
  });
  it('returns empty string for missing cells', () => {
    expect(cellToValue(null)).toBe('');
    expect(cellToValue({})).toBe('');
  });
});

describe('parseGvizResponse', () => {
  it('parses wrapped gviz payload into records', () => {
    const table = parseGvizResponse(FIXTURE);
    const records = tableToRecords(table);
    expect(records).toHaveLength(1);
    expect(records[0]['Timestamp']).toBe('2026-08-16T20:52:51');
    expect(records[0]['NPM']).toBe('2408260111');
    expect(records[0]['Tanggal']).toBe('2026-08-22');
    expect(records[0]['Nama Lengkap']).toBe("O'Neil");
  });
});

describe('tableToRecordsAuto', () => {
  it('promotes first row to header when gviz has no labels', () => {
    const text = `/*O_o*/
google.visualization.Query.setResponse({"table":{"cols":[{"label":""},{"label":""},{"label":""}],"rows":[
{"c":[{"v":"Key"},{"v":"Value"},null]},
{"c":[{"v":"BUKTI_MODE"},{"v":"lenggang"},null]}
]}});`;
    const records = tableToRecordsAuto(parseGvizResponse(text));
    expect(records).toEqual([{ Key: 'BUKTI_MODE', Value: 'lenggang' }]);
  });
});

describe('tableToPositionalRecords', () => {
  it('skips the header row and maps by column position', () => {
    const text = `/*O_o*/
google.visualization.Query.setResponse({"table":{"cols":[{"label":""},{"label":""}],"rows":[
{"c":[{"v":"Password"},{"v":"Nama"}]},
{"c":[{"v":"rahasia"},{"v":"Admin Utama"}]},
{"c":[{"v":"bgn"},{"v":"Bagian Umum"}]}
]}});`;
    const records = tableToPositionalRecords(parseGvizResponse(text), 2);
    expect(records).toEqual([
      { '#0': 'rahasia', '#1': 'Admin Utama' },
      { '#0': 'bgn', '#1': 'Bagian Umum' }
    ]);
  });
});

describe('mapRecords + buildImportSql', () => {
  it('maps labels to columns and escapes quotes', () => {
    const table = parseGvizResponse(FIXTURE);
    const records = tableToRecords(table);
    const rows = mapRecords(records, { Timestamp: 'timestamp', NPM: 'npm' });
    expect(rows).toEqual([['2026-08-16T20:52:51', '2408260111']]);

    const sql = buildImportSql([
      { table: 'pengajuan', columnMap: { Timestamp: 'timestamp', NPM: 'npm' }, records },
      { table: 'mahasiswa', columnMap: { 'Nama Lengkap': 'nama_lengkap' }, records }
    ]);
    expect(sql).toContain('DELETE FROM "pengajuan";');
    expect(sql).toContain('DELETE FROM "mahasiswa";');
    expect(sql).toContain('INSERT INTO "pengajuan" ("timestamp", "npm") VALUES (\'2026-08-16T20:52:51\', \'2408260111\');');
    expect(sql).toContain("'O''Neil'");
  });
});
