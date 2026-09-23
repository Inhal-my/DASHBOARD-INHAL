import { describe, it, expect } from 'vitest';
import { toClientRow, TABLE_COLUMNS } from '../src/read/columns.js';

describe('columns', () => {
  it('maps db columns to sheet labels', () => {
    const row = { id_pengajuan: 'INHAL-1', nama_lengkap: 'Budi', status: 'ACC' };
    const c = toClientRow('pengajuan', row);
    expect(c['ID Pengajuan']).toBe('INHAL-1');
    expect(c['Nama Lengkap']).toBe('Budi');
    expect(c.Status).toBe('ACC');
  });
  it('maps ba columns', () => {
    const c = toClientRow('berita_acara', { ba_id: 'BA-2026-0001', nama_kegiatan: 'X', jumlah_peserta: '2' });
    expect(c['BA ID']).toBe('BA-2026-0001');
    expect(c['Nama Kegiatan']).toBe('X');
    expect(c['Jumlah Peserta']).toBe('2');
  });
  it('keeps unknown columns as-is', () => {
    expect(toClientRow('pengajuan', { extra: 1 }).extra).toBe(1);
  });
  it('exposes every required table', () => {
    for (const t of ['pengajuan','detail_kegiatan','berita_acara','berita_acara_peserta','berita_acara_admin','berita_acara_admin_peserta','master_kegiatan','master_bagian','master_biaya','check_data','config','admin','bagian_staff']) {
      expect(TABLE_COLUMNS[t]).toBeTruthy();
    }
  });
});
