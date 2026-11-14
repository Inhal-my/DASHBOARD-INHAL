import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const source = read('../5_d1_import.gs');
function runtimeApi(inject) {
  const names = [
    'SpreadsheetApp', 'DriveApp', 'PropertiesService', 'Drive', 'MimeType',
    'getGlobalSpreadsheet', 'ensureSheetWithHeaders', 'getHeadersFromSheet',
    'invalidateSheetCache', 'SCHEMAS'
  ];
  const returned = ['_d1ApplyStage', '_d1ReadTables', '_d1NormalizeSource', '_d1ResolveWorkbook'];
  return new Function(
    ...names,
    source + '\nreturn {' + returned.join(',') + '};'
  )(...names.map((n) => inject[n]));
}

const manifest = JSON.parse(read('../appsscript.json'));

function gasSchemas() {
  const core = read('../0_code.gs');
  const start = core.indexOf('const SCHEMAS =');
  const end = core.indexOf('const HEADER_BG_COLOR');
  assert.ok(start !== -1 && end > start, 'SCHEMAS tidak ditemukan');
  return new Function(core.slice(start, end) + '\nreturn SCHEMAS;')();
}

function pureApi() {
  const start = source.indexOf('const D1_IMPORT_PRESERVE');
  const end = source.indexOf('// ===== RUNTIME GAS =====');
  assert.ok(start !== -1 && end > start, 'blok murni impor D1 tidak ditemukan');
  const block = source.slice(start, end);
  return new Function(
    block + '\nreturn {' +
      'D1_IMPORT_PRESERVE, D1_IMPORT_STAGES, D1_IMPORT_TABLES,' +
      '_d1MapRow, _d1ValidateStage, _d1ReportText' +
      '};'
  )();
}

