import { describe, it, expect } from 'vitest';
import { computeUnitProgress } from '../src/read/kegiatan.js';

describe('computeUnitProgress', () => {
  it('menandai tahap sebagian dan selesai', () => {
    const unit = {
      peserta: [
        { statusPengajuan: 'ACC', masukBa: true },
        { statusPengajuan: 'Menunggu', masukBa: false }
      ],
      baPendukung: [{ baId: 'BA-2026-0001' }],
      baPelaksanaan: [{ baId: 'BA-2026-0011', tanggal: '2026-09-20', jam: '09:00', dosen: 'dr. Andi', fileUrl: 'https://drive/ba' }]
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

  it('menghitung ACC dan Ditolak sama-sama sebagai keputusan', () => {
    const unit = {
      peserta: [
        { statusPengajuan: 'ACC' },
        { statusPengajuan: 'Ditolak' },
        { statusPengajuan: 'Menunggu' }
      ],
      baPendukung: [],
      baPelaksanaan: []
    };
    const p = computeUnitProgress(unit);
    expect(p.counts.keputusan).toBe(2);
    expect(p.keputusan).toBe('partial');
  });

  it('membaca field BA bergaya klien (Dosen/Tanggal Pelaksanaan/Jam)', () => {
    const unit = {
      peserta: [{ statusPengajuan: 'ACC' }],
      baPendukung: [],
      baPelaksanaan: [{ 'BA ID': 'BA-2026-0001', 'Tanggal Pelaksanaan': '2026-09-02', Jam: '08:00', Dosen: 'dr. Ilham', 'File URL': 'https://drive/ba' }]
    };
    const p = computeUnitProgress(unit);
    expect(p.selesai).toBe('all');
  });

  it('selesai hanya bila dosen, tanggal, dan jam lengkap', () => {
    const unit = {
      peserta: [{ statusPengajuan: 'ACC' }],
      baPendukung: [],
      baPelaksanaan: [{ baId: 'BA-2026-0011', tanggal: '2026-09-20', jam: '', dosen: 'dr. Andi', fileUrl: 'https://drive/ba' }]
    };
    const p = computeUnitProgress(unit);
    expect(p.pelaksanaan).toBe('all');
    expect(p.selesai).toBe('none');
  });

  it('selesai menuntut berkas BA, bukan hanya dosen/tanggal/jam', async () => {
    const unit = {
      peserta: [{ statusPengajuan: 'ACC' }],
      baPendukung: [],
      baPelaksanaan: [
        { baId: 'BA-2026-0011', tanggal: '2026-09-20', jam: '09:00', dosen: 'dr. Andi', fileUrl: '' },
        { 'BA ID': 'BA-2026-0012', 'Tanggal Pelaksanaan': '2026-09-21', Jam: '10:00', Dosen: 'dr. Andi', 'File URL': '' }
      ]
    };
    const p = computeUnitProgress(unit);
    expect(p.pelaksanaan).toBe('all');
    expect(p.selesai).toBe('none');

    // Satu BA berberkas sudah cukup menandai tahap selesai.
    const berberkas = Object.assign({}, unit, {
      baPelaksanaan: unit.baPelaksanaan.concat([{ baId: 'BA-2026-0013', tanggal: '2026-09-22', jam: '11:00', dosen: 'dr. Andi', fileUrl: 'https://drive/ba' }])
    });
    expect(computeUnitProgress(berberkas).selesai).toBe('all');
  });
});
