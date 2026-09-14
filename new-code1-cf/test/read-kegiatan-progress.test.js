import { describe, it, expect } from 'vitest';
import { computeUnitProgress } from '../src/read/kegiatan.js';

describe('computeUnitProgress', () => {
  it('menandai tahap sebagian dan selesai', () => {
    const unit = {
      peserta: [
        { statusPengajuan: 'Diterima', linkFinal: 'x' },
        { statusPengajuan: 'Menunggu', linkFinal: '' }
      ],
      baPendukung: [{ baId: 'BA-2026-0001' }],
      baPelaksanaan: [{ baId: 'BA-2026-0011', tanggal: '2026-09-20', jam: '09:00', dosen: 'dr. Andi' }]
    };
    const p = computeUnitProgress(unit);
    expect(p.pendaftaran).toBe('all');
    expect(p.pendukung).toBe('all');
    expect(p.keputusan).toBe('partial');
    expect(p.final).toBe('partial');
    expect(p.pelaksanaan).toBe('all');
    expect(p.selesai).toBe('all');
    expect(p.counts).toEqual({ peserta: 2, keputusan: 1, final: 1 });
  });

  it('selesai hanya bila dosen, tanggal, dan jam lengkap', () => {
    const unit = {
      peserta: [{ statusPengajuan: 'ACC', linkFinal: 'x' }],
      baPendukung: [],
      baPelaksanaan: [{ baId: 'BA-2026-0011', tanggal: '2026-09-20', jam: '', dosen: 'dr. Andi' }]
    };
    const p = computeUnitProgress(unit);
    expect(p.pelaksanaan).toBe('all');
    expect(p.selesai).toBe('none');
  });
});
