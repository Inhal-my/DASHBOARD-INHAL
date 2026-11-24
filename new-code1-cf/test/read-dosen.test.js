import { describe, it, expect } from 'vitest';
import { baDosenListFor } from '../src/read/dosen.js';

describe('baDosenListFor', () => {
  const baDosenMap = {
    'BA-1': ['dr. Wan', 'dr. Iqrina'],
    'BA-2': ['dr. Wan']
  };
  const jadwalDosenMap = {
    'JDW-1': ['dr. Iqrina'],
    'JDW-2': ['dr. Iqrina'],
    'JDW-3': []
  };

  it('mengutamakan dosen dari jadwal yang tertaut', () => {
    expect(baDosenListFor(baDosenMap, jadwalDosenMap, 'BA-1', ['JDW-1'], 'dr. Wan')).toEqual(['dr. Iqrina']);
  });

  it('menggabungkan dosen unik dari beberapa jadwal', () => {
    expect(baDosenListFor(baDosenMap, jadwalDosenMap, 'BA-1', ['JDW-1', 'JDW-2'], '')).toEqual(['dr. Iqrina']);
  });

  it('jatuh ke relasi ba_dosen bila semua jadwal tidak punya dosen', () => {
    expect(baDosenListFor(baDosenMap, jadwalDosenMap, 'BA-1', ['JDW-3'], 'dr. Cadangan')).toEqual(['dr. Wan', 'dr. Iqrina']);
  });

  it('jatuh ke kolom teks BA bila relasi ba_dosen kosong', () => {
    expect(baDosenListFor({}, {}, 'BA-9', [], 'dr. Teks, MKT')).toEqual(['dr. Teks, MKT']);
  });
});
