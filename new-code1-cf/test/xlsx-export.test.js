import { describe, it, expect } from 'vitest';
import { EXCEL_MAX_CELL, prepareCell, buildXlsx } from '../src/xlsxExport.js';

function unzipStore(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const files = {};
  let i = 0;
  while (i + 30 <= u8.length) {
    const sig = view.getUint32(i, true);
    if (sig !== 0x04034b50) break;
    const method = view.getUint16(i + 8, true);
    const compSize = view.getUint32(i + 18, true);
    const nameLen = view.getUint16(i + 26, true);
    const extraLen = view.getUint16(i + 28, true);
    const name = new TextDecoder().decode(u8.slice(i + 30, i + 30 + nameLen));
    const start = i + 30 + nameLen + extraLen;
    const data = u8.slice(start, start + compSize);
    if (method !== 0) throw new Error('compressed: ' + name);
    files[name] = new TextDecoder().decode(data);
    i = start + compSize;
  }
  return files;
}

describe('prepareCell', () => {
  it('stringifies null as empty and does not truncate', () => {
    expect(prepareCell(null)).toEqual({ text: '', truncated: false });
    expect(prepareCell(undefined)).toEqual({ text: '', truncated: false });
  });

  it('truncates values longer than the Excel cell limit', () => {
    expect(EXCEL_MAX_CELL).toBe(32767);
    const long = 'a'.repeat(EXCEL_MAX_CELL + 5);
    const cell = prepareCell(long);
    expect(cell.text).toBe('a'.repeat(EXCEL_MAX_CELL));
    expect(cell.truncated).toBe(true);
  });
});

describe('buildXlsx', () => {
  it('writes friendly headers, typed numbers and no _truncated column', () => {
    const bytes = buildXlsx([
      {
        name: 'mahasiswa',
        columns: [
          { key: 'npm', label: 'NPM' },
          { key: 'nama_lengkap', label: 'Nama Lengkap' },
          { key: 'angkatan', label: 'Angkatan', numeric: true }
        ],
        rows: [{ npm: '2201010001', nama_lengkap: 'Aisyah Putri', angkatan: '2022' }]
      }
    ]);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK');
    const files = unzipStore(bytes);
    expect(files['xl/workbook.xml']).toContain('name="mahasiswa"');
    const sheet = files['xl/worksheets/sheet1.xml'];
    expect(sheet).toContain('Nama Lengkap');
    expect(sheet).not.toContain('_truncated');
    expect(sheet).toContain('Aisyah Putri');
    expect(sheet).toContain('<c r="C2" s="0"><v>2022</v></c>');
    expect(sheet).toContain('t="inlineStr"');
    expect(sheet).toContain('state="frozen"');
    expect(sheet).toContain('autoFilter');
    expect(files['xl/styles.xml']).toContain('<b/>');
  });

  it('writes JS numbers as numeric cells', () => {
    const bytes = buildXlsx([
      {
        name: 'nomor_surat',
        columns: [{ key: 'last_number', label: 'LastNumber' }],
        rows: [{ last_number: 42 }]
      }
    ]);
    const sheet = unzipStore(bytes)['xl/worksheets/sheet1.xml'];
    expect(sheet).toContain('<c r="A2" s="0"><v>42</v></c>');
  });

  it('truncates oversized cell text without an extra marker column', () => {
    const long = 'x'.repeat(EXCEL_MAX_CELL + 1);
    const bytes = buildXlsx([
      {
        name: 'catatan',
        columns: [{ key: 'catatan', label: 'Catatan' }],
        rows: [{ catatan: long }]
      }
    ]);
    const sheet = unzipStore(bytes)['xl/worksheets/sheet1.xml'];
    expect(sheet).not.toContain('_truncated');
    expect(sheet).not.toContain(long);
    expect(sheet).toContain('x'.repeat(EXCEL_MAX_CELL));
  });

  it('handles a table with no rows (headers only)', () => {
    const bytes = buildXlsx([
      { name: 'kosong', columns: [{ key: 'a', label: 'Kolom A' }], rows: [] }
    ]);
    const sheet = unzipStore(bytes)['xl/worksheets/sheet1.xml'];
    expect(sheet).toContain('Kolom A');
    expect(sheet).toContain('autoFilter');
  });
});
