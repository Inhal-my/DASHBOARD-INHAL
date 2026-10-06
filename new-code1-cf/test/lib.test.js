import { describe, it, expect } from 'vitest';
import {
  norm, isValidEmail, isValidPhone, bagianKey,
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
});

describe('buildPengajuanKey', () => {
  it('builds key for Ujian', () => {
    expect(buildPengajuanKey({ npm: '1', jenisKegiatan: 'Ujian', detailKegiatan: 'UAS', tanggalKegiatan: '2026-09-20' }))
      .toBe('1||ujian||uas||2026-09-20');
  });
  it('builds key for Praktikum from first row', () => {
    const form = { npm: '1', jenisKegiatan: 'Praktikum', praktikum: [
      { lab: 'Lab B', kegiatanLab: 'X', tanggal: '2026-09-21' },
      { lab: 'Lab A', kegiatanLab: 'Y', tanggal: '2026-09-20' }
    ] };
    expect(buildPengajuanKey(form)).toBe('1||praktikum||lab b | x||2026-09-21');
  });
});

describe('storedKeyFromDetails', () => {
  it('matches form key semantics', () => {
    const key = storedKeyFromDetails(
      { npm: '1', jenis_kegiatan: 'Ujian' },
      [{ pilihan: 'UAS', detail: '', tanggal_pelaksanaan: '2026-09-20' }]
    );
    expect(key).toBe('1||ujian||uas||2026-09-20');
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
  it('builds ujian row with empty bagian', () => {
    const rows = buildDetailKegiatanRows({ jenisKegiatan: 'Ujian', detailKegiatan: 'UAS', tanggalKegiatan: '2026-09-20' }, 'INHAL-y', new Map(), '2026-09-10T08:00:00');
    expect(rows).toHaveLength(1);
    expect(rows[0].bagian).toBe('');
  });
  it('hanya memakai baris praktikum pertama', () => {
    const rows = buildDetailKegiatanRows(
      { jenisKegiatan: 'Praktikum', praktikum: [
        { lab: 'Lab A', kegiatanLab: 'X', tanggal: '2026-09-20' },
        { lab: 'Lab B', kegiatanLab: 'Y', tanggal: '2026-09-21' }
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
