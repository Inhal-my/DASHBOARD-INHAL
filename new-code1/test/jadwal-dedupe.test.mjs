import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const business = readFileSync(new URL('../1_business.gs', import.meta.url), 'utf8');

function loadHelpers() {
  const start = business.indexOf('function _jadwalIdentity');
  const end = business.indexOf('function _computeJadwalList', start);
  assert.ok(start >= 0 && end > start, 'helper dedupe jadwal harus tersedia');
  const factory = new Function('_clientTime', business.slice(start, end) + '\nreturn { _dedupeJadwalList };');
  return factory((v) => String(v || ''));
}

const base = {
  Bagian: 'KKD', Blok: 'A', NamaKegiatan: 'KKD BM - Inhal', Tanggal: '2026-10-19T00:00:00',
  Jam: '15:15', Dosen: 'dr. Sharlini Desfika Nasution, M. Biomed', Catatan: '',
  peserta: [{ idPengajuan: 'INHAL-1', npm: '2308260024' }, { idPengajuan: 'INHAL-2', npm: '2308260131' }]
};

describe('dedupe jadwal GAS', () => {
  it('menyembunyikan baris identik dan memilih baris yang punya BA', () => {
    const { _dedupeJadwalList } = loadHelpers();
    const first = Object.assign({}, base, { JadwalID: 'JDW-2026-0001', punyaBa: false, baId: '' });
    const second = Object.assign({}, base, { JadwalID: 'JDW-2026-0002', punyaBa: true, baId: 'BA-PEL-2026-0009' });
    const list = _dedupeJadwalList([first, second]);
    assert.equal(list.length, 1);
    assert.equal(list[0].JadwalID, 'JDW-2026-0002');
    assert.equal(list[0].baId, 'BA-PEL-2026-0009');
  });

  it('tetap menampilkan jadwal berbeda jam atau peserta', () => {
    const { _dedupeJadwalList } = loadHelpers();
    const first = Object.assign({}, base, { JadwalID: 'JDW-2026-0001' });
    const otherJam = Object.assign({}, base, { JadwalID: 'JDW-2026-0002', Jam: '16:00' });
    const otherPeserta = Object.assign({}, base, {
      JadwalID: 'JDW-2026-0003',
      peserta: [{ idPengajuan: 'INHAL-3', npm: '2308260111' }]
    });
    assert.equal(_dedupeJadwalList([first, otherJam, otherPeserta]).length, 3);
  });
});
