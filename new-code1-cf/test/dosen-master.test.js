import { describe, it, expect } from 'vitest';
import { validateDosenAgainstMaster, dosenMasterErrorMessage } from '../src/dosen.js';

const MASTER = ['dr. Andi', 'dr. Budi'];

describe('validateDosenAgainstMaster', () => {
  it('mengganti varian ke nama master kanonik', () => {
    const r = validateDosenAgainstMaster(['DR.  ANDI'], MASTER, []);
    expect(r.invalid).toEqual([]);
    expect(r.list).toEqual(['dr. Andi']);
  });

  it('menolak nama baru di luar master', () => {
    const r = validateDosenAgainstMaster(['dr. Asing'], MASTER, []);
    expect(r.invalid).toEqual(['dr. Asing']);
  });

  it('mempertahankan nama lama yang sudah terpasang', () => {
    const r = validateDosenAgainstMaster(['dr. Legacy'], MASTER, ['dr. Legacy']);
    expect(r.invalid).toEqual([]);
    expect(r.list).toEqual(['dr. Legacy']);
  });

  it('mengizinkan semua bila master kosong', () => {
    const r = validateDosenAgainstMaster(['x'], [], []);
    expect(r.invalid).toEqual([]);
    expect(r.list).toEqual(['x']);
  });

  it('membuat pesan penolakan yang menyebut nama bermasalah', () => {
    expect(dosenMasterErrorMessage(['dr. Asing'])).toContain('dr. Asing');
    expect(dosenMasterErrorMessage(['dr. Asing'])).toContain('master');
  });
});
