import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const code = read('../0_code.gs');
const business = read('../1_business.gs');
const parity = read('../4_parity.gs');

function block(src, name, nextName) {
  const start = src.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'fungsi ' + name + ' tidak ditemukan');
  const end = nextName ? src.indexOf('\nfunction ' + nextName + '(', start + 1) : -1;
  return src.slice(start, end === -1 ? src.length : end);
}

describe('parity RPC dashboard GAS dengan CF', () => {
  it('menyediakan enam RPC dashboard yang sebelumnya hilang', () => {
    ['baAdminGet', 'baAdminCreate', 'baAdminAddPeserta', 'baAdminAddPesertaMassal', 'baAdminRegenerate', 'auditMasterIntegrity']
      .forEach((fn) => assert.match(parity, new RegExp('function ' + fn + '\\(')));
  });

  it('baAdminGet mengembalikan kegiatan, BA, peserta, dan kandidat', () => {
    assert.match(parity, /function baAdminGet\(/);
    assert.match(parity, /return \{ success: true, data: \{ kegiatan: kegiatan, ba: ba, peserta: peserta, candidates: candidates \} \}/);
    assert.match(parity, /copy\.isCurrent = x\.idPengajuan === pid/);
  });

  it('baAdminCreate memakai Kegiatan Key dan menolak duplikat', () => {
    assert.match(parity, /function baAdminCreate\(/);
    assert.match(parity, /const key = _kegiatanKey\(bagian, blok, nama\)/);
    assert.match(parity, /created: false/);
    assert.match(parity, /generateBaId\(sheet\)/);
  });

  it('baAdminAddPeserta dan massal berbagi helper bulk', () => {
    assert.match(parity, /function _baAdminAddPesertaBulk\(baId, ids, token, requireShared\)/);
    assert.match(parity, /function baAdminAddPeserta\(baId, ids\)/);
    assert.match(parity, /function baAdminAddPesertaMassal\(baId, ids\)/);
    assert.match(parity, /_baAdminAddPesertaBulk\(baId, ids, arguments\[arguments\.length - 1\], true\)/);
    assert.match(parity, /Unggah dulu PDF-nya ya/);
  });

  it('baAdminRegenerate mengembalikan rencana gabung termasuk shared dan base', () => {
    assert.match(parity, /function baAdminRegenerate\(/);
    assert.match(parity, /mode: 'client'/);
    assert.match(parity, /sharedFiles: sharedRows\.map/);
    assert.match(parity, /base: baseUrl \? \{ fileUrl: baseUrl, fileName: baseName \} : null/);
    assert.match(parity, /BA_ADMIN_MAX_PAGES/);
  });

  it('auditMasterIntegrity memeriksa duplikat, orphan, blank, key drift, dan kualitas data', () => {
    assert.match(parity, /function auditMasterIntegrity\(/);
    assert.match(parity, /function _auditDataQuality\(/);
    assert.match(parity, /duplicates: duplicates/);
    assert.match(parity, /keyDrift: keyDrift/);
    assert.match(parity, /jadwalDuplikat/);
    assert.match(parity, /baNeedsRegen/);
  });
});

function runtimeFactory() {
  const baStr = block(business, '_baAdminStr', '_baAdminActive');
  const baActive = block(business, '_baAdminActive', '_baAdminFileId');
  const jadwalIdentity = block(business, '_jadwalIdentity', '_dedupeJadwalList');
  const candidates = block(parity, '_baAdminListCandidates', 'baAdminGet');
  const dataQuality = block(parity, '_auditDataQuality', 'auditMasterIntegrity');
  const norm = code.slice(code.indexOf('function norm('), code.indexOf('\nfunction _normalizeNpm('));
  return new Function(
    '_getRowsOptional', 'getAllRows', '_clientTime',
    norm + '\n' + baStr + '\n' + baActive + '\n' + jadwalIdentity + '\n' + candidates + '\n' + dataQuality +
    '\nreturn { _baAdminListCandidates, _auditDataQuality };'
  );
}

function makeRuntime(tables) {
  const rowsFor = (name) => (tables[name] || []).slice();
  return runtimeFactory()(rowsFor, rowsFor, (v) => String(v || '').slice(0, 5));
}

describe('runtime helper RPC dashboard', () => {
  it('_baAdminListCandidates memfilter jenis, pilihan, detail, dan blok', () => {
    const rt = makeRuntime({
      DetailKegiatan: [
        { 'ID Pengajuan': 'P1', 'Jenis Kegiatan': 'Ujian', Pilihan: 'Blok A', Detail: '', },
        { 'ID Pengajuan': 'P2', 'Jenis Kegiatan': 'Ujian', Pilihan: 'Blok A', Detail: '' },
        { 'ID Pengajuan': 'P3', 'Jenis Kegiatan': 'Ujian', Pilihan: 'Blok B', Detail: '' }
      ],
      Pengajuan: [
        { 'ID Pengajuan': 'P1', NPM: '002', 'Nama Lengkap': 'Budi', Blok: 'Blok 1', Status: 'ACC' },
        { 'ID Pengajuan': 'P2', NPM: '001', 'Nama Lengkap': 'Ani', Blok: 'Blok 2', Status: 'ACC' },
        { 'ID Pengajuan': 'P3', NPM: '003', 'Nama Lengkap': 'Cici', Blok: 'Blok 1', Status: 'ACC' }
      ]
    });
    const list = rt._baAdminListCandidates({
      bagian: 'Ujian', blok: 'Blok 1', jenis: 'Ujian', pilihan: 'Blok A', detail: ''
    });
    assert.deepEqual(list.map((x) => x.npm), ['002']);
    assert.equal(list[0].bagian, 'Ujian');
  });

  it('_auditDataQuality menghitung orphan, blank, duplikat jadwal, dan needs regen', () => {
    const rt = makeRuntime({
      Mahasiswa: [
        { NPM: '001', 'Nama Lengkap': 'Ani', Blok: '' },
        { NPM: '002', 'Nama Lengkap': 'Budi', Blok: 'Blok 1' }
      ],
      BeritaAcaraAdminPeserta: [
        { 'BA ID': 'BA-1', 'ID Pengajuan': 'P1', Active: '1' },
        { 'BA ID': 'BA-2', 'ID Pengajuan': 'P9', Active: '0' }
      ],
      BeritaAcaraAdmin: [
        { 'BA ID': 'BA-1', Bagian: 'Ujian', Blok: 'Blok 1', 'Nama Kegiatan': 'X', 'Needs Regen': '0' },
        { 'BA ID': 'BA-2', Bagian: 'Ujian', Blok: 'Blok 1', 'Nama Kegiatan': 'Y', 'Needs Regen': '1' }
      ],
      BeritaAcaraPeserta: [{ 'BA ID': 'BA-3' }],
      BeritaAcara: [
        { 'BA ID': 'BA-3', Bagian: 'Ujian', Blok: 'Blok 1', 'Nama Kegiatan': 'X' },
        { 'BA ID': 'BA-4', Bagian: 'Ujian', Blok: 'Blok 1', 'Nama Kegiatan': 'Z' }
      ],
      JadwalPelaksanaan: [
        { 'Jadwal ID': 'J1', Bagian: 'Ujian', Blok: 'Blok 1', 'Nama Kegiatan': 'X', Tanggal: '2026-01-01', Jam: '08:00', Dosen: 'A', Active: '1' },
        { 'Jadwal ID': 'J2', Bagian: 'Ujian', Blok: 'Blok 1', 'Nama Kegiatan': 'X', Tanggal: '2026-01-01', Jam: '08:00', Dosen: 'A', Active: '1' }
      ],
      JadwalPeserta: [
        { 'Jadwal ID': 'J1', 'ID Pengajuan': 'P1', NPM: '001' },
        { 'Jadwal ID': 'J2', 'ID Pengajuan': 'P1', NPM: '001' }
      ]
    });
    const dq = rt._auditDataQuality();
    assert.equal(dq.mahasiswaBlokKosong.count, 1);
    assert.equal(dq.baAdminOrphan.count, 1);
    assert.equal(dq.baBagianOrphan.count, 1);
    assert.equal(dq.jadwalDuplikat.count, 1);
    assert.equal(dq.baNeedsRegen.count, 1);
    assert.equal(dq.baPesertaNonaktif.count, 1);
  });
});
