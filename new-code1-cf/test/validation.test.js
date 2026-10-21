import { describe, it, expect } from 'vitest';
import { validateJadwalInput, validateBaCreateInput, validateBaUpdateInput } from '../src/validation.js';

describe('validasi input Poin 6', () => {
  it('menerima payload jadwal yang valid', () => {
    const out = validateJadwalInput({
      bagian: 'SGD', blok: 'A', namaKegiatan: 'SGD 1', tanggal: '2026-09-20', jam: '09:00',
      peserta: [{ npm: '2201010001', namaLengkap: 'Aisyah', idPengajuan: 'INHAL-1' }]
    });
    expect(out.ok).toBe(true);
  });

  it('menolak tanggal yang tidak valid', () => {
    const out = validateJadwalInput({ namaKegiatan: 'SGD 1', tanggal: '2026-02-30' });
    expect(out.ok).toBe(false);
    expect(out.message).toContain('tanggal');
  });

  it('menolak daftar peserta yang bukan array', () => {
    const out = validateJadwalInput({ namaKegiatan: 'SGD 1', tanggal: '2026-09-20', peserta: 'Aisyah' });
    expect(out.ok).toBe(false);
    expect(out.message).toContain('array');
  });

  it('menolak teks yang melebihi batas', () => {
    const out = validateBaCreateInput({
      namaKegiatan: 'X'.repeat(201), tanggalPelaksanaan: '2026-09-20'
    });
    expect(out.ok).toBe(false);
    expect(out.message).toContain('maksimal');
  });

  it('memvalidasi pesertaIds saat memperbarui BA', () => {
    expect(validateBaUpdateInput({ pesertaIds: ['INHAL-1'] }).ok).toBe(true);
    expect(validateBaUpdateInput({ pesertaIds: 'INHAL-1' }).ok).toBe(false);
    expect(validateBaUpdateInput({ pesertaIds: ['X'.repeat(121)] }).ok).toBe(false);
  });
});
