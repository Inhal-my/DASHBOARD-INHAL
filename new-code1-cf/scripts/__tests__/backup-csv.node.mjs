import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CSV_MANIFEST_FILE, buildCsvBlock, buildCsvManifest, csvCell, csvDirName, csvFileName, toCsv
} from '../lib/backup-csv.mjs';

test('csvCell mengikuti RFC 4180 dan menormalkan nilai kosong', () => {
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(undefined), '');
  assert.equal(csvCell(''), '');
  assert.equal(csvCell('polos'), 'polos');
  assert.equal(csvCell(42), '42');
  assert.equal(csvCell(0), '0');
  assert.equal(csvCell(Number.NaN), '');
  assert.equal(csvCell(true), '1');
  assert.equal(csvCell(false), '0');
  // Koma dan kutip memaksa sel dikutip, kutip di dalam digandakan.
  assert.equal(csvCell('koma, di sini'), '"koma, di sini"');
  assert.equal(csvCell('kata "kutip"'), '"kata ""kutip"""');
  // Baris baru (LF maupun CRLF) dikutip; CRLF dinormalkan menjadi LF.
  assert.equal(csvCell('baris1\nbaris2'), '"baris1\nbaris2"');
  assert.equal(csvCell('baris1\r\nbaris2'), '"baris1\nbaris2"');
});

test('toCsv menulis header, urutan kolom, dan akhiran CRLF', () => {
  const csv = toCsv(['tabel', 'nilai'], [
    { tabel: 'pengajuan', nilai: 'a,b' },
    { tabel: 'kosong', nilai: null }
  ]);
  assert.equal(csv, 'tabel,nilai\r\npengajuan,"a,b"\r\nkosong,\r\n');
  assert.equal(csv.endsWith('\r\n'), true);
  // Kunci yang tidak diminta diabaikan, kunci yang hilang menjadi sel kosong.
  assert.equal(toCsv(['a'], [{ a: 1, lain: 'x' }, {}]), 'a\r\n1\r\n\r\n');
  assert.equal(toCsv([], []), '\r\n');
  assert.equal(toCsv(null, null), '\r\n');
});

test('nama berkas dan folder CSV aman dipakai di semua OS', () => {
  assert.equal(csvFileName('pengajuan'), 'pengajuan.csv');
  assert.equal(csvFileName('berita_acara_admin_berkas'), 'berita_acara_admin_berkas.csv');
  assert.equal(csvFileName('nama dengan spasi/dan*simbol'), 'nama_dengan_spasi_dan_simbol.csv');
  assert.equal(csvFileName(''), 'tabel.csv');
  assert.equal(csvFileName(null), 'tabel.csv');
  assert.equal(csvDirName('20261031-0100'), '20261031-0100-csv');
  assert.equal(csvDirName(''), 'backup-csv');
});

test('buildCsvManifest meringkas berkas CSV dalam satu berkas CSV', () => {
  const csv = buildCsvManifest([
    { table: 'mahasiswa', file: 'mahasiswa.csv', rows: 2, columns: 4, bytes: 120, sha256: 'AAA' },
    { table: 'pengajuan', file: 'pengajuan.csv', rows: 3, columns: 40, bytes: 900, sha256: 'BBB' }
  ]);
  const lines = csv.trimEnd().split('\r\n');
  assert.equal(lines[0], 'tabel,file,baris,kolom,bytes,sha256');
  assert.equal(lines[1], 'mahasiswa,mahasiswa.csv,2,4,120,AAA');
  assert.equal(lines[2], 'pengajuan,pengajuan.csv,3,40,900,BBB');
  assert.equal(CSV_MANIFEST_FILE, 'manifest.csv');
});

test('buildCsvBlock menghitung total dan memakai nama folder berlabel', () => {
  const block = buildCsvBlock('20261031-0100', [
    { table: 'mahasiswa', file: 'mahasiswa.csv', rows: 2, columns: 4, bytes: 120, sha256: 'AAA' },
    { table: 'pengajuan', file: 'pengajuan.csv', rows: 3, columns: 40, bytes: 900, sha256: 'BBB' }
  ]);
  assert.equal(block.dir, '20261031-0100-csv');
  assert.equal(block.manifestFile, '20261031-0100-csv/manifest.csv');
  assert.equal(block.tables.length, 2);
  assert.equal(block.totalRows, 5);
  assert.equal(block.totalBytes, 1020);
  assert.equal(block.tables[0].sha256, 'AAA');

  const kosong = buildCsvBlock('DRILL', []);
  assert.equal(kosong.totalRows, 0);
  assert.equal(kosong.totalBytes, 0);
  assert.deepEqual(kosong.tables, []);
});
