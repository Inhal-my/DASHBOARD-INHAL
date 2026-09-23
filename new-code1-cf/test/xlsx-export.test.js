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
  it('returns a zip workbook with one sheet per table', () => {
    const bytes = buildXlsx([
      {
        name: 'admin',
        columns: ['password', 'nama'],
        rows: [{ password: 'pbkdf2$abc', nama: 'Admin Utama' }]
      },
      {
        name: 'mahasiswa',
        columns: ['npm', 'nama_lengkap'],
        rows: []
      }
    ]);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK');
    const files = unzipStore(bytes);
    expect(files['xl/workbook.xml']).toContain('name="admin"');
    expect(files['xl/workbook.xml']).toContain('name="mahasiswa"');
    expect(files['xl/worksheets/sheet1.xml']).toContain('pbkdf2$abc');
    expect(files['xl/worksheets/sheet1.xml']).toContain('Admin Utama');
    expect(files['xl/worksheets/sheet1.xml']).toContain('_truncated');
    expect(files['xl/worksheets/sheet2.xml']).toContain('npm');
    expect(files['xl/worksheets/sheet2.xml']).toContain('_truncated');
    expect(files['xl/worksheets/sheet2.xml']).not.toContain('2201010001');
  });

  it('marks truncated rows and keeps secrets', () => {
    const long = 'x'.repeat(EXCEL_MAX_CELL + 1);
    const bytes = buildXlsx([
      {
        name: 'uploads',
        columns: ['id', 'content'],
        rows: [{ id: 'u1', content: long }]
      }
    ]);
    const xml = unzipStore(bytes)['xl/worksheets/sheet1.xml'];
    expect(xml).toContain('u1');
    expect(xml).not.toContain('x'.repeat(EXCEL_MAX_CELL + 1));
    expect(xml).toContain('<t>1</t>');
  });
});
