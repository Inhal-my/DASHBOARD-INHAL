import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';

async function loadReport() {
  const res = await env.ASSETS.fetch(new Request('https://example.com/dosen-report.js'));
  expect(res.status).toBe(200);
  const src = await res.text();
  const fake = {};
  new Function('window', src)(fake);
  return fake.DosenReport;
}

const COLS = ['KKD', 'SGD', 'Ujian'];

function ba(overrides) {
  return Object.assign({
    id: 'BA-1',
    kegiatanKey: 'kkd|a|kkd bm - inhal',
    bagian: 'KKD',
    blok: 'A',
    jenis: 'KKD',
    label: 'KKD BM - Inhal',
    tanggal: '2026-09-20',
    jam: '08:00',
    sesiCount: 1,
    status: 'Lengkap',
    flags: [],
    peserta: [{ npm: '001' }],
    dosenList: ['dr. Nanda Sari'],
    fileUrl: 'https://x/ba.pdf',
    jadwalIds: ['J1']
  }, overrides || {});
}

function jadwal(overrides) {
  return Object.assign({
    id: 'J1',
    kegiatanKey: 'kkd|a|kkd bm - inhal',
    bagian: 'KKD',
    blok: 'A',
    jenis: 'KKD',
    label: 'KKD BM - Inhal',
    tanggal: '2026-09-20',
    jam: '08:00',
    dosenList: ['dr. Nanda Sari'],
    baId: 'BA-1'
  }, overrides || {});
}

