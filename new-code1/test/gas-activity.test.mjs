import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const source = read('../4_parity.gs');

function activityApi(tables) {
  const start = source.indexOf('// ---------- Activity log ----------');
  const end = source.indexOf('// ---------- Master rename (Blok) ----------');
  assert.ok(start !== -1 && end > start, 'blok activity log tidak ditemukan');
  const block = source.slice(start, end);
  const api = new Function(
    'getAllRows', 'requireAuthorized',
    block + '\nreturn {' +
      '_activityKind, _activityGroup, _actWibDay, _actIsoUtc,' +
      '_actDedupeUploads, _actSummary, getActivityLog' +
      '};'
  );
  return api(
    (name) => (tables[name] || []).slice(),
    () => true
  );
}

const AUDIT = [
  {
    Timestamp: new Date('2026-11-14T01:00:00Z'), 'Actor Email': 'Admin A', Aksi: 'VERIFY', Target: 'Pembayaran',
    Detail: JSON.stringify({ idPengajuan: 'P1', nominal: 50000, kesesuaian: 'sesuai', tanggal: '2026-11-14' }), Alasan: ''
  },
  {
    Timestamp: new Date('2026-11-14T02:00:00Z'), 'Actor Email': 'Admin A', Aksi: 'UPLOAD_BUKTI_ADMIN', Target: 'Pengajuan',
    Detail: JSON.stringify({ idPengajuan: 'P2', linkBukti: 'https://drive.google.com/file/d/ABC123/view' }), Alasan: ''
  },
  {
    Timestamp: new Date('2026-11-14T03:00:00Z'), 'Actor Email': 'Admin B', Aksi: 'BA_DELETE', Target: 'BA-1',
    Detail: JSON.stringify({ jenis: 'Pelaksanaan', jumlahPeserta: 3 }), Alasan: ''
  },
  {
    Timestamp: new Date('2026-11-14T04:00:00Z'), 'Actor Email': 'Admin B', Aksi: 'RENAME_MASTER', Target: 'Blok: A -> B',
    Detail: JSON.stringify({ total: 2 }), Alasan: ''
  }
];

const STATUS = [
  {
    Timestamp: new Date('2026-11-14T05:00:00Z'), 'ID Pengajuan': 'P3', Status: 'Menunggu',
    Catatan: 'Pengajuan dibuat.', 'Actor Email': 'Admin A'
  },
  {
    Timestamp: new Date('2026-11-14T06:00:00Z'), 'ID Pengajuan': 'P3', Status: 'ACC',
    Catatan: 'Disetujui.', 'Actor Email': 'Admin A'
  }
];

const UPLOAD = [
  {
    Timestamp: new Date('2026-11-14T02:00:05Z'), 'ID Pengajuan': 'P2', NPM: '123', 'Nama Lengkap': 'Mhs Dua',
    Blok: 'A', 'Jenis Kegiatan': 'Ujian', Detail: 'Unggah bukti bayar oleh admin', Tanggal: '2026-11-14',
    'Link ACC INHAL': '', 'Link Bukti Bayar': 'https://drive.google.com/file/d/ABC123/view'
  },
  {
    Timestamp: new Date('2026-11-14T07:00:00Z'), 'ID Pengajuan': 'P4', NPM: '456', 'Nama Lengkap': 'Mhs Empat',
    Blok: 'B', 'Jenis Kegiatan': 'SGD', Detail: 'Unggah bukti bayar', Tanggal: '2026-11-14',
    'Link ACC INHAL': '', 'Link Bukti Bayar': ''
  }
];

const TABLES = { AuditLog: AUDIT, StatusHistory: STATUS, LogUpload: UPLOAD };
const RANGE = { dari: '2026-11-14', sampai: '2026-11-14' };

