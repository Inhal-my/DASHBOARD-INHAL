import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeBiayaDump } from '../audit-biaya-detail.mjs';

const SCHEMA = `
CREATE TABLE master_biaya (id INTEGER PRIMARY KEY AUTOINCREMENT, kegiatan TEXT, biaya TEXT);
CREATE TABLE pengajuan (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, id_pengajuan TEXT UNIQUE,
  npm TEXT, nama_lengkap TEXT, jenis_kegiatan TEXT, status TEXT
);
CREATE TABLE detail_kegiatan (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, id_pengajuan TEXT,
  jenis_kegiatan TEXT, pilihan TEXT, detail TEXT
);
CREATE TABLE check_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT, id_pengajuan TEXT, pilihan TEXT, detail TEXT,
  tanggal_pelaksanaan TEXT, biaya TEXT
);
`;

function dump(extra) {
  return SCHEMA + extra;
}

const MASTER = `
  INSERT INTO master_biaya (kegiatan, biaya) VALUES
    ('Inhal', 'Rp. 250.000'),
    ('Remediasi', 'Rp. 300.000'),
    ('Praktikum', 'Rp. 250.000'),
    ('PostTest', 'Rp. 250.000');
`;

test('menghitung ulang biaya KKD/SGD/Ujian dari Detail Inhal', () => {
  const result = analyzeBiayaDump(dump(MASTER + `
    INSERT INTO pengajuan (id_pengajuan, npm, nama_lengkap, jenis_kegiatan, status) VALUES
      ('P1', '001', 'A', 'KKD', 'ACC'),
      ('P2', '002', 'B', 'SGD', 'ACC'),
      ('P3', '003', 'C', 'Ujian', 'ACC');
    INSERT INTO detail_kegiatan (id_pengajuan, jenis_kegiatan, pilihan, detail) VALUES
      ('P1', 'KKD', 'KKD 1', 'Inhal'),
      ('P2', 'SGD', 'SGD 1', ''),
      ('P3', 'Ujian', 'UAS', '');
  `));

  assert.equal(result.summary.totalPengajuan, 3);
  assert.equal(result.summary.totalLama, 0);
  assert.equal(result.summary.totalBaru, 750000);
  assert.equal(result.summary.selisih, 750000);
  assert.equal(result.summary.barisBerubah, 3);
  assert.equal(result.summary.totalBaruRupiah, 'Rp 750.000');
});

test('mempertahankan override dan menghitung Remediasi Praktikum 300k', () => {
  const result = analyzeBiayaDump(dump(MASTER + `
    INSERT INTO pengajuan (id_pengajuan, npm, nama_lengkap, jenis_kegiatan, status) VALUES
      ('P1', '001', 'A', 'Praktikum', 'ACC'),
      ('P2', '002', 'B', 'KKD', 'ACC');
    INSERT INTO detail_kegiatan (id_pengajuan, jenis_kegiatan, pilihan, detail) VALUES
      ('P1', 'Praktikum', 'Lab A', 'Remediasi'),
      ('P2', 'KKD', 'KKD 1', 'Inhal');
    INSERT INTO check_data (id_pengajuan, pilihan, detail, tanggal_pelaksanaan, biaya) VALUES
      ('P2', '', 'BIAYA-OVERRIDE', '', '100000');
  `));

  const p1 = result.perubahan.find((c) => c.idPengajuan === 'P1');
  assert.equal(p1.biayaLama, 250000);
  assert.equal(p1.biayaBaru, 300000);
  const p2 = result.perubahan.find((c) => c.idPengajuan === 'P2');
  assert.equal(p2, undefined);
  assert.equal(result.summary.totalOverride, 1);
  assert.equal(result.summary.totalBaru, 400000);
});

test('detail Kosong pada KKD/SGD dianggap Inhal (tanpa perubahan bila sudah Inhal)', () => {
  const result = analyzeBiayaDump(dump(MASTER + `
    INSERT INTO pengajuan (id_pengajuan, npm, nama_lengkap, jenis_kegiatan, status) VALUES
      ('P1', '001', 'A', 'KKD', 'ACC');
    INSERT INTO detail_kegiatan (id_pengajuan, jenis_kegiatan, pilihan, detail) VALUES
      ('P1', 'KKD', 'KKD 1', '');
  `));
  assert.equal(result.perubahan[0].detail, 'Inhal');
  assert.equal(result.perubahan[0].biayaBaru, 250000);
});

test('menolak dump tanpa tabel yang dibutuhkan', () => {
  assert.throws(() => analyzeBiayaDump('CREATE TABLE pengajuan (id_pengajuan TEXT);'), /tidak ditemukan/);
});
