import { describe, it, expect } from 'vitest';
import { buildBaPelaksanaanAudit } from '../src/read/baAudit.js';

function unit(baPelaksanaan) {
  return {
    key: 'sgd|a|sgd 1',
    bagian: 'SGD',
    blok: 'A',
    label: 'SGD 1',
    peserta: [
      { npm: '2201010001', namaLengkap: 'Aisyah' },
      { npm: '2201010002', namaLengkap: 'Budi' }
    ],
    baPelaksanaan
  };
}

function ba(over) {
  return Object.assign({
    'BA ID': 'BA-PEL-2026-0001',
    Label: '',
    'Tanggal Pelaksanaan': '2026-09-20',
    Jam: '08:00',
    Dosen: 'dr. Andi',
    'File URL': 'https://drive.test/ba-1.pdf',
    'Base File URL': '',
    'Jadwal ID': '',
    Timestamp: '2026-09-20T10:00:00',
    peserta: [{ npm: '2201010001', namaLengkap: 'Aisyah' }]
  }, over || {});
}

describe('buildBaPelaksanaanAudit', () => {
  it('menghitung dua BA untuk kegiatan yang sama sebagai multi-sesi', () => {
    const audit = buildBaPelaksanaanAudit([
      unit([
        ba({ 'BA ID': 'BA-PEL-2026-0002', Jam: '13:00', Timestamp: '2026-09-21T10:00:00' }),
        ba({ 'BA ID': 'BA-PEL-2026-0001', Jam: '08:00' })
      ])
    ], []);

    expect(audit.rows).toHaveLength(1);
    const row = audit.rows[0];
    expect(row.jumlahSesi).toBe(2);
    expect(row.status).toBe('Multi-sesi');
    expect(row.sesi.map((s) => s.baId)).toEqual(['BA-PEL-2026-0001', 'BA-PEL-2026-0002']);
    expect(row.sesi.map((s) => s.index)).toEqual([1, 2]);
    expect(audit.summary.multiSesi).toBe(1);
    expect(audit.summary.totalSesi).toBe(2);
  });

  it('tetap menghitung dua sesi walau file URL sama', () => {
    const audit = buildBaPelaksanaanAudit([
      unit([
        ba({ 'BA ID': 'BA-PEL-2026-0001', Jam: '08:00' }),
        ba({ 'BA ID': 'BA-PEL-2026-0002', Jam: '10:00' })
      ])
    ], []);

    expect(audit.rows[0].jumlahSesi).toBe(2);
  });

  it('menandai sesi ekstra dan jadwal yang belum terealisasi', () => {
    const audit = buildBaPelaksanaanAudit([
      unit([
        ba({ 'BA ID': 'BA-PEL-2026-0001', 'Jadwal ID': 'JDW-1' }),
        ba({ 'BA ID': 'BA-PEL-2026-0002', 'Jadwal ID': '' })
      ])
    ], [
      { jadwalId: 'JDW-1', kegiatanKey: 'sgd|a|sgd 1' },
      { jadwalId: 'JDW-2', kegiatanKey: 'sgd|a|sgd 1' }
    ]);

    const row = audit.rows[0];
    expect(row.jadwalCount).toBe(2);
    expect(row.sesiEkstra).toBe(1);
    expect(row.jadwalBelum).toBe(1);
    expect(row.sesi.find((s) => s.baId === 'BA-PEL-2026-0001').jadwalCocok).toBe(true);
    expect(row.sesi.find((s) => s.baId === 'BA-PEL-2026-0002').jadwalCocok).toBe(null);
    expect(row.sesi.find((s) => s.baId === 'BA-PEL-2026-0002').flags).toContain('Sesi ekstra');
  });

  it('menandai sesi draft dan kemungkinan duplikat', () => {
    const audit = buildBaPelaksanaanAudit([
      unit([
        ba({ 'BA ID': 'BA-PEL-2026-0001', Jam: '08:00', Dosen: 'dr. Andi' }),
        ba({ 'BA ID': 'BA-PEL-2026-0002', Jam: '08:00', Dosen: 'dr. Andi', 'File URL': '' })
      ])
    ], []);

    const row = audit.rows[0];
    expect(row.sesiDraft).toBe(1);
    expect(row.kemungkinanDuplikat).toBe(1);
    expect(row.sesi[0].flags).toContain('Kemungkinan duplikat');
    expect(row.sesi[1].flags).toContain('Draft');
  });

  it('mengembalikan status Belum dan Satu sesi', () => {
    const kosong = buildBaPelaksanaanAudit([unit([])], []);
    expect(kosong.rows[0].status).toBe('Belum');
    expect(kosong.rows[0].jumlahSesi).toBe(0);

    const satu = buildBaPelaksanaanAudit([unit([ba()])], []);
    expect(satu.rows[0].status).toBe('Satu sesi');
    expect(satu.rows[0].jumlahSesi).toBe(1);
  });
});