describe('activity log GAS setara CF', () => {
  it('memetakan aksi GAS ke jenis aksi CF', () => {
    const api = activityApi(TABLES);
    assert.equal(api._activityKind('VERIFY', 'Pembayaran'), 'VerifyBayar');
    assert.equal(api._activityKind('CORRECT', 'Pembayaran'), 'CorrectBayar');
    assert.equal(api._activityKind('RESET_UPLOAD', 'Pengajuan'), 'ResetUpload');
    assert.equal(api._activityKind('UPLOAD_BUKTI_ADMIN', 'Pengajuan'), 'UploadAdmin');
    assert.equal(api._activityKind('UPLOAD_SURAT', 'Pengajuan'), 'UploadAdmin');
    assert.equal(api._activityKind('UPDATE', 'Pengajuan'), 'UpdatePengajuan');
    assert.equal(api._activityKind('UPDATE', 'DetailKegiatan'), 'UpdatePengajuan');
    assert.equal(api._activityKind('DELETE', 'DetailKegiatan'), 'DeletePengajuan');
    assert.equal(api._activityKind('DELETE', 'Pengajuan'), 'DeletePengajuan');
    assert.equal(api._activityKind('UPDATE', 'CheckData'), 'UpdatePengajuan');
    assert.equal(api._activityKind('BA_CREATE', 'BA-1'), 'BaCreate');
    assert.equal(api._activityKind('BA_DELETE', 'BA-1'), 'BaDelete');
    assert.equal(api._activityKind('CREATE_JADWAL', 'JadwalPelaksanaan'), 'BaUpdate');
    assert.equal(api._activityKind('CANCEL_JADWAL', 'JadwalPelaksanaan'), 'BaUpdate');
    assert.equal(api._activityKind('RENAME_MASTER', 'Blok: A -> B'), 'RenameMaster');
    assert.equal(api._activityKind('LOGIN_ADMIN_GOOGLE', 'Admin'), 'Lainnya');
    assert.deepEqual(api._activityGroup('BaDelete'), ['ba']);
    assert.deepEqual(api._activityGroup('DeletePengajuan'), ['kritis']);
    assert.deepEqual(api._activityGroup('Lainnya'), []);
  });

  it('membagi hari memakai WIB (UTC+7)', () => {
    const api = activityApi(TABLES);
    assert.equal(api._actWibDay('2026-11-13T18:00:00'), '2026-11-14');
    assert.equal(api._actWibDay('2026-11-14T16:59:00'), '2026-11-14');
    assert.equal(api._actWibDay('2026-11-14T17:00:00'), '2026-11-15');
    assert.equal(api._actIsoUtc(new Date('2026-11-14T01:02:03Z')), '2026-11-14T01:02:03');
  });

  it('menggabungkan audit, status, dan unggahan serta membuang duplikat unggahan admin', () => {
    const api = activityApi(TABLES);
    const res = api.getActivityLog(Object.assign({ perPage: 100 }, RANGE));
    assert.equal(res.total, 7);
    assert.equal(res.rows.length, 7);
    assert.equal(res.rows.filter((e) => e.sumber === 'log_upload').length, 1);
    assert.equal(res.rows.filter((e) => e.jenis === 'UploadAdmin').length, 1);
    assert.equal(res.rows.filter((e) => e.jenis === 'UploadMahasiswa').length, 1);
    assert.equal(res.rows.filter((e) => e.jenis === 'ACC').length, 1);
    assert.equal(res.rows.filter((e) => e.jenis === 'Menunggu').length, 1);
  });

  it('mengembalikan ringkasan aktor, jenis, grup, dan kartu yang kompatibel UI CF', () => {
    const api = activityApi(TABLES);
    const res = api.getActivityLog(Object.assign({ perPage: 100 }, RANGE));
    assert.deepEqual(res.range, RANGE);
    assert.equal(res.summary.total, 7);
    assert.equal(res.summary.keputusan, 2);
    assert.equal(res.summary.unggahan, 2);
    assert.equal(res.summary.kritis, 1);
    const adminA = res.actors.find((a) => a.nama === 'Admin A');
    assert.ok(adminA);
    assert.equal(adminA.role, 'Admin');
    assert.equal(adminA.jumlah, 4);
    assert.ok(res.kinds.every((k) => 'jenis' in k && 'label' in k && 'jumlah' in k));
    const verify = res.kinds.find((k) => k.jenis === 'VerifyBayar');
    assert.equal(verify.label, 'Verifikasi Bayar');
    assert.ok(res.groups.some((g) => g.key === '' && g.jumlah === 7));
    assert.ok(res.groups.some((g) => g.key === 'keputusan' && g.jumlah === 2));
    assert.ok(res.groups.some((g) => g.key === 'ba' && g.jumlah === 1));
  });

  it('menyusun baris terbaru lebih dulu dengan field detail', () => {
    const api = activityApi(TABLES);
    const res = api.getActivityLog(Object.assign({ perPage: 100 }, RANGE));
    assert.equal(res.rows[0].jenis, 'UploadMahasiswa');
    assert.equal(res.rows[0].targetId, 'P4');
    const verify = res.rows.find((e) => e.jenis === 'VerifyBayar');
    assert.equal(verify.targetId, 'P1');
    assert.equal(verify.meta.nominal, 50000);
    assert.equal(verify.sebelum.status, 'menunggu');
    assert.equal(verify.sesudah.status, 'valid');
    const rename = res.rows.find((e) => e.jenis === 'RenameMaster');
    assert.equal(rename.sebelum.nilai, 'A');
    assert.equal(rename.sesudah.nilai, 'B');
  });

  it('memfilter berdasarkan jenis, grup, aktor, dan kata kunci', () => {
    const api = activityApi(TABLES);
    const byKind = api.getActivityLog(Object.assign({ jenis: 'VerifyBayar', perPage: 100 }, RANGE));
    assert.equal(byKind.total, 1);
    const byGroup = api.getActivityLog(Object.assign({ grup: 'ba', perPage: 100 }, RANGE));
    assert.equal(byGroup.total, 1);
    assert.equal(byGroup.rows[0].jenis, 'BaDelete');
    const byActor = api.getActivityLog(Object.assign({ aktor: 'Admin A', perPage: 100 }, RANGE));
    assert.equal(byActor.total, 4);
    const byQuery = api.getActivityLog(Object.assign({ q: 'mengganti', perPage: 100 }, RANGE));
    assert.equal(byQuery.total, 1);
    assert.equal(byQuery.rows[0].jenis, 'RenameMaster');
  });

  it('membatasi hasil per halaman dan rentang tanggal', () => {
    const api = activityApi(TABLES);
    const page1 = api.getActivityLog(Object.assign({ perPage: 3, page: 1 }, RANGE));
    assert.equal(page1.total, 7);
    assert.equal(page1.pages, 3);
    assert.equal(page1.rows.length, 3);
    const page3 = api.getActivityLog(Object.assign({ perPage: 3, page: 3 }, RANGE));
    assert.equal(page3.rows.length, 1);
    const outOfRange = api.getActivityLog({ dari: '2026-11-15', sampai: '2026-11-15' });
    assert.equal(outOfRange.total, 0);
  });
});