describe('buildDosenReport', () => {
  it('menggabungkan varian tanda baca dan menampilkan nama terpanjang', async () => {
    const { buildDosenReport } = await loadReport();
    const data = buildDosenReport({
      baList: [
        ba({ id: 'BA-1', dosenList: ['dr. Desi Afnita Lubis, MKT'] }),
        ba({ id: 'BA-2', kegiatanKey: 'sgd|a|sgd 1', bagian: 'SGD', dosenList: ['dr.Desi Afnita Lubis, MKT'] })
      ],
      jadwalList: [],
      cols: COLS,
      q: ''
    });
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0].label).toBe('dr. Desi Afnita Lubis, MKT');
    expect(data.rows[0].variantCount).toBe(2);
    expect(data.rows[0].totalRealisasi).toBe(2);
    expect(data.rows[0].counts.kkd.realisasi).toBe(1);
    expect(data.rows[0].counts.sgd.realisasi).toBe(1);
  });

  it('menghitung realisasi per sesi dan minimal satu untuk BA tanpa tautan', async () => {
    const { buildDosenReport } = await loadReport();
    const data = buildDosenReport({
      baList: [
        ba({ id: 'BA-1', sesiCount: 4 }),
        ba({ id: 'BA-2', sesiCount: 0, jadwalIds: [], tanggal: '2026-09-21' })
      ],
      jadwalList: [],
      cols: COLS,
      q: ''
    });
    expect(data.rows[0].totalRealisasi).toBe(5);
    expect(data.rows[0].baRows[1].sesiCount).toBe(1);
    expect(data.quality.some((q) => q.type === 'tanpa-sesi' && q.baId === 'BA-2')).toBe(true);
  });

  it('membedakan rencana dosen tampil dan rencana global', async () => {
    const { buildDosenReport } = await loadReport();
    const data = buildDosenReport({
      baList: [ba()],
      jadwalList: [
        jadwal({ id: 'J1', dosenList: ['dr. Nanda Sari'] }),
        jadwal({ id: 'J2', dosenList: ['dr. Nanda Sari'], jam: '10:00' }),
        jadwal({ id: 'J3', dosenList: ['dr. Orang Lain'], jam: '13:00', baId: '' }),
        jadwal({ id: 'J4', kegiatanKey: 'ujian|a|uas', bagian: 'Ujian', dosenList: ['dr. Nanda Sari'] })
      ],
      cols: COLS,
      q: ''
    });
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0].totalRencana).toBe(2);
    expect(data.totals.rencanaTabel).toBe(2);
    expect(data.totals.rencanaGlobal).toBe(3);
    expect(data.totals.dosen).toBe(1);
  });

  it('memberi sesi penuh ke setiap dosen pada BA multi-dosen', async () => {
    const { buildDosenReport } = await loadReport();
    const data = buildDosenReport({
      baList: [ba({ id: 'BA-1', sesiCount: 2, dosenList: ['dr. A', 'dr. B'] })],
      jadwalList: [],
      cols: COLS,
      q: ''
    });
    expect(data.rows).toHaveLength(2);
    expect(data.rows.map((r) => r.totalRealisasi)).toEqual([2, 2]);
    expect(data.totals.baUnik).toBe(1);
    expect(data.totals.baDosen).toBe(2);
  });

  it('memfilter baris berdasarkan nama dosen tanpa mengubah rencana global', async () => {
    const { buildDosenReport } = await loadReport();
    const data = buildDosenReport({
      baList: [
        ba({ id: 'BA-1', dosenList: ['dr. Nanda Sari'] }),
        ba({ id: 'BA-2', kegiatanKey: 'sgd|a|sgd 1', bagian: 'SGD', dosenList: ['dr. Sharlini'] })
      ],
      jadwalList: [jadwal({ id: 'J1' }), jadwal({ id: 'J2', dosenList: ['dr. Sharlini'], baId: 'BA-2' })],
      cols: COLS,
      q: 'nanda'
    });
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0].label).toBe('dr. Nanda Sari');
    expect(data.totals.rencanaGlobal).toBe(2);
  });

  it('menandai draft, tanpa jadwal, dan typo nama', async () => {
    const { buildDosenReport } = await loadReport();
    const data = buildDosenReport({
      baList: [
        ba({ id: 'BA-1', status: 'Draft', dosenList: ['dr. Desi Afnita Lubis, MKT'] }),
        ba({ id: 'BA-2', kegiatanKey: 'sgd|a|sgd 1', bagian: 'SGD', status: 'Lengkap', dosenList: ['dr.desi asfnita lubis. MKT'] })
      ],
      jadwalList: [],
      cols: COLS,
      q: ''
    });
    const types = data.quality.map((q) => q.type);
    expect(types).toContain('draft');
    expect(types).toContain('tanpa-jadwal');
    expect(types).toContain('varian');
    const typo = data.rows.find((r) => r.label.indexOf('asfnita') !== -1);
    expect(typo).toBeTruthy();
    expect(typo.nearDuplicate).toBe('dr. Desi Afnita Lubis, MKT');
  });

  it('mengurutkan baris dosen dan detail kegiatan secara alfabetis', async () => {
    const { buildDosenReport } = await loadReport();
    const data = buildDosenReport({
      baList: [
        ba({ id: 'BA-1', dosenList: ['dr. Zeta'] }),
        ba({ id: 'BA-2', kegiatanKey: 'sgd|a|sgd 1', bagian: 'SGD', dosenList: ['dr. Alpha'] }),
        ba({ id: 'BA-3', kegiatanKey: 'kkd|a|kkd bm - inhal', bagian: 'KKD', dosenList: ['dr. Alpha'] })
      ],
      jadwalList: [],
      cols: ['Ujian', 'SGD', 'KKD'],
      q: ''
    });
    expect(data.rows.map((r) => r.label)).toEqual(['dr. Alpha', 'dr. Zeta']);
    expect(data.rows[0].details.map((d) => d.bagian)).toEqual(['KKD', 'SGD']);
  });

  it('menghitung peserta unik lintas BA', async () => {
    const { buildDosenReport } = await loadReport();
    const data = buildDosenReport({
      baList: [
        ba({ id: 'BA-1', peserta: [{ npm: '001' }, { npm: '002' }] }),
        ba({ id: 'BA-2', tanggal: '2026-09-21', peserta: [{ npm: '002' }, { npm: '003' }] })
      ],
      jadwalList: [],
      cols: COLS,
      q: ''
    });
    expect(data.rows[0].pesertaUnik).toBe(3);
    expect(data.totals.pesertaUnik).toBe(3);
  });
});
