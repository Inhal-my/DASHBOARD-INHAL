import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  kegiatanKey, computeUnitProgress, rowsMatchFingerprint,
  parseMahasiswaCsv, planMahasiswaCsvUpsert, attachBaToUnits, filterPageRows, MAHASISWA_CSV_MAX
} from '../lib/dashboardPure.mjs';

const MHS_COLS = ['NPM', 'Nama Lengkap', 'Email', 'Blok', 'Keterangan'];

describe('filterPageRows', () => {
  const rows = [];
  for (let i = 1; i <= 45; i++) rows.push({ NPM: String(1000 + i), 'Nama Lengkap': 'Mhs ' + i, Email: '', Blok: 'B' + (i % 3), Keterangan: '' });
  it('membagi halaman sesuai pageSize', () => {
    const p1 = filterPageRows(rows, '', MHS_COLS, 1, 20);
    assert.equal(p1.total, 45);
    assert.equal(p1.pages, 3);
    assert.equal(p1.rows.length, 20);
    assert.equal(p1.rows[0].NPM, '1001');
    const p3 = filterPageRows(rows, '', MHS_COLS, 3, 20);
    assert.equal(p3.rows.length, 5);
  });
  it('menyaring lintas kolom lalu memaginasi', () => {
    const p = filterPageRows(rows, 'B2', MHS_COLS, 1, 20);
    assert.equal(p.total, 15);
    assert.equal(p.rows.length, 15);
    assert.ok(p.rows.every((r) => r.Blok === 'B2'));
  });
  it('meng-clamp halaman di luar rentang', () => {
    const p = filterPageRows(rows, '', MHS_COLS, 99, 20);
    assert.equal(p.page, 3);
    assert.equal(p.rows.length, 5);
  });
  it('aman untuk data kosong', () => {
    const p = filterPageRows([], 'abc', MHS_COLS, 1, 20);
    assert.deepEqual(p, { rows: [], total: 0, pages: 1, page: 1, pageSize: 20 });
  });
});

describe('kegiatanKey', () => {
  it('menormalkan spasi dan huruf', () => {
    assert.equal(kegiatanKey('SGD', 'Blok 1', 'Tutorial - A'), kegiatanKey('sgd', '  BLOK 1 ', 'Tutorial - A'));
  });
});

describe('computeUnitProgress', () => {
  it('menandai tahap sebagian dan selesai', () => {
    const p = computeUnitProgress({
      peserta: [
        { statusPengajuan: 'Diterima', linkFinal: 'x' },
        { statusPengajuan: 'Menunggu', linkFinal: '' }
      ],
      baPendukung: [{ baId: 'BA-1' }],
      baPelaksanaan: [{ baId: 'BA-2', tanggal: '2026-09-20', jam: '09:00', dosen: 'dr. Andi' }]
    });
    assert.equal(p.pendaftaran, 'all');
    assert.equal(p.pendukung, 'all');
    assert.equal(p.keputusan, 'partial');
    assert.equal(p.final, 'partial');
    assert.equal(p.pelaksanaan, 'all');
    assert.equal(p.selesai, 'all');
    assert.deepEqual(p.counts, { peserta: 2, keputusan: 1, final: 1 });
  });
  it('selesai hanya bila dosen, tanggal, dan jam lengkap', () => {
    const p = computeUnitProgress({
      peserta: [{ statusPengajuan: 'ACC', linkFinal: 'x' }],
      baPendukung: [],
      baPelaksanaan: [{ baId: 'BA-2', tanggal: '2026-09-20', jam: '', dosen: 'dr. Andi' }]
    });
    assert.equal(p.pelaksanaan, 'all');
    assert.equal(p.selesai, 'none');
  });
  it('membaca field klien Dosen/Tanggal Pelaksanaan/Jam', () => {
    const p = computeUnitProgress({
      peserta: [{ statusPengajuan: 'ACC', linkFinal: 'x' }],
      baPendukung: [],
      baPelaksanaan: [{ 'BA ID': 'BA-1', 'Tanggal Pelaksanaan': '2026-09-02', Jam: '08:00', Dosen: 'dr. Ilham' }]
    });
    assert.equal(p.selesai, 'all');
  });
});

