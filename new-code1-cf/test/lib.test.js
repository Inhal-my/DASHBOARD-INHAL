import { describe, it, expect } from 'vitest';
import {
  norm, isValidEmail, isValidPhone, isValidDateOnly, bagianKey,
  buildPengajuanKey, storedKeyFromDetails, buildDetailKegiatanRows,
  nowLocalIso, newIdPengajuan
} from '../src/lib.js';

describe('norm & validators', () => {
  it('normalizes case and whitespace', () => {
    expect(norm('  Lab Anatomi ')).toBe('lab anatomi');
  });
  it('validates email and phone', () => {
    expect(isValidEmail('a@b.com')).toBe(true);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidPhone('0812-3456-789')).toBe(true);
    expect(isValidPhone('123')).toBe(false);
  });
  it('validates date-only values', () => {
    expect(isValidDateOnly('2026-09-20')).toBe(true);
    expect(isValidDateOnly('2026-02-29')).toBe(false);
    expect(isValidDateOnly('2024-02-29')).toBe(true);
    expect(isValidDateOnly('2026-13-01')).toBe(false);
    expect(isValidDateOnly('2026-9-1')).toBe(false);
    expect(isValidDateOnly('')).toBe(false);
  });
});

describe('buildPengajuanKey', () => {
  it('builds key for Ujian', () => {
    expect(buildPengajuanKey({ npm: '1', jenisKegiatan: 'Ujian', detailKegiatan: 'UAS', tanggalKegiatan: '2026-09-20' }))
      .toBe('1||ujian||uas||2026-09-20');
  });
  it('builds key for Praktikum from every filled row', () => {
    const form = { npm: '1', jenisKegiatan: 'Praktikum', praktikum: [
      { lab: 'Lab B', kegiatanLab: 'X', tanggal: '2026-09-21' },
      { lab: 'Lab A', kegiatanLab: 'Y', tanggal: '2026-09-20' }
    ] };
    expect(buildPengajuanKey(form)).toBe('1||praktikum||lab a | y && lab b | x||2026-09-21');
  });
  it('treats blank praktikum rows as absent', () => {
    const form = { npm: '1', jenisKegiatan: 'Praktikum', praktikum: [
      { lab: '', kegiatanLab: '', tanggal: '' },
      { lab: 'Lab A', kegiatanLab: 'Y', tanggal: '2026-09-20' }
    ] };
    expect(buildPengajuanKey(form)).toBe('1||praktikum||lab a | y||2026-09-20');
  });
});

describe('storedKeyFromDetails', () => {
  it('matches form key semantics for Ujian', () => {
    const key = storedKeyFromDetails(
      { npm: '1', jenis_kegiatan: 'Ujian' },
      [{ pilihan: 'UAS', detail: '', tanggal_pelaksanaan: '2026-09-20' }]
    );
    expect(key).toBe('1||ujian||uas||2026-09-20');
  });
  it('matches a multi-row Praktikum key regardless of row order', () => {
    const key = storedKeyFromDetails(
      { npm: '1', jenis_kegiatan: 'Praktikum' },
      [
        { pilihan: 'Lab A', detail: 'Y', tanggal_pelaksanaan: '2026-09-20' },
        { pilihan: 'Lab B', detail: 'X', tanggal_pelaksanaan: '2026-09-21' }
      ]
    );
    expect(key).toBe('1||praktikum||lab a | y && lab b | x||2026-09-20');
  });
});

describe('buildDetailKegiatanRows', () => {
  it('builds praktikum rows with bagian from map', () => {
    const map = new Map([[bagianKey('Lab Anatomi', 'Praktikum 1'), 'Anatomi']]);
    const rows = buildDetailKegiatanRows(
      { jenisKegiatan: 'Praktikum', praktikum: [{ lab: 'Lab Anatomi', kegiatanLab: 'Praktikum 1', tanggal: '2026-09-20' }] },
      'INHAL-x', map, '2026-09-10T08:00:00'
    );
    expect(rows).toEqual([{
      timestamp: '2026-09-10T08:00:00', id_pengajuan: 'INHAL-x', jenis_kegiatan: 'Praktikum',
      pilihan: 'Lab Anatomi', detail: 'Praktikum 1', tanggal_pelaksanaan: '2026-09-20', bagian: 'Anatomi'
    }]);
  });
  it('builds ujian row with Detail and empty bagian', () => {
    const rows = buildDetailKegiatanRows({ jenisKegiatan: 'Ujian', detailKegiatan: 'UAS', detailUjian: 'Inhal', tanggalKegiatan: '2026-09-20' }, 'INHAL-y', new Map(), '2026-09-10T08:00:00');
    expect(rows).toHaveLength(1);
    expect(rows[0].detail).toBe('Inhal');
    expect(rows[0].bagian).toBe('');
  });
  it('defaults ujian Detail to Inhal when empty', () => {
    const rows = buildDetailKegiatanRows({ jenisKegiatan: 'Ujian', detailKegiatan: 'UAS', tanggalKegiatan: '2026-09-20' }, 'INHAL-y', new Map(), '2026-09-10T08:00:00');
    expect(rows[0].detail).toBe('Inhal');
  });
  it('menyimpan semua baris praktikum yang terisi', () => {
    const rows = buildDetailKegiatanRows(
      { jenisKegiatan: 'Praktikum', praktikum: [
        { lab: 'Lab A', kegiatanLab: 'X', tanggal: '2026-09-20' },
        { lab: 'Lab B', kegiatanLab: 'Y', tanggal: '2026-09-21' }
      ] },
      'INHAL-z', new Map(), '2026-09-10T08:00:00'
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].pilihan).toBe('Lab A');
    expect(rows[1].pilihan).toBe('Lab B');
  });
  it('mengabaikan baris praktikum kosong', () => {
    const rows = buildDetailKegiatanRows(
      { jenisKegiatan: 'Praktikum', praktikum: [
        { lab: '', kegiatanLab: '', tanggal: '' },
        { lab: 'Lab A', kegiatanLab: 'X', tanggal: '2026-09-20' }
      ] },
      'INHAL-z', new Map(), '2026-09-10T08:00:00'
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].pilihan).toBe('Lab A');
  });
});

describe('ids and time', () => {
  it('prefixes uuid', () => {
    expect(newIdPengajuan()).toMatch(/^INHAL-[0-9a-f-]{36}$/);
  });
  it('formats local iso', () => {
    expect(nowLocalIso(new Date(2026, 8, 10, 8, 5, 3))).toBe('2026-09-10T08:05:03');
  });
});
