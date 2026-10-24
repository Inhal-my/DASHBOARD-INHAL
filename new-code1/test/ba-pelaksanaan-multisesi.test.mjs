import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const code = readFileSync(new URL('../0_code.gs', import.meta.url), 'utf8');
const gs = readFileSync(new URL('../1_business.gs', import.meta.url), 'utf8');
const pure = readFileSync(new URL('../lib/dashboardPure.mjs', import.meta.url), 'utf8');

function getAuditFn() {
  const start = gs.indexOf('function _buildBaPelaksanaanAudit');
  const end = gs.indexOf('function _attachBaToLaporanRows', start);
  assert.ok(start !== -1 && end > start, 'helper audit tidak ditemukan');
  const src = gs.slice(start, end);
  return new Function(src + '\nreturn _buildBaPelaksanaanAudit;')();
}

function unit(baPelaksanaan) {
  return {
    key: 'sgd|a|sgd 1', bagian: 'SGD', blok: 'A', label: 'SGD 1',
    peserta: [{ npm: '2201010001', namaLengkap: 'Aisyah' }],
    baPelaksanaan
  };
}

function ba(over) {
  return Object.assign({
    baId: 'BA-PEL-2026-0001', sumber: 'Bagian', tanggal: '2026-09-20', jam: '08:00',
    dosen: 'dr. Andi', fileUrl: 'https://drive.test/ba-1.pdf', jadwalId: '',
    timestamp: '2026-09-20T10:00:00', peserta: [{ npm: '2201010001', namaLengkap: 'Aisyah' }]
  }, over || {});
}

describe('BA Pelaksanaan multi-sesi GAS', () => {
  it('menyimpan kolom Label dan Kegiatan Key pada BeritaAcara', () => {
    assert.match(code, /BeritaAcara: \[[\s\S]*?'Label',\s*'Kegiatan Key'/);
  });

  it('mengizinkan unggahan sesi tambahan tanpa memblokir tanggal yang sama', () => {
    assert.doesNotMatch(gs, /sudah ada berita acara untuk/);
    assert.match(gs, /'Kegiatan Key': _kegiatanKey\(/);
  });

  it('menghitung dua sesi, walau file URL sama', () => {
    const audit = getAuditFn()([unit([
      ba({ baId: 'BA-PEL-2026-0001', jam: '08:00' }),
      ba({ baId: 'BA-PEL-2026-0002', jam: '13:00', timestamp: '2026-09-21T10:00:00' })
    ])], []);
    assert.equal(audit.rows.length, 1);
    assert.equal(audit.rows[0].jumlahSesi, 2);
    assert.equal(audit.rows[0].status, 'Multi-sesi');
    assert.deepEqual(audit.rows[0].sesi.map((s) => s.baId), ['BA-PEL-2026-0001', 'BA-PEL-2026-0002']);
    assert.equal(audit.summary.multiSesi, 1);
    assert.equal(audit.summary.totalSesi, 2);
  });

  it('menandai sesi ekstra, draft, duplikat, dan jadwal belum', () => {
    const audit = getAuditFn()([unit([
      ba({ baId: 'BA-PEL-2026-0001', jadwalId: 'JDW-1' }),
      ba({ baId: 'BA-PEL-2026-0002', jadwalId: '', fileUrl: '' })
    ])], [
      { jadwalId: 'JDW-1', kegiatanKey: 'sgd|a|sgd 1' },
      { jadwalId: 'JDW-2', kegiatanKey: 'sgd|a|sgd 1' }
    ]);
    const row = audit.rows[0];
    assert.equal(row.sesiEkstra, 1);
    assert.equal(row.sesiDraft, 1);
    assert.equal(row.jadwalBelum, 1);
    assert.ok(row.sesi[1].flags.includes('Sesi ekstra'));
    assert.ok(row.sesi[1].flags.includes('Draft'));
    assert.equal(row.sesi[0].jadwalCocok, true);
    assert.equal(row.sesi[1].jadwalCocok, null);
  });

  it('menandai kemungkinan duplikat', () => {
    const audit = getAuditFn()([unit([
      ba({ baId: 'BA-PEL-2026-0001' }),
      ba({ baId: 'BA-PEL-2026-0002' })
    ])], []);
    assert.equal(audit.rows[0].kemungkinanDuplikat, 1);
    assert.ok(audit.rows[0].sesi[0].flags.includes('Kemungkinan duplikat'));
  });

  it('melampirkan audit ke bootstrap dan agregasi bagian', () => {
    assert.match(gs, /_buildBaPelaksanaanAudit\(auditUnits, auditJadwal\)/);
    assert.match(gs, /baAudit: \{ rows: baAudit\.rows, summary: baAudit\.summary \}/);
    assert.match(gs, /_buildBaPelaksanaanAudit\(units, auditJadwal\)/);
  });

  it('tidak menggabungkan sesi berdasarkan file URL', () => {
    assert.ok(gs.includes("[b.sumber, b.baId].join('|')"));
    assert.ok(pure.includes("[b.sumber, b.baId].join('|')"));
  });
});