describe('fingerprint', () => {
  const cols = ['Kategori', 'Nilai'];
  it('cocok jika trim sama', () => {
    assert.equal(rowsMatchFingerprint({ Kategori: 'Blok', Nilai: '1' }, { Kategori: ' Blok ', Nilai: '1' }, cols), true);
  });
  it('stale jika isi beda', () => {
    assert.equal(rowsMatchFingerprint({ Kategori: 'Blok', Nilai: '2' }, { Kategori: 'Blok', Nilai: '1' }, cols), false);
  });
});

describe('CSV mahasiswa', () => {
  it('parse header NPM + Nama Lengkap', () => {
    const r = parseMahasiswaCsv('NPM,Nama Lengkap\n123,Ada\n,Kosong\n456,Budi');
    assert.deepEqual(r.rows, [
      { npm: '123', namaLengkap: 'Ada' },
      { npm: '', namaLengkap: 'Kosong' },
      { npm: '456', namaLengkap: 'Budi' }
    ]);
  });
  it('tolak tanpa header wajib', () => {
    assert.ok(parseMahasiswaCsv('A,B\n1,2').error);
  });
  it('tolak duplikat NPM di file dan hitung insert/update', () => {
    const parsed = parseMahasiswaCsv('npm,nama\n1,A\n1,B');
    const plan = planMahasiswaCsvUpsert(parsed.rows, new Set());
    assert.ok(plan.error && plan.error.indexOf('duplikat') !== -1);
    const ok = planMahasiswaCsvUpsert(
      parseMahasiswaCsv('NPM,Nama Lengkap\n1,A\n2,B\n,X').rows,
      new Set(['1'])
    );
    assert.equal(ok.insert, 1);
    assert.equal(ok.update, 1);
    assert.equal(ok.skipped, 1);
    assert.equal(ok.parsed.length, 2);
  });
  it('menolak lebih dari MAHASISWA_CSV_MAX', () => {
    const rows = [];
    for (let i = 0; i < MAHASISWA_CSV_MAX + 1; i++) rows.push({ npm: String(i), namaLengkap: 'X' });
    assert.ok(planMahasiswaCsvUpsert(rows, new Set()).error);
  });
});

describe('attachBaToUnits', () => {
  it('cocok NPM dulu, lalu nama; sisanya orphan', () => {
    const units = [
      { key: 'sgd|blok 1|tutorial a', bagian: 'SGD', blok: 'Blok 1', label: 'Tutorial A', peserta: [{ npm: '111' }], ba: [] },
      { key: 'kkd|blok 1|klinik', bagian: 'KKD', blok: 'Blok 1', label: 'Klinik', peserta: [{ npm: '222' }], ba: [] }
    ];
    const baList = [
      { baId: 'BA-1', bagian: 'SGD', blok: 'Blok 1', namaKegiatan: 'Tutorial A extra', tanggal: '2026-01-01', fileUrl: 'u1', sumber: 'Admin', peserta: [{ npm: '111' }] },
      { baId: 'BA-2', bagian: 'KKD', blok: 'Blok 1', namaKegiatan: 'Klinik', tanggal: '2026-01-02', fileUrl: 'u2', sumber: 'Bagian', peserta: [] },
      { baId: 'BA-3', bagian: 'Ujian', blok: 'Blok 9', namaKegiatan: 'X', tanggal: '2026-01-03', fileUrl: 'u3', sumber: 'Admin', peserta: [] }
    ];
    const resolve = (b) => b;
    const out = attachBaToUnits(units, baList, resolve);
    assert.equal(units[0].ba[0].baId, 'BA-1');
    assert.equal(units[1].ba[0].baId, 'BA-2');
    assert.equal(out.orphanBa.length, 1);
    assert.equal(out.orphanBa[0].baId, 'BA-3');
  });
  it('kegiatanKey langsung menang', () => {
    const units = [{ key: 'sgd|b1|t', bagian: 'SGD', blok: 'B1', label: 'T', peserta: [], ba: [] }];
    const baList = [{ baId: 'BA-9', kegiatanKey: 'sgd|b1|t', bagian: 'X', blok: 'Y', namaKegiatan: 'Z', tanggal: '', fileUrl: '', sumber: 'Admin', peserta: [] }];
    attachBaToUnits(units, baList, (b) => b);
    assert.equal(units[0].ba[0].baId, 'BA-9');
  });
});