describe('impor snapshot D1 tahap 1', () => {
  it('mendaftarkan menu INHAL dan aksi dry-run serta tahap 1', () => {
    assert.match(source, /function onOpen\(\)/);
    assert.match(source, /createMenu\('INHAL'\)/);
    assert.match(source, /Impor Snapshot D1 - Dry-run/);
    assert.match(source, /Impor Snapshot D1 - Tahap 1/);
    assert.match(source, /Impor Snapshot D1 - Tahap 2/);
    assert.match(source, /Impor Snapshot D1 - Tahap 3/);
    assert.match(source, /Impor Snapshot D1 - Tahap 4/);
    assert.match(source, /Impor Snapshot D1 - Tahap 5/);
    assert.match(source, /function d1ImportDryRun\(\)/);
    assert.match(source, /function d1ImportStage1\(\)/);
    assert.match(source, /function d1ImportStage2\(\)/);
    assert.match(source, /function d1ImportStage3\(\)/);
    assert.match(source, /function d1ImportStage4\(\)/);
    assert.match(source, /function d1ImportStage5\(\)/);
  });

  it('mengaktifkan layanan Drive lanjutan untuk konversi XLSX', () => {
    const services = manifest.dependencies && manifest.dependencies.enabledAdvancedServices;
    assert.ok(Array.isArray(services));
    assert.ok(services.some((s) => s.userSymbol === 'Drive' && s.serviceId === 'drive'));
    assert.match(source, /Drive\.Files\.copy\(/);
    assert.match(source, /convert: true/);
    assert.match(source, /PropertiesService\.getScriptProperties\(\)/);
    assert.match(source, /getLastUpdated\(\)\.getTime\(\)/);
  });

  it('menetapkan sheet yang dipertahankan dan tahap 1', () => {
    const api = pureApi();
    assert.deepEqual(api.D1_IMPORT_PRESERVE, ['Admin', 'BagianStaff', 'NomorSurat']);
    assert.deepEqual(
      api.D1_IMPORT_STAGES[1].tables,
      ['mahasiswa', 'master_kegiatan', 'master_bagian', 'master_biaya', 'config']
    );
    assert.deepEqual(
      api.D1_IMPORT_STAGES[2].tables,
      ['pengajuan', 'detail_kegiatan', 'status_history', 'check_data', 'pembayaran_revisi']
    );
    assert.deepEqual(
      api.D1_IMPORT_STAGES[3].tables,
      ['berita_acara', 'berita_acara_peserta', 'berita_acara_admin', 'berita_acara_admin_peserta', 'berita_acara_admin_berkas']
    );
    assert.deepEqual(
      api.D1_IMPORT_STAGES[4].tables,
      ['jadwal_pelaksanaan', 'jadwal_peserta', 'jadwal_dosen', 'ba_dosen', 'berita_acara_sesi']
    );
    assert.deepEqual(
      api.D1_IMPORT_STAGES[5].tables,
      ['log_upload', 'audit_log']
    );
  });

  it('memetakan setiap kolom impor ke header SCHEMAS GAS', () => {
    const api = pureApi();
    const schemas = gasSchemas();
    Object.keys(api.D1_IMPORT_TABLES).forEach((table) => {
      const def = api.D1_IMPORT_TABLES[table];
      assert.ok(schemas[def.sheet], 'sheet ' + def.sheet + ' tidak ada di SCHEMAS');
      assert.deepEqual(
        def.fields.map((field) => field.to),
        schemas[def.sheet],
        'kolom ' + table + ' tidak cocok dengan SCHEMAS ' + def.sheet
      );
    });
  });

  it('memetakan header mentah dan header ramah ke header GAS', () => {
    const api = pureApi();
    assert.deepEqual(api._d1MapRow('mahasiswa', { npm: '001', nama_lengkap: 'Ani', email: 'a@x', blok: 'A' }), {
      NPM: '001', 'Nama Lengkap': 'Ani', Email: 'a@x', Blok: 'A', Keterangan: ''
    });
    assert.deepEqual(api._d1MapRow('master_bagian', { Lab: 'Lab A', 'Kegiatan Lab': 'Praktikum', Bagian: 'Anatomi', Email: 'b@x' }), {
      Lab: 'Lab A', 'Kegiatan Lab': 'Praktikum', Bagian: 'Anatomi', Email: 'b@x'
    });
    assert.deepEqual(api._d1MapRow('config', { key: 'BUKTI_MODE', value: 'strict' }), {
      Key: 'BUKTI_MODE', Value: 'strict'
    });
  });

  it('menolak baris tanpa kunci dan duplikat kunci ketat', () => {
    const api = pureApi();
    const report = api._d1ValidateStage(1, {
      mahasiswa: [
        { npm: '001', nama_lengkap: 'Ani' },
        { npm: '', nama_lengkap: 'Tanpa NPM' },
        { npm: '001', nama_lengkap: 'Duplikat' }
      ],
      master_kegiatan: [{ kategori: 'Blok', nilai: 'A' }],
      master_bagian: [{ lab: 'Lab A', kegiatan_lab: 'P1', bagian: 'Anatomi' }],
      master_biaya: [{ kegiatan: 'Inhal', biaya: '100000' }],
      config: [{ key: 'X', value: '1' }]
    });
    const mhs = report.stats.find((s) => s.table === 'mahasiswa');
    assert.equal(mhs.input, 3);
    assert.equal(mhs.accepted, 1);
    assert.equal(mhs.skipped, 2);
    assert.equal(report.errors, 2);
    assert.ok(report.issues.some((i) => /Kolom kunci kosong/.test(i.message)));
    assert.ok(report.issues.some((i) => /Duplikat kunci/.test(i.message)));
  });

  it('menerima duplikat non-ketat sebagai peringatan', () => {
    const api = pureApi();
    const report = api._d1ValidateStage(1, {
      mahasiswa: [],
      master_kegiatan: [],
      master_bagian: [],
      master_biaya: [
        { kegiatan: 'Inhal', biaya: '1' },
        { kegiatan: 'Inhal', biaya: '2' }
      ],
      config: []
    });
    assert.equal(report.errors, 0);
    assert.equal(report.warnings, 1);
    assert.equal(report.stats.find((s) => s.table === 'master_biaya').accepted, 2);
  });

  it('menandai tabel snapshot yang hilang sebagai error', () => {
    const api = pureApi();
    const report = api._d1ValidateStage(1, { mahasiswa: [] });
    assert.ok(report.errors >= 4);
    assert.ok(report.issues.some((i) => i.table === 'config' && /tidak ditemukan/.test(i.message)));
  });

  it('membuat laporan dry-run tanpa klaim menulis data', () => {
    const api = pureApi();
    const report = api._d1ValidateStage(1, {
      mahasiswa: [{ npm: '001' }],
      master_kegiatan: [],
      master_bagian: [],
      master_biaya: [],
      config: []
    });
    const text = api._d1ReportText(report, true);
    assert.match(text, /Tahap 1: Master, Mahasiswa, dan Config/);
    assert.match(text, /Dipertahankan: Admin, BagianStaff, NomorSurat/);
    assert.match(text, /Mode dry-run: tidak ada data yang ditulis/);
  });

  it('mengganti isi sheet setelah header dan menolak sheet yang dipertahankan', () => {
    assert.match(source, /function _d1ApplyStage\(/);
    assert.match(source, /sheet\.getRange\(2, 1, lastRow - 1, lastCol\)\.clearContent\(\)/);
    assert.match(source, /sheet\.getRange\(2, 1, rows\.length, headers\.length\)\.setValues\(rows\)/);
    assert.match(source, /D1_IMPORT_PRESERVE\.indexOf\(def\.sheet\)/);
    assert.match(source, /invalidateSheetCache\(def\.sheet\)/);
  });

  it('menormalkan link Drive, link Sheets, dan ID mentah', () => {
    const api = runtimeApi({});
    assert.equal(api._d1NormalizeSource('https://drive.google.com/file/d/ABC123/view?usp=sharing'), 'ABC123');
    assert.equal(api._d1NormalizeSource('https://docs.google.com/spreadsheets/d/SHEET99/edit#gid=0'), 'SHEET99');
    assert.equal(api._d1NormalizeSource('https://drive.google.com/open?id=XYZ789'), 'XYZ789');
    assert.equal(api._d1NormalizeSource('  RAW_ID  '), 'RAW_ID');
  });

  it('membaca tabel dari sheet hasil konversi dan melewati baris kosong', () => {
    const sheet = {
      getName: () => 'mahasiswa',
      getLastRow: () => 4,
      getLastColumn: () => 2,
      getRange: () => ({
        getValues: () => [
          ['NPM', 'Nama Lengkap'],
          ['001', 'Ani'],
          ['', ''],
          [null, 'Budi']
        ]
      })
    };
    const api = runtimeApi({
      SpreadsheetApp: { openById: () => ({ getSheets: () => [sheet] }), flush: () => {} }
    });
    assert.deepEqual(api._d1ReadTables('fake'), {
      mahasiswa: [
        { NPM: '001', 'Nama Lengkap': 'Ani' },
        { NPM: null, 'Nama Lengkap': 'Budi' }
      ]
    });
  });

  it('menulis ulang sheet sesuai header GAS dan mengosongkan baris lama', () => {
    const ops = [];
    const sheet = {
      getName: () => 'Mahasiswa',
      getLastRow: () => 3,
      getLastColumn: () => 4,
      getRange: (row, col, numRows, numCols) => ({
        clearContent: () => ops.push(['clear', row, col, numRows, numCols]),
        setValues: (values) => ops.push(['set', row, col, values])
      })
    };
    const headers = ['NPM', 'Nama Lengkap', 'Email', 'Blok', 'Keterangan'];
    const api = runtimeApi({
      SpreadsheetApp: { flush: () => {} },
      getGlobalSpreadsheet: () => ({ getSheetByName: () => sheet }),
      ensureSheetWithHeaders: () => {},
      getHeadersFromSheet: () => headers,
      invalidateSheetCache: () => {},
      SCHEMAS: {
        Mahasiswa: {}, MasterKegiatan: {}, MasterBagian: {}, MasterBiaya: {}, Config: {}
      }
    });
    const report = {
      errors: 0,
      tables: {
        mahasiswa: [{ NPM: '001', 'Nama Lengkap': 'Ani', Email: 'a@x', Blok: 'A', Keterangan: '' }],
        master_kegiatan: [],
        master_bagian: [],
        master_biaya: [],
        config: []
      }
    };
    const result = api._d1ApplyStage(1, report);
    assert.deepEqual(ops[0], ['clear', 2, 1, 2, 5]);
    assert.deepEqual(ops[1], ['set', 2, 1, [['001', 'Ani', 'a@x', 'A', '']]]);
    assert.equal(result.results.length, 5);
    assert.equal(result.results[0].rows, 1);
  });

  it('menolak impor saat laporan masih memiliki error', () => {
    const api = runtimeApi({});
    assert.throws(() => api._d1ApplyStage(1, { errors: 1, tables: {} }), /masih memiliki error/);
  });

  it('memetakan data pengajuan dan revisi pembayaran dari header D1', () => {
    const api = pureApi();
    const pengajuan = api._d1MapRow('pengajuan', {
      'ID Pengajuan': 'P-1', 'NPM': '001', 'No. HP/WA': '0812', 'Form Key': 'K-1',
      'Status Pembayaran': 'valid', 'Payment Revision': 2
    });
    assert.equal(pengajuan['ID Pengajuan'], 'P-1');
    assert.equal(pengajuan['No. HP/WA'], '0812');
    assert.equal(pengajuan['Form Key'], 'K-1');
    assert.equal(pengajuan['Status Pembayaran'], 'valid');
    assert.equal(pengajuan['Payment Revision'], 2);

    const revisi = api._d1MapRow('pembayaran_revisi', {
      id: 9, id_pengajuan: 'P-1', revision: 2, created_at: '2026-01-01T00:00:00Z',
      before_json: '{"a":1}', after_json: '{"a":2}'
    });
    assert.equal(revisi['Revisi ID'], 9);
    assert.equal(revisi.Timestamp, '2026-01-01T00:00:00Z');
    assert.equal(revisi['Created At'], '2026-01-01T00:00:00Z');
    assert.equal(revisi['Before JSON'], '{"a":1}');
  });

  it('menerima banyak baris tanpa kunci unik pada tahap 2', () => {
    const api = pureApi();
    const report = api._d1ValidateStage(2, {
      pengajuan: [{ id_pengajuan: 'P-1' }, { id_pengajuan: 'P-2' }],
      detail_kegiatan: [{ id_pengajuan: 'P-1' }, { id_pengajuan: 'P-1' }],
      status_history: [{ id_pengajuan: 'P-1' }, { id_pengajuan: 'P-1' }],
      check_data: [{ id_pengajuan: 'P-1' }, { id_pengajuan: 'P-1' }],
      pembayaran_revisi: [{ id_pengajuan: 'P-1', revision: 1 }, { id_pengajuan: 'P-1', revision: 2 }]
    });
    assert.equal(report.errors, 0);
    assert.equal(report.warnings, 0);
    ['detail_kegiatan', 'status_history', 'check_data', 'pembayaran_revisi'].forEach((table) => {
      const stat = report.stats.find((item) => item.table === table);
      assert.equal(stat.accepted, 2, table + ' harus menerima semua baris');
    });
  });

  it('menolak ID Pengajuan kosong atau duplikat pada tahap 2', () => {
    const api = pureApi();
    const report = api._d1ValidateStage(2, {
      pengajuan: [
        { id_pengajuan: 'P-1' },
        { id_pengajuan: 'P-1' },
        { id_pengajuan: '' }
      ],
      detail_kegiatan: [], status_history: [], check_data: [], pembayaran_revisi: []
    });
    const stat = report.stats.find((item) => item.table === 'pengajuan');
    assert.equal(stat.accepted, 1);
    assert.equal(stat.skipped, 2);
    assert.equal(report.errors, 2);
  });

  it('memetakan berita acara admin dan berkas dari header mentah', () => {
    const api = pureApi();
    const admin = api._d1MapRow('berita_acara_admin', {
      ba_id: 'BA-1', nama_kegiatan: 'Praktikum', needs_regen: 1,
      updated_at: '2026-01-01T00:00:00Z', base_file_url: 'https://drive/x',
      base_file_name: 'base.pdf'
    });
    assert.equal(admin['BA ID'], 'BA-1');
    assert.equal(admin['Nama Kegiatan'], 'Praktikum');
    assert.equal(admin['Needs Regen'], 1);
    assert.equal(admin['Updated At'], '2026-01-01T00:00:00Z');
    assert.equal(admin['Base File URL'], 'https://drive/x');
    assert.equal(admin['Base File Name'], 'base.pdf');
    assert.equal(admin.Dosen, '');

    const berkas = api._d1MapRow('berita_acara_admin_berkas', {
      ba_id: 'BA-1', id_pengajuan: 'P-1', npm: '001', urutan: 1, page_index: 0,
      page_count: 2, byte_size: 1234, active: 1, superseded_at: '', scope: 'base'
    });
    assert.equal(berkas['Page Index'], 0);
    assert.equal(berkas['Page Count'], 2);
    assert.equal(berkas['Byte Size'], 1234);
    assert.equal(berkas.Active, 1);
    assert.equal(berkas.Scope, 'base');
  });

  it('menerima banyak peserta dan berkas pada tahap 3', () => {
    const api = pureApi();
    const report = api._d1ValidateStage(3, {
      berita_acara: [{ ba_id: 'BA-1' }, { ba_id: 'BA-2' }],
      berita_acara_peserta: [{ ba_id: 'BA-1' }, { ba_id: 'BA-1' }],
      berita_acara_admin: [{ ba_id: 'BA-1' }],
      berita_acara_admin_peserta: [{ ba_id: 'BA-1' }, { ba_id: 'BA-1' }],
      berita_acara_admin_berkas: [{ ba_id: 'BA-1' }, { ba_id: 'BA-1' }]
    });
    assert.equal(report.errors, 0);
    assert.equal(report.warnings, 0);
    ['berita_acara_peserta', 'berita_acara_admin_peserta', 'berita_acara_admin_berkas'].forEach((table) => {
      assert.equal(report.stats.find((item) => item.table === table).accepted, 2, table);
    });
  });

  it('menolak BA ID kosong atau duplikat pada tahap 3', () => {
    const api = pureApi();
    const report = api._d1ValidateStage(3, {
      berita_acara: [{ ba_id: 'BA-1' }, { ba_id: 'BA-1' }, { ba_id: '' }],
      berita_acara_peserta: [],
      berita_acara_admin: [],
      berita_acara_admin_peserta: [],
      berita_acara_admin_berkas: []
    });
    const stat = report.stats.find((item) => item.table === 'berita_acara');
    assert.equal(stat.accepted, 1);
    assert.equal(stat.skipped, 2);
    assert.equal(report.errors, 2);
  });

  it('memetakan jadwal, dosen, dan sesi dari header mentah', () => {
    const api = pureApi();
    const jadwal = api._d1MapRow('jadwal_pelaksanaan', {
      jadwal_id: 'J-1', bagian: 'Anatomi', blok: 'A', nama_kegiatan: 'Praktikum',
      kegiatan_key: 'K-1', tanggal: '2026-01-01', jam: '08:00', dosen: 'dr. Andi',
      active: 1, created_by: 'admin@x', updated_at: '2026-01-02T00:00:00Z'
    });
    assert.equal(jadwal['Jadwal ID'], 'J-1');
    assert.equal(jadwal['Kegiatan Key'], 'K-1');
    assert.equal(jadwal.Active, 1);
    assert.equal(jadwal['Created By'], 'admin@x');
    assert.equal(jadwal['Updated At'], '2026-01-02T00:00:00Z');

    const sesi = api._d1MapRow('berita_acara_sesi', {
      ba_id: 'BA-1', jadwal_id: 'J-1', urutan: 1
    });
    assert.deepEqual(sesi, {
      Timestamp: '', 'BA ID': 'BA-1', 'Jadwal ID': 'J-1', Urutan: 1
    });

    const baDosen = api._d1MapRow('ba_dosen', {
      ba_id: 'BA-1', nama: 'dr. Andi', nama_key: 'dr andi', urutan: 2
    });
    assert.equal(baDosen['BA ID'], 'BA-1');
    assert.equal(baDosen['Nama Key'], 'dr andi');
    assert.equal(baDosen.Urutan, 2);
  });

  it('menerima banyak peserta, dosen, dan sesi pada tahap 4', () => {
    const api = pureApi();
    const report = api._d1ValidateStage(4, {
      jadwal_pelaksanaan: [{ jadwal_id: 'J-1' }, { jadwal_id: 'J-2' }],
      jadwal_peserta: [{ jadwal_id: 'J-1' }, { jadwal_id: 'J-1' }],
      jadwal_dosen: [{ jadwal_id: 'J-1' }, { jadwal_id: 'J-1' }],
      ba_dosen: [{ ba_id: 'BA-1' }, { ba_id: 'BA-1' }],
      berita_acara_sesi: [{ ba_id: 'BA-1' }, { ba_id: 'BA-1' }]
    });
    assert.equal(report.errors, 0);
    assert.equal(report.warnings, 0);
    ['jadwal_peserta', 'jadwal_dosen', 'ba_dosen', 'berita_acara_sesi'].forEach((table) => {
      assert.equal(report.stats.find((item) => item.table === table).accepted, 2, table);
    });
  });

  it('menolak Jadwal ID kosong atau duplikat pada tahap 4', () => {
    const api = pureApi();
    const report = api._d1ValidateStage(4, {
      jadwal_pelaksanaan: [{ jadwal_id: 'J-1' }, { jadwal_id: 'J-1' }, { jadwal_id: '' }],
      jadwal_peserta: [],
      jadwal_dosen: [],
      ba_dosen: [],
      berita_acara_sesi: []
    });
    const stat = report.stats.find((item) => item.table === 'jadwal_pelaksanaan');
    assert.equal(stat.accepted, 1);
    assert.equal(stat.skipped, 2);
    assert.equal(report.errors, 2);
  });

  it('memetakan log upload dan audit log dari header mentah', () => {
    const api = pureApi();
    const log = api._d1MapRow('log_upload', {
      timestamp: '2026-01-01T00:00:00Z', id_pengajuan: 'P-1', npm: '001',
      nama_lengkap: 'Ani', jenis_kegiatan: 'Praktikum', detail: 'ACC',
      tanggal: '2026-01-01', link_acc_inhal: 'https://drive/acc',
      link_bukti_bayar: 'https://drive/bayar'
    });
    assert.equal(log['ID Pengajuan'], 'P-1');
    assert.equal(log['Jenis Kegiatan'], 'Praktikum');
    assert.equal(log['Link ACC INHAL'], 'https://drive/acc');
    assert.equal(log['Link Bukti Bayar'], 'https://drive/bayar');

    const audit = api._d1MapRow('audit_log', {
      timestamp: '2026-01-01T00:00:00Z', actor_email: 'admin@x',
      aksi: 'VERIFY', target: 'Pembayaran', detail: '{"x":1}', alasan: 'cek'
    });
    assert.equal(audit['Actor Email'], 'admin@x');
    assert.equal(audit.Aksi, 'VERIFY');
    assert.equal(audit.Target, 'Pembayaran');
    assert.equal(audit.Detail, '{"x":1}');
    assert.equal(audit.Alasan, 'cek');
  });

  it('menerima banyak log tanpa kunci unik pada tahap 5', () => {
    const api = pureApi();
    const report = api._d1ValidateStage(5, {
      log_upload: [{ id_pengajuan: 'P-1' }, { id_pengajuan: 'P-1' }],
      audit_log: [{ target: 'Pembayaran' }, { target: 'Pembayaran' }]
    });
    assert.equal(report.errors, 0);
    assert.equal(report.warnings, 0);
    assert.equal(report.stats.find((item) => item.table === 'log_upload').accepted, 2);
    assert.equal(report.stats.find((item) => item.table === 'audit_log').accepted, 2);
  });
})
