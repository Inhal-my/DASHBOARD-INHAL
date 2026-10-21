import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeJadwalDump } from '../audit-jadwal-duplikat.mjs';

const SCHEMA = `
CREATE TABLE jadwal_pelaksanaan (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, jadwal_id TEXT, bagian TEXT, blok TEXT,
  nama_kegiatan TEXT, kegiatan_key TEXT, tanggal TEXT, jam TEXT, dosen TEXT, catatan TEXT,
  active INTEGER DEFAULT 1, created_by TEXT, updated_at TEXT
);
CREATE TABLE jadwal_peserta (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, jadwal_id TEXT, id_pengajuan TEXT, npm TEXT,
  nama_lengkap TEXT, blok TEXT, status_pengajuan TEXT
);
CREATE TABLE berita_acara (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, ba_id TEXT, jadwal_id TEXT
);
`;

function dump(extra) {
  return SCHEMA + extra;
}

test('dry-run mengelompokkan jadwal aktif yang identik dan memilih baris dengan BA', () => {
  const result = analyzeJadwalDump(dump(`
    INSERT INTO jadwal_pelaksanaan
      (timestamp, jadwal_id, bagian, blok, nama_kegiatan, tanggal, jam, dosen, active)
    VALUES
      ('2026-01-01T08:00:00Z', 'J1', 'Bagian A', 'Blok 1', 'Kegiatan X', '2026-02-01', '08.00', 'Dosen A', 1),
      ('2026-01-02T08:00:00Z', 'J2', 'Bagian A', 'Blok 1', 'Kegiatan X', '2026-02-01', '08:00', 'Dosen A', 1),
      ('2026-01-03T08:00:00Z', 'J3', 'Bagian B', 'Blok 2', 'Kegiatan Y', '2026-02-02', '09.00', 'Dosen B', 1),
      ('2026-01-04T08:00:00Z', 'J4', 'Bagian B', 'Blok 2', 'Kegiatan Y', '2026-02-02', '09:00', 'Dosen B', 1),
      ('2026-01-05T08:00:00Z', 'J5', 'Bagian A', 'Blok 1', 'Kegiatan X', '2026-02-01', '08:00', 'Dosen A', 0);
    INSERT INTO jadwal_peserta (jadwal_id, id_pengajuan, npm)
    VALUES ('J1', 'P1', '2201'), ('J2', 'P1', '2201'),
           ('J3', 'P2', '2202'), ('J4', 'P2', '2202');
    INSERT INTO berita_acara (ba_id, jadwal_id)
    VALUES ('BA-1', 'J2'), ('BA-2', 'J3'), ('BA-3', 'J4');
  `));

  assert.equal(result.summary.totalGroups, 2);
  assert.equal(result.summary.duplicateRows, 4);
  assert.equal(result.summary.extraRows, 2);
  assert.equal(result.summary.manualReviewGroups, 1);
  assert.equal(result.summary.baLinkedRemovals, 1);
  assert.equal(result.summary.inactiveRows, 1);

  const groupA = result.groups.find((g) => g.keep.jadwalId === 'J2');
  assert.ok(groupA);
  assert.deepEqual(groupA.remove.map((r) => r.jadwalId), ['J1']);
  assert.equal(groupA.remove[0].safeToRemove, true);
  assert.equal(groupA.keep.baIds[0], 'BA-1');
  assert.equal(groupA.keep.pesertaCount, 1);

  const groupB = result.groups.find((g) => g.keep.jadwalId === 'J3');
  assert.ok(groupB);
  assert.equal(groupB.needsManualReview, true);
  assert.equal(groupB.remove[0].jadwalId, 'J4');
  assert.equal(groupB.remove[0].safeToRemove, false);
});

test('dry-run tidak menandai jadwal dengan peserta berbeda sebagai duplikat', () => {
  const result = analyzeJadwalDump(dump(`
    INSERT INTO jadwal_pelaksanaan
      (timestamp, jadwal_id, bagian, blok, nama_kegiatan, tanggal, jam, dosen, active)
    VALUES
      ('2026-01-01T08:00:00Z', 'J1', 'Bagian A', 'Blok 1', 'Kegiatan X', '2026-02-01', '08:00', 'Dosen A', 1),
      ('2026-01-02T08:00:00Z', 'J2', 'Bagian A', 'Blok 1', 'Kegiatan X', '2026-02-01', '08:00', 'Dosen A', 1);
    INSERT INTO jadwal_peserta (jadwal_id, id_pengajuan, npm)
    VALUES ('J1', 'P1', '2201'), ('J2', 'P2', '2202');
  `));

  assert.equal(result.summary.totalGroups, 0);
  assert.deepEqual(result.groups, []);
});

test('dry-run menolak dump tanpa tabel jadwal', () => {
  assert.throws(
    () => analyzeJadwalDump('CREATE TABLE contoh (id INTEGER);'),
    /tabel jadwal_pelaksanaan tidak ditemukan/
  );
});
